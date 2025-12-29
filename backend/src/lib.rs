pub mod backfill;
pub mod handle;
pub mod ingest;
pub mod jetstream;
pub mod oatproxy;
pub mod xrpc;

use moka::future::Cache;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub profile_cache: Cache<String, xrpc::get_events::ProfileRecord>,
    pub handle_validity_cache: Cache<String, bool>,
}
