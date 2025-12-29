use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did},
    CowStr, Data,
};
use lex_rs::co_aktivi::{
    actor::{
        get_rsv_ps::{GetRsvPsOutput, GetRsvPsRequest},
        ProfileViewBasic,
    },
    event::EventViewBasic,
};
use std::sync::Arc;

use crate::AppState;

#[axum::debug_handler]
pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetRsvPsRequest>,
) -> Result<Json<GetRsvPsOutput<'static>>, StatusCode> {
    let actor = req.actor.as_ref();
    let limit = req.limit.unwrap_or(50).min(100) as i64;
    let offset = req
        .cursor
        .as_ref()
        .and_then(|c| c.as_ref().parse::<i64>().ok())
        .unwrap_or(0);

    // resolve actor to DID (could be handle or DID)
    // for now assume it's a DID, but we should add handle resolution
    let did = actor;

    let rsvps = sqlx::query!(
        r#"
        SELECT r.uri, r.cid, r.did, r.subject_uri, r.subject_cid, r.status, r.indexed_at,
               e.name as event_name, e.starts_at as event_starts_at
        FROM rsvps r
        JOIN events e ON r.subject_uri = e.uri
        WHERE r.did = $1
        ORDER BY r.indexed_at DESC
        LIMIT $2 OFFSET $3
        "#,
        did,
        limit,
        offset
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rsvps_len = rsvps.len();
    let rsvp_views = rsvps
        .into_iter()
        .map(|rsvp| lex_rs::co_aktivi::actor::get_rsv_ps::RsvpView {
            uri: AtUri::new_owned(&rsvp.uri).unwrap(),
            cid: Cid::cow_str(CowStr::copy_from_str(&rsvp.cid)),
            author: ProfileViewBasic {
                did: Did::new_owned(did).unwrap(),
                handle: None,
                display_name: None,
                avatar: None,
                extra_data: None,
            },
            record: Data::from_json_owned(serde_json::json!({
                "subject": {
                    "uri": rsvp.subject_uri,
                    "cid": rsvp.subject_cid,
                },
                "status": rsvp.status,
            }))
            .unwrap(),
            event: EventViewBasic {
                uri: AtUri::new_owned(&rsvp.subject_uri).unwrap(),
                cid: Cid::cow_str(CowStr::copy_from_str(&rsvp.subject_cid)),
                name: CowStr::copy_from_str(&rsvp.event_name),
                starts_at: rsvp
                    .event_starts_at
                    .map(|dt| jacquard_common::types::string::Datetime::new(dt.fixed_offset())),
                extra_data: None,
            },
            indexed_at: jacquard_common::types::string::Datetime::new(
                rsvp.indexed_at.fixed_offset(),
            ),
            extra_data: None,
        })
        .collect();

    let cursor = if rsvps_len as i64 == limit {
        Some((offset + limit).to_string().into())
    } else {
        None
    };

    Ok(Json(GetRsvPsOutput {
        cursor,
        rsvps: rsvp_views,
        extra_data: None,
    }))
}
