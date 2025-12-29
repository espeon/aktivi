use jacquard::url;
use sqlx::PgPool;

mod store;

pub fn oat(db: PgPool) -> axum::Router {
    use jacquard_oatproxy::{OAuthProxyServer, ProxyConfig};
    use store::PgStore;

    let builder = PgStore::builder(db.clone());

    let store = builder.build();

    let config = ProxyConfig::new(
        url::Url::parse(
            &std::env::var("OATPROXY_UPSTREAM_URL")
                .expect("OATPROXY_UPSTREAM_URL is in the environment"),
        )
        .expect("OATPROXY_UPSTREAM_URL is a valid URL"),
    );

    let proxy = OAuthProxyServer::builder()
        .config(config)
        .session_store(store.clone())
        .key_store(store.clone())
        .build()
        .expect("failed to build OAuth proxy server");

    proxy.router()
}
