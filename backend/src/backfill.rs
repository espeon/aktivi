use anyhow::{Context, Result};
use jacquard_api::community_lexicon::calendar::{event::Event, rsvp::Rsvp};
use jacquard_common::types::value;
use lex_rs::co_aktivi::actor::profile::Profile;
use repo_stream::{DiskBuilder, Driver, DriverBuilder};
use rocketman::{ingestion::LexiconIngestor, types::event::Event as JetstreamEvent};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Cursor;
use tracing::{info, warn};

use crate::ingest::{EventIngestor, ProfileIngestor, RsvpIngestor};

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
pub async fn backfill_user(
    did: &str,
    event_ingestor: &EventIngestor,
    rsvp_ingestor: &RsvpIngestor,
    profile_ingestor: &ProfileIngestor,
) -> Result<()> {
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
        .with_block_processor(|block| block.to_vec())
        .load_car(reader)
        .await?
    {
        Driver::Memory(_commit, mut driver) => {
            // process records in chunks
            while let Some(chunk) = driver.next_chunk(256).await? {
                for (rkey, block_data) in chunk {
                    if rkey.starts_with(EVENT_COLLECTION) {
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Event>(json_value) {
                                Ok(_ev) => {
                                    // convert to rocketman event format
                                    let jetstream_event = create_event_message(
                                        did,
                                        EVENT_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = event_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest event {}: {}", rkey, e);
                                    } else {
                                        event_count += 1;
                                    }
                                }
                                Err(e) => warn!("failed to parse event from {}: {}", rkey, e),
                            }
                        }
                    } else if rkey.starts_with(RSVP_COLLECTION) {
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Rsvp>(json_value.clone()) {
                                Ok(_rsvp) => {
                                    let jetstream_event = create_event_message(
                                        did,
                                        RSVP_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = rsvp_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest rsvp {}: {}", rkey, e);
                                    } else {
                                        rsvp_count += 1;
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "failed to parse rsvp from {}: {}, data: {:?}",
                                        rkey, e, json_value
                                    );
                                }
                            }
                        } else {
                            warn!("failed to decode CBOR for rsvp {}", rkey);
                        }
                    } else if rkey.starts_with(PROFILE_COLLECTION) {
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Profile>(json_value.clone()) {
                                Ok(_profile) => {
                                    let jetstream_event = create_event_message(
                                        did,
                                        PROFILE_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = profile_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest profile for {}: {}", did, e);
                                    } else {
                                        profile_count += 1;
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "failed to parse profile from {}: {}, data: {:?}",
                                        rkey, e, json_value
                                    );
                                }
                            }
                        } else {
                            warn!("failed to decode CBOR for profile {}", rkey);
                        }
                    }
                }
            }
        }
        Driver::Disk(paused) => {
            info!("repo exceeds memory limit, using disk storage");

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
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Event>(json_value) {
                                Ok(_event) => {
                                    let jetstream_event = create_event_message(
                                        did,
                                        EVENT_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = event_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest event {}: {}", rkey, e);
                                    } else {
                                        event_count += 1;
                                    }
                                }
                                Err(e) => warn!("failed to parse event from {}: {}", rkey, e),
                            }
                        }
                    } else if rkey.starts_with(RSVP_COLLECTION) {
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Rsvp>(json_value.clone()) {
                                Ok(_rsvp) => {
                                    let jetstream_event = create_event_message(
                                        did,
                                        RSVP_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = rsvp_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest rsvp {}: {}", rkey, e);
                                    } else {
                                        rsvp_count += 1;
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "failed to parse rsvp from {}: {}, data: {:?}",
                                        rkey, e, json_value
                                    );
                                }
                            }
                        } else {
                            warn!("failed to decode CBOR for rsvp {}", rkey);
                        }
                    } else if rkey.starts_with(PROFILE_COLLECTION) {
                        if let Ok(json_value) =
                            serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)
                        {
                            match value::from_json_value::<Profile>(json_value.clone()) {
                                Ok(_profile) => {
                                    let jetstream_event = create_event_message(
                                        did,
                                        PROFILE_COLLECTION,
                                        &rkey,
                                        block_data.clone(),
                                    )?;

                                    if let Err(e) = profile_ingestor.ingest(jetstream_event).await {
                                        warn!("failed to ingest profile for {}: {}", did, e);
                                    } else {
                                        profile_count += 1;
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "failed to parse profile from {}: {}, data: {:?}",
                                        rkey, e, json_value
                                    );
                                }
                            }
                        } else {
                            warn!("failed to decode CBOR for profile {}", rkey);
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

fn create_event_message(
    did: &str,
    collection: &str,
    rkey: &str,
    block_data: Vec<u8>,
) -> Result<JetstreamEvent<Value>> {
    use rocketman::types::event::{Commit, Kind, Operation};

    let json_value = serde_ipld_dagcbor::from_slice::<serde_json::Value>(&block_data)?;

    // compute CID from block data
    let cid = compute_cid(&block_data)?;

    Ok(JetstreamEvent {
        did: did.to_string(),
        time_us: None,
        kind: Kind::Commit,
        commit: Some(Commit {
            rev: "unknown".to_string(),
            operation: Operation::Create,
            collection: collection.to_string(),
            rkey: rkey.split('/').last().unwrap_or(rkey).to_string(),
            record: Some(json_value),
            cid: Some(cid),
        }),
        identity: None,
        account: None,
    })
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
