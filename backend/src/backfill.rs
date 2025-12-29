use anyhow::{Context, Result};
use jacquard_common::types::value;
use lex_rs::co_aktivi::actor::profile::Profile;
use lex_rs::community_lexicon::calendar::{event::Event, rsvp::Rsvp};
use repo_stream::{DiskBuilder, Driver, DriverBuilder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::io::Cursor;
use tracing::{info, warn};

const EVENT_COLLECTION: &str = "community.lexicon.calendar.event";
const RSVP_COLLECTION: &str = "community.lexicon.calendar.rsvp";
const PROFILE_COLLECTION: &str = "co.aktivi.actor.profile";

#[derive(Debug, Deserialize, Serialize)]
struct RepoInfo {
    did: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct RepoListResponse {
    repos: Vec<RepoInfo>,
    cursor: Option<String>,
}

/// Fetch all DIDs from the relay that have the specified collection
pub async fn fetch_all_dids(collection: &str) -> Result<Vec<String>> {
    let mut all_dids = Vec::new();
    let mut cursor: Option<String> = None;
    let base_url =
        "https://relay1.us-east.bsky.network/xrpc/com.atproto.sync.listReposByCollection";

    loop {
        let url = if let Some(c) = &cursor {
            format!("{}?collection={}&cursor={}", base_url, collection, c)
        } else {
            format!("{}?collection={}", base_url, collection)
        };

        info!("fetching DIDs from relay (cursor: {:?})", cursor);
        let response = reqwest::get(&url).await?;
        let list: RepoListResponse = response.json().await?;

        let count = list.repos.len();
        all_dids.extend(list.repos.into_iter().map(|r| r.did));

        info!("fetched {} DIDs (total: {})", count, all_dids.len());

        if list.cursor.is_none() || count == 0 {
            break;
        }
        cursor = list.cursor;
    }

    Ok(all_dids)
}

/// Resolve DID to find the user's PDS endpoint
pub async fn resolve_pds(did: &str) -> Result<String> {
    let plc_url = format!("https://plc.directory/{}", did);
    let response = reqwest::get(&plc_url).await?;
    let doc: serde_json::Value = response.json().await?;

    let service = doc
        .get("service")
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .and_then(|s| s.get("serviceEndpoint"))
        .and_then(|e| e.as_str())
        .ok_or_else(|| anyhow::anyhow!("no PDS found in DID document"))?;

    Ok(service.to_string())
}

/// Download and process a CAR file from a user's AT Protocol repo
pub async fn backfill_user(did: &str, pool: &PgPool) -> Result<()> {
    // resolve DID to PDS endpoint
    let pds = resolve_pds(did).await?;
    info!("resolved PDS: {}", pds);

    // download CAR file from PDS
    let pds_url = format!("{}/xrpc/com.atproto.sync.getRepo?did={}", pds, did);

    info!("fetching repo for {}", did);
    let response = reqwest::get(&pds_url)
        .await
        .context("failed to fetch repo")?;

    let status = response.status();
    let car_bytes = response
        .bytes()
        .await
        .context("failed to read response bytes")?;

    info!("downloaded {} bytes (status: {})", car_bytes.len(), status);

    if !status.is_success() {
        let error_text = String::from_utf8_lossy(&car_bytes);
        anyhow::bail!("failed to fetch repo: {} - {}", status, error_text);
    }

    // create an async reader from the bytes
    let reader = Cursor::new(car_bytes.to_vec());
    let reader = tokio::io::BufReader::new(reader);

    let mut event_count = 0;
    let mut rsvp_count = 0;
    let mut profile_count = 0;

    match DriverBuilder::new()
        .with_mem_limit_mb(100)
        //.with_block_processor(|block| block.to_vec())
        .load_car(reader)
        .await?
    {
        Driver::Memory(_commit, mut driver) => {
            // process records in chunks
            while let Some(chunk) = driver.next_chunk(2048).await? {
                for (rkey, block_data) in chunk {
                    if rkey.starts_with(EVENT_COLLECTION) {
                        match value::from_cbor::<Event>(&block_data) {
                            Ok(event) => {
                                let rkey_tail = rkey.split('/').last().unwrap_or(&rkey);
                                let uri =
                                    format!("at://{}/{}/{}", did, EVENT_COLLECTION, rkey_tail);
                                let cid = compute_cid(&block_data)?;

                                let created_at = event.created_at.as_ref();
                                let starts_at = event.starts_at.as_ref().map(|dt| dt.as_ref());
                                let ends_at = event.ends_at.as_ref().map(|dt| dt.as_ref());
                                let locations = event
                                    .locations
                                    .as_ref()
                                    .map(|locs| serde_json::to_value(locs))
                                    .transpose()?;
                                let uris = event
                                    .uris
                                    .as_ref()
                                    .map(|uris| serde_json::to_value(uris))
                                    .transpose()?;

                                if let Err(e) = sqlx::query!(
                                        r#"
                                        INSERT INTO events (uri, cid, did, rkey, name, description, created_at, starts_at, ends_at, mode, status, locations, uris)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                                        ON CONFLICT (uri) DO UPDATE SET
                                            cid = EXCLUDED.cid,
                                            name = EXCLUDED.name,
                                            description = EXCLUDED.description,
                                            created_at = EXCLUDED.created_at,
                                            starts_at = EXCLUDED.starts_at,
                                            ends_at = EXCLUDED.ends_at,
                                            mode = EXCLUDED.mode,
                                            status = EXCLUDED.status,
                                            locations = EXCLUDED.locations,
                                            uris = EXCLUDED.uris
                                        "#,
                                        uri,
                                        cid,
                                        did,
                                        rkey_tail,
                                        event.name.as_ref(),
                                        event.description.as_ref().map(|d| d.as_ref()),
                                        created_at,
                                        starts_at,
                                        ends_at,
                                        event.mode.as_ref().map(|m| m.as_ref()),
                                        event.status.as_ref().map(|s| s.as_ref()),
                                        locations,
                                        uris,
                                    )
                                    .execute(pool)
                                    .await {
                                        warn!("failed to insert event {}: {}", uri, e);
                                    } else {
                                        event_count += 1;
                                    }
                            }
                            Err(e) => warn!("failed to parse event from {}: {}", rkey, e),
                        }
                    } else if rkey.starts_with(RSVP_COLLECTION) {
                        match value::from_cbor::<Rsvp>(&block_data) {
                            Ok(rsvp) => {
                                let rkey_tail = rkey.split('/').last().unwrap_or(&rkey);
                                let uri = format!("at://{}/{}/{}", did, RSVP_COLLECTION, rkey_tail);
                                let cid = compute_cid(&block_data)?;

                                // Extract uri and cid from the strongRef Data
                                let (subject_uri, subject_cid) = match &rsvp.subject {
                                    value::Data::Object(obj) => {
                                        let uri = obj.get("uri").and_then(|v| match v {
                                            value::Data::String(s) => Some(s.as_ref()),
                                            _ => None,
                                        });
                                        let cid = obj.get("cid").and_then(|v| match v {
                                            value::Data::String(s) => Some(s.as_ref()),
                                            _ => None,
                                        });
                                        (uri, cid)
                                    }
                                    _ => (None, None),
                                };

                                if let Err(e) = sqlx::query!(
                                        r#"
                                        INSERT INTO rsvps (uri, cid, did, rkey, subject_uri, subject_cid, status)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                                        ON CONFLICT (uri) DO UPDATE SET
                                            cid = EXCLUDED.cid,
                                            subject_uri = EXCLUDED.subject_uri,
                                            subject_cid = EXCLUDED.subject_cid,
                                            status = EXCLUDED.status
                                        "#,
                                        uri,
                                        cid,
                                        did,
                                        rkey_tail,
                                        subject_uri,
                                        subject_cid,
                                        rsvp.status.as_ref(),
                                    )
                                    .execute(pool)
                                    .await {
                                        warn!("failed to insert rsvp {}: {}", uri, e);
                                    } else {
                                        rsvp_count += 1;
                                    }
                            }
                            Err(e) => warn!("failed to parse rsvp from {} (inmem): {}", rkey, e),
                        }
                    } else if rkey.starts_with(PROFILE_COLLECTION) {
                        match value::from_cbor::<Profile>(&block_data) {
                                Ok(profile) => {
                                    if let Err(e) = sqlx::query!(
                                        r#"
                                        INSERT INTO profiles (did, display_name, description, avatar, banner)
                                        VALUES ($1, $2, $3, $4, $5)
                                        ON CONFLICT (did) DO UPDATE SET
                                            display_name = EXCLUDED.display_name,
                                            description = EXCLUDED.description,
                                            avatar = EXCLUDED.avatar,
                                            banner = EXCLUDED.banner,
                                            updated_at = NOW()
                                        "#,
                                        did,
                                        profile.display_name.as_ref().map(|n| n.as_ref()),
                                        profile.description.as_ref().map(|d| d.as_ref()),
                                        profile.avatar.as_ref().map(|_| "blob_ref"),
                                        profile.banner.as_ref().map(|_| "blob_ref"),
                                    )
                                    .execute(pool)
                                    .await {
                                        warn!("failed to insert profile for {}: {}", did, e);
                                    } else {
                                        profile_count += 1;
                                    }
                                }
                                Err(e) => warn!("failed to parse profile from {}: {}", rkey, e),
                            }
                    }
                }
            }
        }
        Driver::Disk(paused) => {
            info!("repo {} exceeds memory limit, using disk storage", did);

            // create temporary directory for disk storage
            let temp_dir = std::env::temp_dir().join(format!("repo-{}", did.replace(':', "-")));
            std::fs::create_dir_all(&temp_dir)?;

            let disk_path = temp_dir.join("blocks.db");
            let store = DiskBuilder::new().open(disk_path).await?;

            let (_commit, mut driver) = paused.finish_loading(store).await?;

            // process records in chunks from disk
            while let Some(chunk) = driver.next_chunk(256).await? {
                for (rkey, block_data) in chunk {
                    if rkey.starts_with(EVENT_COLLECTION) {
                        match value::from_cbor::<Event>(&block_data) {
                            Ok(event) => {
                                let rkey_tail = rkey.split('/').last().unwrap_or(&rkey);
                                let uri =
                                    format!("at://{}/{}/{}", did, EVENT_COLLECTION, rkey_tail);
                                let cid = compute_cid(&block_data)?;

                                let created_at = event.created_at.as_ref();
                                let starts_at = event.starts_at.as_ref().map(|dt| dt.as_ref());
                                let ends_at = event.ends_at.as_ref().map(|dt| dt.as_ref());
                                let locations = event
                                    .locations
                                    .as_ref()
                                    .map(|locs| serde_json::to_value(locs))
                                    .transpose()?;
                                let uris = event
                                    .uris
                                    .as_ref()
                                    .map(|uris| serde_json::to_value(uris))
                                    .transpose()?;

                                if let Err(e) = sqlx::query!(
                                        r#"
                                        INSERT INTO events (uri, cid, did, rkey, name, description, created_at, starts_at, ends_at, mode, status, locations, uris)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                                        ON CONFLICT (uri) DO UPDATE SET
                                            cid = EXCLUDED.cid,
                                            name = EXCLUDED.name,
                                            description = EXCLUDED.description,
                                            created_at = EXCLUDED.created_at,
                                            starts_at = EXCLUDED.starts_at,
                                            ends_at = EXCLUDED.ends_at,
                                            mode = EXCLUDED.mode,
                                            status = EXCLUDED.status,
                                            locations = EXCLUDED.locations,
                                            uris = EXCLUDED.uris
                                        "#,
                                        uri,
                                        cid,
                                        did,
                                        rkey_tail,
                                        event.name.as_ref(),
                                        event.description.as_ref().map(|d| d.as_ref()),
                                        created_at,
                                        starts_at,
                                        ends_at,
                                        event.mode.as_ref().map(|m| m.as_ref()),
                                        event.status.as_ref().map(|s| s.as_ref()),
                                        locations,
                                        uris,
                                    )
                                    .execute(pool)
                                    .await {
                                        warn!("failed to insert event {}: {}", uri, e);
                                    } else {
                                        event_count += 1;
                                    }
                            }
                            Err(e) => warn!("failed to parse event from {}: {}", rkey, e),
                        }
                    } else if rkey.starts_with(RSVP_COLLECTION) {
                        match value::from_cbor::<Rsvp>(&block_data) {
                            Ok(rsvp) => {
                                let rkey_tail = rkey.split('/').last().unwrap_or(&rkey);
                                let uri = format!("at://{}/{}/{}", did, RSVP_COLLECTION, rkey_tail);
                                let cid = compute_cid(&block_data)?;

                                // Extract uri and cid from the strongRef Data
                                let (subject_uri, subject_cid) = match &rsvp.subject {
                                    value::Data::Object(obj) => {
                                        let uri = obj.get("uri").and_then(|v| match v {
                                            value::Data::String(s) => Some(s.as_ref()),
                                            _ => None,
                                        });
                                        let cid = obj.get("cid").and_then(|v| match v {
                                            value::Data::String(s) => Some(s.as_ref()),
                                            _ => None,
                                        });
                                        (uri, cid)
                                    }
                                    _ => (None, None),
                                };

                                if let Err(e) = sqlx::query!(
                                        r#"
                                        INSERT INTO rsvps (uri, cid, did, rkey, subject_uri, subject_cid, status)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                                        ON CONFLICT (uri) DO UPDATE SET
                                            cid = EXCLUDED.cid,
                                            subject_uri = EXCLUDED.subject_uri,
                                            subject_cid = EXCLUDED.subject_cid,
                                            status = EXCLUDED.status
                                        "#,
                                        uri,
                                        cid,
                                        did,
                                        rkey_tail,
                                        subject_uri,
                                        subject_cid,
                                        rsvp.status.as_ref(),
                                    )
                                    .execute(pool)
                                    .await {
                                        warn!("failed to insert rsvp {}: {}", uri, e);
                                    } else {
                                        rsvp_count += 1;
                                    }
                            }
                            Err(e) => warn!("failed to parse rsvp from {} (disk): {}", rkey, e),
                        }
                    } else if rkey.starts_with(PROFILE_COLLECTION) {
                        match value::from_cbor::<Profile>(&block_data) {
                            Ok(profile) => {
                                if let Err(e) = sqlx::query!(
                                    r#"
                                    INSERT INTO profiles (did, display_name, description, avatar, banner)
                                    VALUES ($1, $2, $3, $4, $5)
                                    ON CONFLICT (did) DO UPDATE SET
                                        display_name = EXCLUDED.display_name,
                                        description = EXCLUDED.description,
                                        avatar = EXCLUDED.avatar,
                                        banner = EXCLUDED.banner,
                                        updated_at = NOW()
                                    "#,
                                    did,
                                    profile.display_name.as_ref().map(|n| n.as_ref()),
                                    profile.description.as_ref().map(|d| d.as_ref()),
                                    profile.avatar.as_ref().map(|_| "blob_ref"),
                                    profile.banner.as_ref().map(|_| "blob_ref"),
                                )
                                .execute(pool)
                                .await {
                                    warn!("failed to insert profile for {}: {}", did, e);
                                } else {
                                    profile_count += 1;
                                }
                            }
                            Err(e) => warn!("failed to parse profile from {}: {}", rkey, e),
                        }
                    }
                }
            }

            // clean up temporary directory
            if let Err(e) = std::fs::remove_dir_all(&temp_dir) {
                warn!("failed to clean up temp dir: {}", e);
            }
        }
    }

    info!(
        "backfill complete: {} events, {} rsvps, {} profiles",
        event_count, rsvp_count, profile_count
    );

    Ok(())
}

fn compute_cid(block_data: &[u8]) -> Result<String> {
    use multihash::Multihash;
    use sha2::{Digest, Sha256};

    // compute SHA-256 hash of the block data
    let mut hasher = Sha256::new();
    hasher.update(block_data);
    let hash = hasher.finalize();

    // wrap in multihash format (0x12 = sha2-256 code)
    let mh = Multihash::wrap(0x12, &hash).unwrap();

    // create CID v1 with dag-cbor codec (0x71)
    let cid = cid::Cid::new_v1(0x71, mh);

    Ok(cid.to_string())
}
