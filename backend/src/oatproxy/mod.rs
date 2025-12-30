use jacquard::url;
use miette::IntoDiagnostic;
use sqlx::PgPool;

mod store;

pub async fn oat(db: PgPool) -> miette::Result<axum::Router> {
    use jacquard_oatproxy::{OAuthProxyServer, ProxyConfig};
    use store::PgStore;

    let signing_key =
        match sqlx::query!("SELECT private_key FROM oatproxy_signing_key WHERE id = 1 LIMIT 1")
            .fetch_optional(&db)
            .await
            .into_diagnostic()?
        {
            Some(row) => {
                let key_bytes: Vec<u8> = row.private_key;
                let key_array: [u8; 32] = key_bytes
                    .try_into()
                    .map_err(|_| miette::miette!("invalid signing key length"))?;
                Some(p256::ecdsa::SigningKey::from_bytes(&key_array.into()).into_diagnostic()?)
            }
            None => {
                let signing_key = p256::ecdsa::SigningKey::random(&mut rand::rngs::OsRng);
                let key_bytes = signing_key.to_bytes();

                sqlx::query!(
                    "INSERT INTO oatproxy_signing_key (id, private_key) VALUES (1, $1)",
                    &key_bytes[..]
                )
                .execute(&db)
                .await
                .into_diagnostic()?;

                Some(signing_key)
            }
        };

    let hmac_secret =
        match sqlx::query!("SELECT hmac_secret FROM oatproxy_dpop_hmac_secret WHERE id = 1")
            .fetch_optional(&db)
            .await
            .into_diagnostic()?
        {
            Some(row) => {
                let secret_bytes: Vec<u8> = row.hmac_secret;
                let secret_array: [u8; 32] = secret_bytes
                    .try_into()
                    .map_err(|_| miette::miette!("invalid HMAC secret length"))?;
                secret_array.to_vec()
            }
            None => {
                let mut secret = vec![0u8; 32];
                rand::RngCore::fill_bytes(&mut rand::rngs::OsRng, &mut secret);

                sqlx::query!(
                    "INSERT INTO oatproxy_dpop_hmac_secret (id, hmac_secret) VALUES (1, $1)",
                    &secret[..]
                )
                .execute(&db)
                .await
                .into_diagnostic()?;

                secret
            }
        };

    let builder = PgStore::builder(db.clone());

    let builder = if let Some(signing_key) = signing_key {
        builder.with_signing_key(signing_key)
    } else {
        builder
    };

    let store = builder.build();

    let mut proxy_config = ProxyConfig::new(
        url::Url::parse(
            &std::env::var("OATPROXY_UPSTREAM_URL")
                .expect("OATPROXY_UPSTREAM_URL is in the environment"),
        )
        .expect("OATPROXY_UPSTREAM_URL is a valid URL"),
    )
    .with_dpop_nonce_secret(hmac_secret);

    // Configure upstream client metadata via env vars
    if let Ok(client_name) = std::env::var("ISTAT_CLIENT_NAME") {
        proxy_config = proxy_config.with_client_name(client_name);
    }

    if let Ok(tos_uri) = std::env::var("ISTAT_TOS_URI") {
        if let Ok(uri) = url::Url::parse(&tos_uri) {
            proxy_config = proxy_config.with_tos_uri(uri);
        }
    }

    if let Ok(logo_uri) = std::env::var("ISTAT_LOGO_URI") {
        if let Ok(uri) = url::Url::parse(&logo_uri) {
            proxy_config = proxy_config.with_logo_uri(uri);
        }
    }

    if let Ok(policy_uri) = std::env::var("ISTAT_POLICY_URI") {
        if let Ok(uri) = url::Url::parse(&policy_uri) {
            proxy_config = proxy_config.with_policy_uri(uri);
        }
    }

    let proxy = OAuthProxyServer::builder()
        .config(proxy_config)
        .session_store(store.clone())
        .key_store(store.clone())
        .build()
        .expect("failed to build OAuth proxy server");
    Ok(proxy.router())
}
