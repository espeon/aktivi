# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

aktivi is a decentralized events platform built on the AT Protocol. It consists of a Rust backend (Axum web server) and a React/TypeScript frontend, with a shared lexicon system for type-safe AT Protocol records.

## Common Commands

### Development Workflow
```bash
# Start PostgreSQL
just docker-up

# Initialize database (first time only)
just db-init

# Run backend server
just dev

# Run frontend (in separate terminal)
cd frontend && npm run dev
```

### Database Management
```bash
just migrate              # Run migrations
just db-reset            # Drop and recreate database
just sqlx-prepare        # Update SQLx query metadata after schema changes
```

### Code Generation
```bash
just lexgen              # Generate both Rust and TypeScript types from lexicons
just lexgen-rs           # Generate Rust types only
just lexgen-ts           # Generate TypeScript types only
```

### Testing and Verification
```bash
just check               # Type-check backend
just test                # Run backend tests
cd frontend && npm run test  # Run frontend tests
```

### Data Import
```bash
just import <DID>        # Backfill events for a specific user
```

## Architecture

### Monorepo Structure

- **backend/** - Rust Axum web server with XRPC endpoints
- **frontend/** - React/TypeScript SPA with TanStack Router
- **lex/** - AT Protocol lexicon definitions (JSON schemas)
- **lex-rs/** - Generated Rust types (via jacquard-codegen)
- **frontend/src/lex/types/** - Generated TypeScript types (via @atcute/lex-cli)

### Custom Lexicons

The project defines custom AT Protocol lexicons in `lex/`:

- `community.lexicon.calendar.event` - Event records
- `community.lexicon.calendar.rsvp` - RSVP records
- `co.aktivi.actor.profile` - Actor profile extension
- `co.aktivi.meta.ootb` - Out-of-box experience metadata

**Lexicon Update Workflow:**
1. Edit `.json` files in `/lex`
2. Run `just lexgen` to generate Rust and TypeScript types
3. Run `cargo check` to verify Rust compilation
4. Update handlers/components to use new types

### Backend Architecture

**XRPC Endpoints** (`backend/src/xrpc/`):
- Each endpoint is a separate module with handler function
- Uses jacquard-axum for XRPC integration
- All endpoints follow pattern: `pub async fn handler(ctx: XrpcContext, params: Params) -> Result<Output>`

**Data Ingestion Flow:**
```
Jetstream (AT Protocol firehose)
    ↓
JetstreamConsumer (backend/src/jetstream.rs)
    ↓
Ingestors (backend/src/ingest.rs)
    ↓
PostgreSQL (events, rsvps, profiles, identities)
```

**Key Services:**
- `jetstream.rs` - Real-time firehose consumer
- `ingest.rs` - Record processors for different collection types
- `backfill.rs` - Historical data import from CAR files
- `oatproxy/` - OAuth proxy for downstream clients

### Frontend Architecture

**Routing:** TanStack Router with file-based routes in `frontend/src/routes/`

**Authentication:** 
- Uses `@atcute/oauth-browser-client` for OAuth 2.0 PKCE flow
- `QtProvider` context (`lib/qt.tsx`) manages authenticated client
- Auto session resumption from localStorage
- Token refresh every 45 minutes

**State Management:**
- React Context for auth state
- TanStack Query for server state
- Local state with `useState` for UI

**Styling:** Tailwind CSS 4.0 + shadcn/ui components

### Database Schema

**Key Tables:**
- `events` - Calendar events (indexed by `did`, `starts_at`, `uri`, `status`)
- `rsvps` - Event RSVPs (foreign key to events)
- `profiles` - Actor profiles (`co.aktivi.actor.profile` records)
- `identities` - DID → handle mappings
- `oatproxy_*` - OAuth session/token storage

**Migrations:** Located in `backend/migrations/`, run with `sqlx migrate run`

### OAuth Flow

1. Frontend initiates OAuth with `@atcute/oauth-browser-client`
2. User redirects to their PDS for authorization
3. Callback handled in `oauth.callback.tsx`
4. Backend `oatproxy` module proxies OAuth for downstream clients
5. Session tokens stored in PostgreSQL

## Development Notes

### Adding New XRPC Endpoints

1. Define lexicon in `lex/co.aktivi.<namespace>.<method>.json`
2. Run `just lexgen` to generate types
3. Create handler in `backend/src/xrpc/<namespace>/`
4. Register handler in `backend/src/xrpc/mod.rs`
5. Add SQL queries in handler (use `sqlx::query!` for compile-time verification)
6. Run `just sqlx-prepare` after adding queries

### Adding shadcn/ui Components

```bash
cd frontend
pnpm dlx shadcn@latest add <component>
```

### Working with SQLx

- All SQL queries use `sqlx::query!` macro for compile-time verification
- After modifying queries, run `just sqlx-prepare` to update metadata
- Database must be running and migrated for `cargo check` to pass

### Backfill System

The `backfill.rs` module fetches historical records:
1. Queries relay for DIDs with calendar records
2. Resolves PDS endpoints via PLC directory
3. Downloads CAR files using `repo-stream`
4. Parses records and inserts via ingestors

Run with: `cargo run --bin aktivi-cli -- backfill <did>`

## Environment Variables

**Backend** (`.env` or `DATABASE_URL` env var):
```
DATABASE_URL=postgres://aktivi:aktivi@localhost:5433/aktivi
```

**Frontend:** Vite auto-loads `.env` files (no vars currently required for dev)

<design_aesthetics>
You tend to converge toward generic, "on distribution" outputs. This creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive designs that surprise and delight.

Focus on:
- Typography: Use fonts intentionally. When a designer has chosen specific typefaces, use those consistently and leverage their distinctive qualities. Avoid defaulting to safe, overused choices (Inter, Roboto, Arial, Space Grotesk) across different contexts.
- Color & Theme: Commit to a cohesive aesthetic. Use available design tokens (CSS variables, theme systems) consistently. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from existing design systems and cultural aesthetics for inspiration.
- Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions when possible. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- Spatial Design: Create atmosphere and depth rather than defaulting to flat surfaces. Layer backgrounds thoughtfully, use patterns, add contextual effects that match the overall aesthetic.

Avoid generic outputs:
- Defaulting to overused choices across different projects
- Clichéd combinations (purple gradients on white, etc.)
- Predictable layouts that lack context-specific character
- Design decisions that feel unmotivated

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary your approaches. It's critical that you think about what actually fits this specific project, not what's safe or common.
</design_aesthetics>
