-- identities table - stores handle/did mappings from identity events
CREATE TABLE IF NOT EXISTS identities (
    id BIGSERIAL PRIMARY KEY,
    did TEXT UNIQUE NOT NULL,
    handle TEXT NOT NULL,

    -- metadata
    seq BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identities_did ON identities(did);
CREATE INDEX IF NOT EXISTS idx_identities_handle ON identities(handle);
