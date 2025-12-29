use anyhow::Result;
use async_trait::async_trait;
use jacquard::types::value;
use lex_rs::community_lexicon::calendar::{event::Event, rsvp::Rsvp};

use rocketman::{ingestion::LexiconIngestor, types::event::Event as JetstreamEvent};
use serde_json::Value;
use sqlx::PgPool;
use tracing::{debug, info, warn};

/// Ingests calendar events into the database
pub struct EventIngestor {
    pool: PgPool,
}

impl EventIngestor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LexiconIngestor for EventIngestor {
    async fn ingest(&self, message: JetstreamEvent<Value>) -> Result<()> {
        let Some(commit) = message.commit else {
            return Ok(());
        };

        let Some(record) = commit.record else {
            return Ok(());
        };

        let event = value::from_json_value::<Event>(record)?;
        let uri = format!("at://{}/{}/{}", message.did, commit.collection, commit.rkey);
        let cid = commit.cid.as_deref().unwrap_or("unknown");

        debug!("ingesting event: {}", uri);

        let created_at = event.created_at.as_ref();
        let starts_at = event.starts_at.as_ref().map(|dt| dt.as_ref());
        let ends_at = event.ends_at.as_ref().map(|dt| dt.as_ref());

        // serialize locations and uris to json
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

        sqlx::query!(
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
            &message.did,
            commit.rkey,
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
        .execute(&self.pool)
        .await?;

        info!("ingested event: {}", uri);
        Ok(())
    }
}

/// Ingests calendar RSVPs into the database
pub struct RsvpIngestor {
    pool: PgPool,
}

impl RsvpIngestor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LexiconIngestor for RsvpIngestor {
    async fn ingest(&self, message: JetstreamEvent<Value>) -> Result<()> {
        let Some(commit) = message.commit else {
            return Ok(());
        };

        let Some(record) = commit.record else {
            return Ok(());
        };

        let rsvp = value::from_json_value::<Rsvp>(record)?;
        let uri = format!("at://{}/{}/{}", message.did, commit.collection, commit.rkey);
        let cid = commit.cid.as_deref().unwrap_or("unknown");

        debug!("ingesting rsvp: {}", uri);

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

        sqlx::query!(
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
            &message.did,
            commit.rkey,
            subject_uri,
            subject_cid,
            rsvp.status.as_ref(),
        )
        .execute(&self.pool)
        .await?;

        info!("ingested rsvp: {}", uri);
        Ok(())
    }
}

/// Ingests actor profiles into the database
pub struct ProfileIngestor {
    pool: PgPool,
}

impl ProfileIngestor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LexiconIngestor for ProfileIngestor {
    async fn ingest(&self, message: JetstreamEvent<Value>) -> Result<()> {
        let Some(commit) = message.commit else {
            return Ok(());
        };

        let Some(record) = commit.record else {
            return Ok(());
        };

        let profile = value::from_json_value::<lex_rs::co_aktivi::actor::profile::Profile>(record)?;
        debug!("ingesting profile: {}", message.did);

        sqlx::query!(
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
            &message.did,
            profile.display_name.as_ref().map(|n| n.as_ref()),
            profile.description.as_ref().map(|d| d.as_ref()),
            profile.avatar.as_ref().map(|_| "blob_ref"), // TODO: handle blob refs properly
            profile.banner.as_ref().map(|_| "blob_ref"), // TODO: handle blob refs properly
        )
        .execute(&self.pool)
        .await?;

        info!("ingested profile: {}", message.did);
        Ok(())
    }
}

/// Ingests identity events (handle changes) into the database
/// Only updates handles for profiles we already have
pub struct IdentityIngestor {
    pool: PgPool,
}

impl IdentityIngestor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LexiconIngestor for IdentityIngestor {
    async fn ingest(&self, message: JetstreamEvent<Value>) -> Result<()> {
        let Some(identity) = message.identity else {
            return Ok(());
        };

        let Some(handle) = identity.handle else {
            return Ok(());
        };

        // validate handle format
        if !is_valid_handle(&handle) {
            warn!("invalid handle format for {}: {}", identity.did, handle);
            return Ok(());
        }

        // only update if profile already exists
        let result = sqlx::query!(
            r#"
            INSERT INTO identities (did, handle, seq)
            SELECT $1, $2, $3
            WHERE EXISTS (SELECT 1 FROM profiles WHERE did = $1)
            ON CONFLICT (did) DO UPDATE SET
                handle = EXCLUDED.handle,
                seq = EXCLUDED.seq,
                updated_at = NOW()
            WHERE identities.seq < EXCLUDED.seq
            "#,
            &identity.did,
            &handle,
            identity.seq as i64,
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            info!("updated handle for {}: {}", identity.did, handle);
        }

        Ok(())
    }
}

/// Ingests account events (status changes) into the database
/// Only updates accounts for profiles we already have
pub struct AccountIngestor {
    pool: PgPool,
}

impl AccountIngestor {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl LexiconIngestor for AccountIngestor {
    async fn ingest(&self, message: JetstreamEvent<Value>) -> Result<()> {
        let Some(account) = message.account else {
            return Ok(());
        };

        use rocketman::types::event::AccountStatus;

        let account_status = match account.status {
            Some(AccountStatus::Activated) => "active",
            Some(AccountStatus::TakenDown) => "suspended",
            Some(AccountStatus::Suspended) => "suspended",
            Some(AccountStatus::Deleted) => "deleted",
            Some(AccountStatus::Deactivated) => "deactivated",
            None => "active",
        };

        // only update if profile already exists
        let result = sqlx::query!(
            r#"
            UPDATE profiles
            SET updated_at = NOW()
            WHERE did = $1
            "#,
            &account.did,
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            debug!(
                "updated account status for {}: {}",
                account.did, account_status
            );
        }

        Ok(())
    }
}

fn is_valid_handle(handle: &str) -> bool {
    // basic handle validation: lowercase alphanumeric with dots and hyphens
    // must not start or end with dot/hyphen
    // must be between 3 and 253 characters
    if handle.len() < 3 || handle.len() > 253 {
        return false;
    }

    if handle.starts_with('.')
        || handle.starts_with('-')
        || handle.ends_with('.')
        || handle.ends_with('-')
    {
        return false;
    }

    handle
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
}
