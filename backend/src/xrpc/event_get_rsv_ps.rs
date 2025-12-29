use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, string::Uri},
    CowStr,
};
use lex_rs::co_aktivi::event::get_rsv_ps::{GetRsvPsOutput, GetRsvPsRequest, RsvpView};
use std::sync::Arc;

use crate::AppState;

#[axum::debug_handler]
pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetRsvPsRequest>,
) -> Result<Json<GetRsvPsOutput<'static>>, StatusCode> {
    let event_uri = req.uri.as_ref();
    let status_filter = req.status.as_ref().map(|s| s.as_ref());
    let limit = req.limit.unwrap_or(50).min(100) as i64;
    let offset = req
        .cursor
        .as_ref()
        .and_then(|c| c.as_ref().parse::<i64>().ok())
        .unwrap_or(0);

    let rsvps = sqlx::query!(
        r#"
        SELECT r.uri, r.cid, r.did, r.status, r.indexed_at
        FROM rsvps r
        WHERE r.subject_uri = $1 AND ($2::text IS NULL OR r.status = $2)
        ORDER BY r.indexed_at DESC
        LIMIT $3 OFFSET $4
        "#,
        event_uri,
        status_filter,
        limit,
        offset
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rsvps_len = rsvps.len();

    // collect unique dids to fetch profiles
    let dids: Vec<String> = rsvps.iter().map(|r| r.did.clone()).collect();

    // batch fetch profiles
    let profiles = if !dids.is_empty() {
        sqlx::query!(
            r#"
            SELECT p.did, p.display_name, p.avatar, i.handle
            FROM profiles p
            LEFT JOIN identities i ON p.did = i.did
            WHERE p.did = ANY($1)
            "#,
            &dids
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        vec![]
    };

    // create a map for quick lookup
    let profile_map: std::collections::HashMap<_, _> = profiles
        .into_iter()
        .filter_map(|p| {
            p.did.map(|did| {
                (
                    did.clone(),
                    lex_rs::co_aktivi::actor::ProfileViewBasic {
                        did: Did::new_owned(&did).unwrap(),
                        handle: Some(p.handle.into()),
                        display_name: p.display_name.as_ref().map(|d| CowStr::copy_from_str(d)),
                        avatar: p.avatar.as_ref().and_then(|a| Uri::new_owned(a).ok()),
                        extra_data: None,
                    },
                )
            })
        })
        .collect();

    let rsvp_views: Vec<RsvpView> = rsvps
        .into_iter()
        .map(|rsvp| {
            let author = profile_map.get(&rsvp.did).cloned().unwrap_or_else(|| {
                lex_rs::co_aktivi::actor::ProfileViewBasic {
                    did: Did::new_owned(&rsvp.did).unwrap(),
                    handle: None,
                    display_name: None,
                    avatar: None,
                    extra_data: None,
                }
            });

            RsvpView {
                uri: AtUri::new_owned(&rsvp.uri).unwrap(),
                cid: Cid::cow_str(CowStr::copy_from_str(&rsvp.cid)),
                author,
                status: CowStr::copy_from_str(&rsvp.status),
                indexed_at: jacquard_common::types::string::Datetime::new(
                    rsvp.indexed_at.fixed_offset(),
                ),
                extra_data: None,
            }
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
