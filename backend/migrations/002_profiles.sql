-- profiles table - stores user profile data
CREATE TABLE IF NOT EXISTS profiles (
    id BIGSERIAL PRIMARY KEY,
    did TEXT UNIQUE NOT NULL,

    -- profile fields from app.bsky.actor.profile
    display_name TEXT,
    description TEXT,
    avatar TEXT,
    banner TEXT,

    -- metadata
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_did ON profiles(did);
