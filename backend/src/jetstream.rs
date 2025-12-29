use anyhow::Result;
use rocketman::{
    connection::JetstreamConnection,
    endpoints::{JetstreamEndpointLocations, JetstreamEndpoints},
    handler::{self, Ingestors},
    options::JetstreamOptions,
};
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
use tracing::{error, info};

use crate::ingest::{
    AccountIngestor, EventIngestor, IdentityIngestor, ProfileIngestor, RsvpIngestor,
};

const EVENT_COLLECTION: &str = "community.lexicon.calendar.event";
const RSVP_COLLECTION: &str = "community.lexicon.calendar.rsvp";
const PROFILE_COLLECTION: &str = "co.aktivi.actor.profile";

pub struct JetstreamConsumer {
    endpoint: JetstreamEndpoints,
    pool: PgPool,
}

impl JetstreamConsumer {
    pub fn new(endpoint: String, pool: PgPool) -> Self {
        let ws_url = if endpoint.starts_with("wss://") || endpoint.starts_with("ws://") {
            JetstreamEndpoints::Custom(endpoint)
        } else {
            JetstreamEndpoints::Public(JetstreamEndpointLocations::UsEast, 2)
        };

        Self {
            endpoint: ws_url,
            pool,
        }
    }

    pub async fn consume(&self) -> Result<()> {
        let opts = JetstreamOptions::builder()
            .ws_url(self.endpoint.clone())
            .wanted_collections(vec![
                EVENT_COLLECTION.to_string(),
                RSVP_COLLECTION.to_string(),
                PROFILE_COLLECTION.to_string(),
            ])
            .build();

        let jetstream = JetstreamConnection::new(opts);

        // create ingestors using the new Ingestors struct
        let mut ingestors = Ingestors::new();

        ingestors.commits.insert(
            EVENT_COLLECTION.to_string(),
            Box::new(EventIngestor::new(self.pool.clone())),
        );

        ingestors.commits.insert(
            RSVP_COLLECTION.to_string(),
            Box::new(RsvpIngestor::new(self.pool.clone())),
        );

        ingestors.commits.insert(
            PROFILE_COLLECTION.to_string(),
            Box::new(ProfileIngestor::new(self.pool.clone())),
        );

        // register identity ingestor for handle updates
        ingestors.identity = Some(Box::new(IdentityIngestor::new(self.pool.clone())));

        // register account ingestor for account status updates
        ingestors.account = Some(Box::new(AccountIngestor::new(self.pool.clone())));

        // tracks the last message we've processed
        let cursor: Arc<Mutex<Option<u64>>> = Arc::new(Mutex::new(None));

        // get channels
        let msg_rx = jetstream.get_msg_rx();
        let reconnect_tx = jetstream.get_reconnect_tx();

        info!("connecting to jetstream");

        // spawn a task to process messages from the queue
        let c_cursor = cursor.clone();
        tokio::spawn(async move {
            while let Ok(message) = msg_rx.recv_async().await {
                if let Err(e) = handler::handle_message(
                    message,
                    &ingestors,
                    reconnect_tx.clone(),
                    c_cursor.clone(),
                )
                .await
                {
                    error!("failed to process message: {}", e);
                }
            }
        });

        // connect to jetstream
        jetstream
            .connect(cursor.clone())
            .await
            .map_err(|e| anyhow::anyhow!("jetstream connection failed: {}", e))?;

        Ok(())
    }
}
