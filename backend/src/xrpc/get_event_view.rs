use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, handle::Handle, string::Uri},
    CowStr, Data,
};
use lex_rs::co_aktivi::{
    actor::ProfileView,
    event::{
        get_event_view::{GetEventViewOutput, GetEventViewRequest},
        EventViewDetailed,
    },
};
use std::sync::Arc;

use crate::AppState;

pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetEventViewRequest>,
) -> Result<Json<GetEventViewOutput<'static>>, StatusCode> {
    let uri = req.uri.as_ref();

    let event = sqlx::query!(
        r#"
        SELECT uri, cid, did, name, description, created_at, starts_at, ends_at, mode, status, locations, uris, indexed_at
        FROM events
        WHERE uri = $1
        "#,
        uri
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // count RSVPs for this event
    let rsvp_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM rsvps
        WHERE subject_uri = $1
        "#,
        uri
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // fetch profile for event author
    let profile = sqlx::query!(
        r#"
        SELECT did, display_name, description, avatar, banner
        FROM profiles
        WHERE did = $1
        "#,
        event.did
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let author = if let Some(profile) = profile {
        ProfileView {
            did: Did::new_owned(&event.did).unwrap(),
            handle: Some(Handle::new_owned(&event.did).unwrap()), // TODO: resolve handle
            display_name: profile
                .display_name
                .as_ref()
                .map(|s| CowStr::copy_from_str(s)),
            description: profile
                .description
                .as_ref()
                .map(|s| CowStr::copy_from_str(s)),
            avatar: profile.avatar.as_ref().map(|s| Uri::new_owned(s).unwrap()),
            banner: profile.banner.as_ref().map(|s| Uri::new_owned(s).unwrap()),
            rsvp_count: None,
            indexed_at: None,
            extra_data: None,
        }
    } else {
        ProfileView {
            did: Did::new_owned(&event.did).unwrap(),
            handle: Some(Handle::new_owned(&event.did).unwrap()),
            display_name: None,
            description: None,
            avatar: None,
            banner: None,
            rsvp_count: None,
            indexed_at: None,
            extra_data: None,
        }
    };

    let event_view = EventViewDetailed {
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
            "locations": event.locations,
            "uris": event.uris,
        }))
        .unwrap(),
        rsvp_count: Some(rsvp_count),
        indexed_at: jacquard_common::types::string::Datetime::new(event.indexed_at.fixed_offset()),
        extra_data: None,
    };

    Ok(Json(GetEventViewOutput {
        event: event_view,
        extra_data: None,
    }))
}
