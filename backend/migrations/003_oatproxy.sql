-- OAuth Proxy Tables

-- Pending authorization codes
CREATE TABLE IF NOT EXISTS oatproxy_pending_auths (
    code TEXT PRIMARY KEY,
    account_did TEXT NOT NULL,
    upstream_session_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    state TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Downstream client info (temporary storage during OAuth flow)
CREATE TABLE IF NOT EXISTS oatproxy_downstream_clients (
    did TEXT PRIMARY KEY,
    redirect_uri TEXT NOT NULL,
    state TEXT,
    response_type TEXT NOT NULL,
    scope TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- PAR (Pushed Authorization Request) data
CREATE TABLE IF NOT EXISTS oatproxy_par_data (
    request_uri TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    response_type TEXT NOT NULL,
    state TEXT,
    scope TEXT,
    code_challenge TEXT,
    code_challenge_method TEXT,
    login_hint TEXT,
    downstream_dpop_jkt TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Refresh token mappings
CREATE TABLE IF NOT EXISTS oatproxy_refresh_tokens (
    refresh_token TEXT PRIMARY KEY,
    account_did TEXT NOT NULL,
    session_id TEXT NOT NULL
);

-- Active session mappings (DID → session_id)
CREATE TABLE IF NOT EXISTS oatproxy_active_sessions (
    did TEXT PRIMARY KEY,
    session_id TEXT NOT NULL
);

-- Session DPoP keys (upstream PDS communication keys)
CREATE TABLE IF NOT EXISTS oatproxy_session_dpop_keys (
    session_id TEXT PRIMARY KEY,
    dpop_jkt TEXT NOT NULL,
    key_json TEXT NOT NULL
);

-- Session DPoP nonces (for retry logic)
CREATE TABLE IF NOT EXISTS oatproxy_session_dpop_nonces (
    session_id TEXT PRIMARY KEY,
    nonce TEXT NOT NULL
);

-- Used nonces (JTI replay protection)
CREATE TABLE IF NOT EXISTS oatproxy_used_nonces (
    jti TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- OAuth sessions (jacquard-oauth ClientAuthStore data)
CREATE TABLE IF NOT EXISTS oatproxy_oauth_sessions (
    did TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_data TEXT NOT NULL,
    PRIMARY KEY (did, session_id)
);

-- OAuth authorization requests (jacquard-oauth AuthRequestData)
CREATE TABLE IF NOT EXISTS oatproxy_auth_requests (
    state TEXT PRIMARY KEY,
    auth_req_data TEXT NOT NULL
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_oatproxy_pending_auths_expires
    ON oatproxy_pending_auths(expires_at);

CREATE INDEX IF NOT EXISTS idx_oatproxy_downstream_clients_expires
    ON oatproxy_downstream_clients(expires_at);

CREATE INDEX IF NOT EXISTS idx_oatproxy_par_data_expires
    ON oatproxy_par_data(expires_at);

CREATE INDEX IF NOT EXISTS idx_oatproxy_refresh_tokens_did
    ON oatproxy_refresh_tokens(account_did);

CREATE INDEX IF NOT EXISTS idx_oatproxy_used_nonces_created
    ON oatproxy_used_nonces(created_at);

-- Persisting the proxy signing key and HMAC secret
CREATE TABLE IF NOT EXISTS oatproxy_signing_key (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    private_key BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oatproxy_dpop_hmac_secret (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hmac_secret BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
