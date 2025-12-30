use aktivi::{jetstream::JetstreamConsumer, oatproxy, xrpc, AppState};
use axum::Router;
use jacquard_axum::IntoRouter;
use lex_rs::co_aktivi::{
    actor::{
        get_events::GetEventsRequest as ActorGetEventsRequest,
        get_profile_view::GetProfileViewRequest,
        get_rsv_ps::GetRsvPsRequest as ActorGetRsvPsRequest, get_timeline::GetTimelineRequest,
    },
    event::{
        get_event_view::GetEventViewRequest, get_events::GetEventsRequest as EventGetEventsRequest,
        get_rsv_ps::GetRsvPsRequest as EventGetRsvPsRequest,
    },
    search::get_search_results::GetSearchResultsRequest,
};
use miette::IntoDiagnostic;
use moka::future::Cache;
use sqlx::postgres::PgPoolOptions;
use std::{sync::Arc, time::Duration};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;

#[tokio::main]
async fn main() -> miette::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aktivi=debug,tower_http=debug".into()),
        )
        .init();

    info!("okie!");

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://aktivi:aktivi@localhost:5433/aktivi".to_string());
    let public_url =
        std::env::var("PUBLIC_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let bind_addr = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0:3000".to_string());

    info!("connecting to database: {}", database_url);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .into_diagnostic()?;

    info!("running migrations");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .into_diagnostic()?;

    let oat = oatproxy::oat(pool.clone()).await?;

    let token_manager = Arc::new(jacquard_oatproxy::TokenManager::new(public_url.to_owned()));

    // create caches with 1 hour TTL
    let profile_cache = Cache::builder()
        .max_capacity(10_000)
        .time_to_live(Duration::from_secs(3600))
        .build();

    let handle_validity_cache = Cache::builder()
        .max_capacity(50_000)
        .time_to_live(Duration::from_secs(3600))
        .build();

    let state = Arc::new(AppState {
        pool: pool.clone(),
        profile_cache,
        handle_validity_cache,
        token_manager,
    });

    // spawn jetstream consumer in background
    let jetstream_pool = pool.clone();
    tokio::spawn(async move {
        let consumer = JetstreamConsumer::new(
            "wss://jetstream2.us-east.bsky.network/subscribe".to_string(),
            jetstream_pool.clone(),
        );

        loop {
            if let Err(e) = consumer.consume().await {
                tracing::error!("jetstream consumer error: {}", e);
                tracing::info!("reconnecting in 5 seconds...");
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    });

    let xrpc_router = Router::new()
        .merge(EventGetEventsRequest::into_router(xrpc::get_events::handle))
        .merge(GetSearchResultsRequest::into_router(xrpc::search::handle))
        .merge(GetEventViewRequest::into_router(
            xrpc::get_event_view::handle,
        ))
        .merge(ActorGetEventsRequest::into_router(
            xrpc::actor_get_events::handle,
        ))
        .merge(ActorGetRsvPsRequest::into_router(xrpc::get_rsv_ps::handle))
        .merge(EventGetRsvPsRequest::into_router(
            xrpc::event_get_rsv_ps::handle,
        ))
        .merge(GetProfileViewRequest::into_router(
            xrpc::get_profile_view::handle,
        ))
        .merge(GetTimelineRequest::into_router(
            xrpc::actor_get_timeline::handle,
        ))
        .with_state(state.clone())
        .merge(oat)
        .layer(CorsLayer::permissive());

    let app = Router::new()
        .merge(xrpc_router)
        .layer(TraceLayer::new_for_http());

    info!("listening on {}", bind_addr);

    let listener = tokio::net::TcpListener::bind(bind_addr)
        .await
        .into_diagnostic()?;
    axum::serve(listener, app).await.into_diagnostic()?;

    Ok(())
}
