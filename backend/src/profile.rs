use anyhow::Result;
use moka::future::Cache;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct BskyProfile {
    pub did: String,
    pub handle: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub avatar: Option<String>,
    pub banner: Option<String>,
}

#[derive(Clone)]
pub struct ProfileRecord {
    pub did: String,
    pub handle: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub avatar: Option<String>,
    pub banner: Option<String>,
}

pub async fn fetch_bsky_profile(
    did: &str,
    handle_validity_cache: &Cache<String, bool>,
) -> Result<ProfileRecord> {
    let url = format!(
        "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={}",
        did
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "aktivi/0.1.0")
        .send()
        .await?;

    let bsky_profile: BskyProfile = response.json().await?;

    let handle =
        crate::handle::validate_with_cache(&bsky_profile.handle, did, handle_validity_cache).await;

    Ok(ProfileRecord {
        did: bsky_profile.did,
        handle,
        display_name: bsky_profile.display_name,
        description: None,
        avatar: bsky_profile.avatar,
        banner: bsky_profile.banner,
    })
}
