use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use jacquard_axum::ExtractXrpc;
use jacquard_common::{
    types::{aturi::AtUri, cid::Cid, did::Did, handle::Handle, string::Uri},
    CowStr, Data,
};
use jacquard_oatproxy::extract_bearer_token;
use lex_rs::co_aktivi::{
    actor::ProfileView,
    event::{
        get_event_view::{GetEventViewOutput, GetEventViewRequest},
        EventViewDetailed,
    },
};
use std::sync::Arc;

use crate::{handle::resolve_identity_with_cache, AppState};
use lex_rs::co_aktivi::actor::ProfileViewBasic;

/// Extract DID from Authorization header by validating JWT
async fn extract_authenticated_did(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<String, StatusCode> {
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Support both "Bearer" and "DPoP" authorization schemes
    let token = extract_bearer_token(auth_header)
        .or_else(|| {
            auth_header
                .strip_prefix("DPoP ")
                .or_else(|| auth_header.strip_prefix("dpop "))
        })
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Validate the downstream JWT using TokenManager
    let key_store_ref = state.keystore.as_ref();
    let claims = state
        .token_manager
        .validate_downstream_jwt(token, key_store_ref)
        .await
        .map_err(|e| {
            eprintln!("Failed to validate downstream JWT: {:?}", e);
            StatusCode::UNAUTHORIZED
        })?;

    Ok(claims.sub)
}

pub async fn handle(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    ExtractXrpc(req): ExtractXrpc<GetEventViewRequest>,
) -> Result<Json<GetEventViewOutput<'static>>, StatusCode> {
    let uri = req.uri.as_ref();

    let user_did_opt = match extract_authenticated_did(&headers, &state).await {
        Ok(did) => Some(did),
        Err(_) => None,
    };

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

    // count RSVPs for this event by status
    let rsvp_counts = sqlx::query!(
        r#"
        SELECT status, COUNT(*) as "count!"
        FROM rsvps
        WHERE subject_uri = $1
        GROUP BY status
        "#,
        uri
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut going_count = 0i64;
    let mut interested_count = 0i64;
    for row in rsvp_counts {
        match row.status.as_str() {
            "community.lexicon.calendar.rsvp#going" => going_count = row.count,
            "community.lexicon.calendar.rsvp#interested" => interested_count = row.count,
            _ => {}
        }
    }

    // fetch first 3 RSVPs (going or interested)
    let selected_rsvps = sqlx::query!(
        r#"
        SELECT r.did
        FROM rsvps r
        WHERE r.subject_uri = $1
        AND r.status IN ('community.lexicon.calendar.rsvp#going')
        ORDER BY r.indexed_at DESC
        LIMIT 3
        "#,
        uri
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // fetch profiles for selected RSVPs
    let mut selected_rsvp_profiles = Vec::new();

    // we can 1000% optimize this with a single query but eh
    for rsvp in selected_rsvps {
        let profile = sqlx::query!(
            r#"
            SELECT did, display_name, avatar
            FROM profiles
            WHERE did = $1
            "#,
            rsvp.did
        )
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        let handle = resolve_identity_with_cache(&rsvp.did, &state.handle_validity_cache)
            .await
            .ok()
            .and_then(|h| h.doc.also_known_as.first().cloned())
            .and_then(|h| h.strip_prefix("at://").map(String::from))
            .and_then(|h| Handle::new_owned(&h).ok());

        let profile_view = if let Some(profile) = profile {
            ProfileViewBasic {
                did: Did::new_owned(&rsvp.did).unwrap(),
                handle,
                display_name: profile
                    .display_name
                    .as_ref()
                    .map(|s| CowStr::copy_from_str(s)),
                avatar: profile.avatar.as_ref().map(|s| Uri::new_owned(s).unwrap()),
                extra_data: None,
            }
        } else {
            ProfileViewBasic {
                did: Did::new_owned(&rsvp.did).unwrap(),
                handle,
                display_name: None,
                avatar: None,
                extra_data: None,
            }
        };

        selected_rsvp_profiles.push(profile_view);
    }

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

    let hangle = resolve_identity_with_cache(&event.did, &state.handle_validity_cache).await;

    let author = if let Some(profile) = profile {
        ProfileView {
            did: Did::new_owned(&event.did).unwrap(),
            handle: hangle
                .ok()
                .and_then(|h| h.doc.also_known_as.first().cloned())
                .and_then(|h| h.strip_prefix("at://").map(String::from))
                .and_then(|h| Handle::new_owned(&h).ok()),
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
            handle: hangle
                .ok()
                .and_then(|h| h.doc.also_known_as.first().cloned())
                .and_then(|h| h.strip_prefix("at://").map(String::from))
                .and_then(|h| Handle::new_owned(&h).ok()),
            display_name: None,
            description: None,
            avatar: None,
            banner: None,
            rsvp_count: None,
            indexed_at: None,
            extra_data: None,
        }
    };

    // is the current user going/interested/whatever
    let current_user_rsvp = match user_did_opt {
        Some(user_did) => sqlx::query!(
            r#"
            SELECT status, uri
            FROM rsvps
            WHERE did = $1
            AND subject_uri = $2
            "#,
            user_did,
            event.uri
        )
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        None => None,
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
        going_count: Some(going_count),
        interested_count: Some(interested_count),
        selected_rsvps: if selected_rsvp_profiles.is_empty() {
            None
        } else {
            Some(selected_rsvp_profiles)
        },
        indexed_at: jacquard_common::types::string::Datetime::new(event.indexed_at.fixed_offset()),
        extra_data: None,
        current_user_status: current_user_rsvp.as_ref().map(|r| r.status.clone().into()),
        current_user_rsvp_uri: current_user_rsvp
            .map(|r| AtUri::new_owned(&r.uri).ok())
            .flatten(),
    };

    Ok(Json(GetEventViewOutput {
        event: event_view,
        extra_data: None,
    }))
}
