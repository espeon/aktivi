# database setup and management

# database connection string
db_url := env_var_or_default("DATABASE_URL", "postgres://aktivi:aktivi@localhost:5433/aktivi")

# initialize the database with schema
db-init:
    cd backend && sqlx database create --database-url {{db_url}}
    cd backend && sqlx migrate run --database-url {{db_url}}
    @echo "database initialized"

# reset the database (drops and recreates)
db-reset:
    cd backend && sqlx database drop --database-url {{db_url}} -y || true
    just db-init
    @echo "database reset complete"

# run migrations
migrate:
    cd backend && sqlx migrate run --database-url {{db_url}}

# start docker services (postgres)
docker-up:
    docker compose up -d

# stop docker services
docker-down:
    docker compose down

# run the backend server
dev:
    cd backend && DATABASE_URL={{db_url}} cargo run

# prepare sqlx query metadata (run after schema changes)
sqlx-prepare:
    cd backend && DATABASE_URL={{db_url}} cargo sqlx prepare

# check backend code
check:
    cd backend && cargo check

# run tests
test:
    cd backend && cargo test

# import a user's calendar data
import DID:
    cd backend && DATABASE_URL={{db_url}} cargo run --bin aktivi-cli -- import --did {{DID}}

# clean build artifacts
clean:
    cd backend && cargo clean

# generate lexer code for Rust and TypeScript
lexgen:
    just lexgen-rs && just lexgen-ts

lexgen-rs-install:
    cargo install jacquard-lexgen

lexgen-rs:
    jacquard-codegen --input ./lex --output ./lex-rs

lexgen-ts:
    cd frontend && pnpm run lexgen

# backend command shortcuts

cli:
    cd backend && cargo run --bin aktivi-cli --

be:
    cd backend && cargo run --bin aktivi
