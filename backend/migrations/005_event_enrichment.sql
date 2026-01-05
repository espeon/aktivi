-- Create event enrichment table for sidecar data
CREATE TABLE IF NOT EXISTS event_enrichment (
    uri TEXT PRIMARY KEY NOT NULL,
    cid TEXT NOT NULL,
    event_uri TEXT NOT NULL,
    style JSONB,
    avatar JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on event_uri for quick lookups
CREATE INDEX IF NOT EXISTS idx_event_enrichment_event_uri ON event_enrichment(event_uri);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_enrichment_timestamp_update
BEFORE UPDATE ON event_enrichment
FOR EACH ROW
EXECUTE FUNCTION update_event_enrichment_timestamp();
