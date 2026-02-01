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

    let events_with_profiles = sqlx::query!(
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
            DATE((e.starts_at AT TIME ZONE 'UTC') + make_interval(secs => $3)) as event_date,
            p.display_name as author_display_name,
            p.description as author_description,
            p.avatar as author_avatar,
            p.banner as author_banner,
            i.handle as author_handle
        FROM events e
        LEFT JOIN event_enrichment ee ON e.uri = ee.event_uri
        LEFT JOIN profiles p ON e.did = p.did
        LEFT JOIN identities i ON e.did = i.did
        WHERE e.starts_at > NOW()
        -- there is probably a better way to filter out invalid profiles
        AND i.handle IS NOT NULL
        -- LOL kms
        AND e.did != 'did:plc:vsnj4aaxyatiht4spdht2q2t'
        ORDER BY e.starts_at ASC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset,
        timezone_offset_seconds as f64
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("database query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::debug!(
        "fetched {} events from database",
        events_with_profiles.len()
    );

    // collect missing profiles and check cache in parallel
    let mut profile_map: HashMap<String, ProfileRecord> = HashMap::new();
    let mut missing_dids: Vec<String> = Vec::new();

    for event in &events_with_profiles {
        if let (Some(display_name), handle) = (&event.author_display_name, &event.author_handle) {
            // profile exists in local db
            profile_map.insert(
                event.did.clone(),
                ProfileRecord {
                    did: event.did.clone(),
                    handle: Some(handle.clone()),
                    display_name: Some(display_name.clone()),
                    description: event.author_description.clone(),
                    avatar: event.author_avatar.clone(),
                    banner: event.author_banner.clone(),
                },
            );
        } else if state.profile_cache.get(&event.did).await.is_none() {
            // not in db and not in cache - need to fetch
            missing_dids.push(event.did.clone());
        } else {
            // in cache
            let cached = state.profile_cache.get(&event.did).await.unwrap();
            profile_map.insert(event.did.clone(), cached);
        }
    }

    tracing::debug!(
        "profile stats: {} in db, {} in cache, {} need fetching",
        profile_map.len(),
        events_with_profiles.len() - profile_map.len() - missing_dids.len(),
        missing_dids.len()
    );

    // fetch all missing profiles in parallel
    if !missing_dids.is_empty() {
        let fetch_tasks: Vec<_> = missing_dids
            .into_iter()
            .map(|did| {
                let state = state.clone();
                async move {
                    let profile = match crate::profile::fetch_bsky_profile(
                        &did,
                        &state.handle_validity_cache,
                    )
                    .await
                    {
                        Ok(profile) => profile,
                        Err(_) => ProfileRecord {
                            did: did.clone(),
                            handle: None,
                            display_name: None,
                            description: None,
                            avatar: None,
                            banner: None,
                        },
                    };

                    state
                        .profile_cache
                        .insert(did.clone(), profile.clone())
                        .await;
                    (did, profile)
                }
            })
            .collect();

        let fetched_profiles = futures::future::join_all(fetch_tasks).await;
        profile_map.extend(fetched_profiles);
    }

    let events_len = events_with_profiles.len();

    // group events by date
    let mut events_by_date: HashMap<chrono::NaiveDate, Vec<EventView<'static>>> = HashMap::new();

    for event in events_with_profiles {
        let did = match Did::new_owned(&event.did) {
            Ok(did) => did,
            Err(_) => {
                tracing::warn!("invalid DID in event: {}", event.did);
                continue;
            }
        };

        let author = if let Some(profile) = profile_map.get(&event.did) {
            ProfileViewBasic {
                did: did.clone(),
                handle: profile
                    .handle
                    .as_ref()
                    .and_then(|h| Handle::new_owned(h).ok()),
                display_name: profile
                    .display_name
                    .as_ref()
                    .map(|s| CowStr::copy_from_str(s)),
                avatar: profile.avatar.as_ref().and_then(|s| Uri::new_owned(s).ok()),
                extra_data: None,
            }
        } else {
            ProfileViewBasic {
                did: did.clone(),
                handle: None,
                display_name: None,
                avatar: None,
                extra_data: None,
            }
        };

        let uri = match AtUri::new_owned(&event.uri) {
            Ok(uri) => uri,
            Err(_) => {
                tracing::warn!("invalid AT-URI in event: {}", event.uri);
                continue;
            }
        };

        let record = match Data::from_json_owned(serde_json::json!({
            "name": event.name,
            "description": event.description,
            "createdAt": event.created_at.to_rfc3339(),
            "startsAt": event.starts_at.map(|dt| dt.to_rfc3339()),
            "endsAt": event.ends_at.map(|dt| dt.to_rfc3339()),
            "mode": event.mode,
            "status": event.status,
        })) {
            Ok(data) => data,
            Err(_) => {
                tracing::warn!("failed to serialize event record: {}", event.uri);
                continue;
            }
        };

        // TODO: properly deserialize enrichment data from JSONB
        let style = None;
        let tags = None;
        let avatar_url = None;

        let event_view = EventView {
            uri,
            cid: Cid::cow_str(CowStr::copy_from_str(&event.cid)),
            author,
            record,
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
        .filter_map(|(date, events)| {
            date.and_hms_opt(0, 0, 0).map(|datetime| EventsByDate {
                date: jacquard_common::types::string::Datetime::new(
                    datetime.and_utc().fixed_offset(),
                ),
                events,
                extra_data: None,
            })
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
