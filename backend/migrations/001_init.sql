-- events table - stores calendar events
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    uri TEXT UNIQUE NOT NULL,
    cid TEXT NOT NULL,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,

    -- event fields
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    mode TEXT, -- hybrid, inperson, virtual
    status TEXT, -- cancelled, planned, postponed, rescheduled, scheduled
    locations JSONB, -- array of location objects
    uris JSONB, -- array of uri objects

    -- metadata
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_did ON events(did);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_uri ON events(uri);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- rsvps table - stores event RSVPs
CREATE TABLE IF NOT EXISTS rsvps (
    id BIGSERIAL PRIMARY KEY,
    uri TEXT UNIQUE NOT NULL,
    cid TEXT NOT NULL,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,

    -- rsvp fields (subject is a strongRef to the event)
    subject_uri TEXT NOT NULL,
    subject_cid TEXT NOT NULL,
    status TEXT NOT NULL, -- interested, going, notgoing

    -- metadata
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_did ON rsvps(did);
CREATE INDEX IF NOT EXISTS idx_rsvps_subject_uri ON rsvps(subject_uri);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON rsvps(status);

-- jetstream cursor tracking
CREATE TABLE IF NOT EXISTS jetstream_cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cursor_value BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
