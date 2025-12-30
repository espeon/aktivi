pub mod backfill;
pub mod handle;
pub mod ingest;
pub mod jetstream;
pub mod oatproxy;
pub mod profile;
pub mod xrpc;

use moka::future::Cache;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub profile_cache: Cache<String, profile::ProfileRecord>,
    pub handle_validity_cache: Cache<String, bool>,
    pub token_manager: std::sync::Arc<jacquard_oatproxy::TokenManager>,
}
