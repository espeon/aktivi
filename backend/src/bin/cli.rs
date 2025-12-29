use aktivi::backfill;
use anyhow::Result;
use clap::{Parser, Subcommand};
use futures::stream::{self, StreamExt};
use sqlx::postgres::PgPoolOptions;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tracing::{error, info};

#[derive(Parser)]
#[command(name = "aktivi-cli")]
#[command(about = "aktivi management CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Import a user's calendar data from their PDS
    Import {
        /// The DID of the user to import
        #[arg(short, long)]
        did: String,
    },
    /// Full backfill of all users with calendar data
    FullBackfill {
        /// Collection to backfill (defaults to event collection)
        #[arg(short, long)]
        collection: Option<String>,
        /// Number of concurrent backfills
        #[arg(short = 'n', long, default_value = "10")]
        concurrency: usize,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "aktivi=info,chulla_cli=info".into()),
        )
        .init();

    let cli = Cli::parse();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://aktivi:aktivi@localhost:5433/aktivi".to_string());

    info!("connecting to database");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    match cli.command {
        Commands::Import { did } => {
            info!("importing calendar data for {}", did);
            backfill::backfill_user(&did, &pool).await?;
            info!("import complete");
        }
        Commands::FullBackfill {
            collection,
            concurrency,
        } => {
            let collection =
                collection.unwrap_or_else(|| "community.lexicon.calendar.rsvp".to_string());
            info!("starting full backfill for collection: {}", collection);
            info!("concurrency: {}", concurrency);

            let dids = backfill::fetch_all_dids(&collection).await?;
            info!("found {} DIDs to backfill", dids.len());

            let pool = Arc::new(pool);
            let success_count = Arc::new(AtomicUsize::new(0));
            let error_count = Arc::new(AtomicUsize::new(0));
            let total = dids.len();

            stream::iter(dids)
                .map(|did| {
                    let pool = pool.clone();
                    let success_count = success_count.clone();
                    let error_count = error_count.clone();

                    async move {
                        if did == "did:plc:vsnj4aaxyatiht4spdht2q2t" {
                            // skip known bad DID
                            info!("skipping backfill for specified excluded DID: {}", did);
                        }
                        match backfill::backfill_user(&did, &pool).await {
                            Ok(_) => {
                                let successes = success_count.fetch_add(1, Ordering::SeqCst) + 1;
                                let errors = error_count.load(Ordering::SeqCst);
                                info!(
                                    "backfill complete for {} ({}/{} succeeded, {} failed)",
                                    did, successes, total, errors
                                );
                            }
                            Err(e) => {
                                let errors = error_count.fetch_add(1, Ordering::SeqCst) + 1;
                                let successes = success_count.load(Ordering::SeqCst);
                                error!(
                                    "backfill failed for {}: {} ({}/{} succeeded, {} failed)",
                                    did, e, successes, total, errors
                                );
                            }
                        }
                    }
                })
                .buffer_unordered(concurrency)
                .collect::<Vec<_>>()
                .await;

            let final_success = success_count.load(Ordering::SeqCst);
            let final_errors = error_count.load(Ordering::SeqCst);
            info!(
                "full backfill complete: {} succeeded, {} failed out of {} total",
                final_success, final_errors, total
            );
        }
    }

    Ok(())
}
