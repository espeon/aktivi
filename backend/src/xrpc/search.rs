use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, string::Uri},
    CowStr, Data,
};
use lex_rs::co_aktivi::{
    actor::ProfileViewBasic,
    event::EventView,
    search::get_search_results::{GetSearchResultsOutput, GetSearchResultsRequest},
};
use std::{collections::HashMap, sync::Arc};

use crate::AppState;

pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetSearchResultsRequest>,
) -> Result<Json<GetSearchResultsOutput<'static>>, StatusCode> {
    let query = req.q.as_ref();
    let limit = req.limit.unwrap_or(25).min(100) as i64;
    let offset = req
        .cursor
        .as_ref()
        .and_then(|c| c.as_ref().parse::<i64>().ok())
        .unwrap_or(0);

    // simple text search on name and description
    let search_pattern = format!("%{}%", query);

    let events = sqlx::query!(
        r#"
        SELECT uri, cid, did, name, description, created_at, starts_at, ends_at, mode, status, locations, uris, indexed_at
        FROM events
        WHERE (name ILIKE $1 OR description ILIKE $1)
          AND starts_at > NOW()
        ORDER BY starts_at ASC
        LIMIT $2 OFFSET $3
        "#,
        search_pattern,
        limit,
        offset
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // fetch profiles for all event authors
    let dids: Vec<String> = events.iter().map(|e| e.did.clone()).collect();
    let profiles = sqlx::query!(
        r#"
        SELECT did, display_name, description, avatar, banner
        FROM profiles
        WHERE did = ANY($1)
        "#,
        &dids
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let profile_map: HashMap<String, _> =
        profiles.into_iter().map(|p| (p.did.clone(), p)).collect();

    let events_len = events.len();
    let event_views = events
        .into_iter()
        .map(|event| {
            let author = if let Some(profile) = profile_map.get(&event.did) {
                ProfileViewBasic {
                    did: Did::new_owned(&event.did).unwrap(),
                    handle: None, // TODO: resolve handle
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

            EventView {
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
                extra_data: None,
            }
        })
        .collect();

    let cursor = if events_len as i64 == limit {
        Some((offset + limit).to_string().into())
    } else {
        None
    };

    Ok(Json(GetSearchResultsOutput {
        cursor,
        events: event_views,
        extra_data: None,
    }))
}
