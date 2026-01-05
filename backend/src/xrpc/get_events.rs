use anyhow::Result;
use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, handle::Handle, string::Uri},
    CowStr, Data,
};
use lex_rs::co_aktivi::{
    actor::ProfileViewBasic,
    event::{
        get_events::{GetEventsOutput, GetEventsRequest},
        EventView, EventsByDate,
    },
};
use std::{collections::HashMap, sync::Arc};

use crate::{profile::ProfileRecord, AppState};

#[axum::debug_handler]
pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetEventsRequest>,
) -> Result<Json<GetEventsOutput<'static>>, StatusCode> {
    let limit = req.limit.unwrap_or(50).min(100) as i64;
    let offset = req
        .cursor
        .as_ref()
        .and_then(|c| c.as_ref().parse::<i64>().ok())
        .unwrap_or(0);

    // convert timezone offset from minutes to interval string for postgres
    // e.g., -480 minutes (PST) becomes '-08:00:00'
    let timezone_offset_seconds = req.timezone_offset.unwrap_or(0) * 60;

    let events = sqlx::query!(
        r#"
        SELECT
            e.uri,
            e.cid,
            e.did,
            e.name,
            e.description,
            e.created_at,
            e.starts_at,
            e.ends_at,
            e.mode,
            e.status,
            e.locations,
            e.uris,
            e.indexed_at,
            ee.style,
            ee.avatar,
            ee.tags,
            DATE((e.starts_at AT TIME ZONE 'UTC') + make_interval(secs => $3)) as event_date
        FROM events e
        LEFT JOIN event_enrichment ee ON e.uri = ee.event_uri
        WHERE e.starts_at > NOW()
        ORDER BY e.starts_at ASC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset,
        timezone_offset_seconds as f64
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // fetch profiles for all event authors
    let dids: Vec<String> = events.iter().map(|e| e.did.clone()).collect();
    let profiles = sqlx::query!(
        r#"
        SELECT p.did, p.display_name, p.description, p.avatar, p.banner, a.handle
        FROM profiles p
        LEFT JOIN identities a ON p.did = a.did
        WHERE p.did = ANY($1)
        "#,
        &dids
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut profile_map: HashMap<String, ProfileRecord> = profiles
        .into_iter()
        .filter_map(|p| {
            p.did.map(|did| {
                (
                    did.clone(),
                    ProfileRecord {
                        did,
                        handle: Some(p.handle),
                        display_name: p.display_name,
                        description: p.description,
                        avatar: p.avatar,
                        banner: p.banner,
                    },
                )
            })
        })
        .collect();

    // fall back to bsky profiles if any not found in local profiles table
    let missing_dids: Vec<&String> = dids
        .iter()
        .filter(|did| !profile_map.contains_key(*did))
        .collect();

    if !missing_dids.is_empty() {
        for did in missing_dids {
            // check cache first
            let profile = if let Some(cached_profile) = state.profile_cache.get(did).await {
                cached_profile
            } else {
                // fetch from bsky api and validate handle
                let fetched =
                    match crate::profile::fetch_bsky_profile(did, &state.handle_validity_cache)
                        .await
                    {
                        Ok(profile) => profile,
                        Err(_) => {
                            // if bsky api fails, create a minimal profile with just the did
                            ProfileRecord {
                                did: did.clone(),
                                handle: None,
                                display_name: None,
                                description: None,
                                avatar: None,
                                banner: None,
                            }
                        }
                    };

                // cache the result
                state
                    .profile_cache
                    .insert(did.clone(), fetched.clone())
                    .await;

                fetched
            };

            profile_map.insert(did.clone(), profile);
        }
    }

    let events_len = events.len();

    // group events by date
    let mut events_by_date: HashMap<chrono::NaiveDate, Vec<EventView<'static>>> = HashMap::new();

    for event in events {
        let author = if let Some(profile) = profile_map.get(&event.did) {
            ProfileViewBasic {
                did: Did::new_owned(&event.did).unwrap(),
                handle: profile
                    .handle
                    .as_ref()
                    .and_then(|h| Handle::new_owned(h).ok()),
                display_name: profile
                    .display_name
                    .as_ref()
                    .map(|s| CowStr::copy_from_str(s)),
                avatar: profile.avatar.as_ref().map(|s| Uri::new_owned(s).unwrap()),
                extra_data: None,
            }
        } else {
            ProfileViewBasic {
                did: Did::new_owned(&event.did).unwrap(),
                handle: None,
                display_name: None,
                avatar: None,
                extra_data: None,
            }
        };

        // TODO: properly deserialize enrichment data from JSONB
        let style = None;
        let tags = None;
        let avatar_url = None;

        let event_view = EventView {
            uri: AtUri::new_owned(&event.uri).unwrap(),
            cid: Cid::cow_str(CowStr::copy_from_str(&event.cid)),
            author,
            record: Data::from_json_owned(serde_json::json!({
                "name": event.name,
                "description": event.description,
                "createdAt": event.created_at.to_rfc3339(),
                "startsAt": event.starts_at.map(|dt| dt.to_rfc3339()),
                "endsAt": event.ends_at.map(|dt| dt.to_rfc3339()),
                "mode": event.mode,
                "status": event.status,
            }))
            .unwrap(),
            indexed_at: jacquard_common::types::string::Datetime::new(
                event.indexed_at.fixed_offset(),
            ),
            style,
            avatar_url,
            tags,
            extra_data: None,
        };

        if let Some(date) = event.event_date {
            events_by_date
                .entry(date)
                .or_insert_with(Vec::new)
                .push(event_view);
        }
    }

    // convert to sorted vec of EventsByDate
    let mut sorted_dates: Vec<_> = events_by_date.into_iter().collect();
    sorted_dates.sort_by_key(|(date, _)| *date);

    let events_by_date_output: Vec<EventsByDate> = sorted_dates
        .into_iter()
        .map(|(date, events)| EventsByDate {
            date: jacquard_common::types::string::Datetime::new(
                date.and_hms_opt(0, 0, 0).unwrap().and_utc().fixed_offset(),
            ),
            events,
            extra_data: None,
        })
        .collect();

    let cursor = if events_len as i64 == limit {
        Some((offset + limit).to_string().into())
    } else {
        None
    };

    Ok(Json(GetEventsOutput {
        cursor,
        events_by_date: events_by_date_output,
        extra_data: None,
    }))
}
