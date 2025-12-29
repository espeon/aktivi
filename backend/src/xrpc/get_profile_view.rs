use axum::{extract::State, http::StatusCode, Json};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{did::Did, handle::Handle, string::Uri},
    CowStr,
};
use lex_rs::co_aktivi::actor::{
    get_profile_view::{GetProfileViewOutput, GetProfileViewRequest},
    ProfileView,
};
use std::sync::Arc;

use crate::AppState;

#[axum::debug_handler]
pub async fn handle(
    State(state): State<Arc<AppState>>,
    ExtractXrpc(req): ExtractXrpc<GetProfileViewRequest>,
) -> Result<Json<GetProfileViewOutput<'static>>, StatusCode> {
    let actor = req.actor.as_ref();

    // resolve actor to DID (could be handle or DID)
    // for now assume it's a DID
    let did = actor;

    // fetch profile from database
    let profile = sqlx::query!(
        r#"
        SELECT p.did, p.display_name, p.description, p.avatar, p.banner, p.indexed_at, i.handle
        FROM profiles p
        LEFT JOIN identities i ON p.did = i.did
        WHERE p.did = $1
        "#,
        did
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // count RSVPs for this actor
    let rsvp_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM rsvps
        WHERE did = $1
        "#,
        did
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let profile_view = ProfileView {
        did: Did::new_owned(did).unwrap(),
        handle: profile
            .handle
            .as_ref()
            .and_then(|h| Handle::new_owned(h).ok()),
        display_name: profile
            .display_name
            .as_ref()
            .map(|n| CowStr::copy_from_str(n)),
        description: profile
            .description
            .as_ref()
            .map(|d| CowStr::copy_from_str(d)),
        avatar: profile.avatar.as_ref().and_then(|a| Uri::new_owned(a).ok()),
        banner: profile.banner.as_ref().and_then(|b| Uri::new_owned(b).ok()),
        rsvp_count: Some(rsvp_count as i64),
        indexed_at: Some(jacquard_common::types::string::Datetime::new(
            profile.indexed_at.fixed_offset(),
        )),
        extra_data: None,
    };

    Ok(Json(GetProfileViewOutput {
        profile: profile_view,
        extra_data: None,
    }))
}
