use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, handle::Handle, string::Uri},
    CowStr, Data,
};
use lex_rs::co_aktivi::{
    actor::{
        get_events::{GetEventsOutput, GetEventsRequest},
        ProfileViewBasic,
    },
    event::EventView,
};
use std::sync::Arc;

use crate::AppState;

#[axum::debug_handler]
pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetEventsRequest>,
) -> Result<Json<GetEventsOutput<'static>>, StatusCode> {
    let actor = req.actor.as_ref();
    let limit = req.limit.unwrap_or(50).min(100) as i64;
    let offset = req
        .cursor
        .as_ref()
        .and_then(|c| c.as_ref().parse::<i64>().ok())
        .unwrap_or(0);

    // resolve actor to DID (could be handle or DID)
    // for now assume it's a DID
    let did = actor;

    let events = sqlx::query!(
        r#"
        SELECT uri, cid, did, name, description, created_at, starts_at, ends_at, mode, status, locations, uris, indexed_at
        FROM events
        WHERE did = $1
        ORDER BY starts_at DESC
        LIMIT $2 OFFSET $3
        "#,
        did,
        limit,
        offset
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // fetch profile for the actor
    let profile = sqlx::query!(
        r#"
        SELECT p.did, p.display_name, p.avatar, i.handle
        FROM profiles p
        LEFT JOIN identities i ON p.did = i.did
        WHERE p.did = $1
        "#,
        did
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let author = if let Some(profile) = profile {
        ProfileViewBasic {
            did: Did::new_owned(did).unwrap(),
            handle: profile
                .handle
                .as_ref()
                .and_then(|h| Handle::new_owned(h).ok()),
            display_name: profile
                .display_name
                .as_ref()
                .map(|n| CowStr::copy_from_str(n)),
            avatar: profile.avatar.as_ref().and_then(|a| Uri::new_owned(a).ok()),
            extra_data: None,
        }
    } else {
        ProfileViewBasic {
            did: Did::new_owned(did).unwrap(),
            handle: None,
            display_name: None,
            avatar: None,
            extra_data: None,
        }
    };

    let events_len = events.len();
    let event_views = events
        .into_iter()
        .map(|event| EventView {
            uri: AtUri::new_owned(&event.uri).unwrap(),
            cid: Cid::cow_str(CowStr::copy_from_str(&event.cid)),
            author: author.clone(),
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
        })
        .collect();

    let cursor = if events_len as i64 == limit {
        Some((offset + limit).to_string().into())
    } else {
        None
    };

    Ok(Json(GetEventsOutput {
        cursor,
        events: event_views,
        extra_data: None,
    }))
}
