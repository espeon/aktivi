# aktivi

an events platform for the AT Protocol, built on the community.lexicon.calendar schema.

aktivi indexes calendar events from the AT Protocol network and provides a web interface to discover and browse upcoming events. users can sign in with their Bluesky accounts via OAuth to view events created by people across the atmosphere.

## quick start

### prerequisites

- rust 1.75+
- node 20+
- postgresql 14+

### setup

1. start postgres:

```bash
docker run -d \
  --name aktivi-db \
  -e POSTGRES_USER=aktivi \
  -e POSTGRES_PASSWORD=aktivi \
  -e POSTGRES_DB=aktivi \
  -p 5433:5432 \
  postgres:14
```

2. set up the backend:

```bash
cd backend
cargo build --release
```

3. configure environment (backend/.env):

```bash
DATABASE_URL=postgres://aktivi:aktivi@localhost:5433/aktivi
```

4. run migrations:

```bash
cd backend
sqlx migrate run
```

5. start the backend:

```bash
cd backend
cargo run
```

6. set up the frontend:

```bash
cd frontend
npm install
npm run dev
```

7. open http://localhost:5173

## architecture

### backend (rust)

- **axum** web server with XRPC endpoints
- **sqlx** for postgres with compile-time query verification
- **jetstream** consumer for realtime event ingestion
- **jacquard** framework for AT Protocol lexicons
- **repo-stream** for parsing CAR files during backfill

### frontend (typescript)

- **react** with tanstack router
- **@atcute/client** for XRPC calls
- **@atcute/oauth-browser-client** for AT Protocol OAuth
- **tailwind + shadcn/ui** for styling

## CLI tools

backfill events from specific users:

```bash
cd backend
cargo run --bin aktivi-cli -- backfill <did>
```

## lexicons

event types are defined in `lex/community.lexicon.calendar.*.json`:
- `event` - calendar events with name, description, datetime, location
- `rsvp` - user responses to events (going, interested, not going)

## development

backend:
```bash
cd backend
cargo check
cargo run
```

frontend:
```bash
cd frontend
npm run dev
```

## license

MIT
