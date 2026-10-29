CREATE TABLE trip_app.sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES trip_app.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_expires ON trip_app.sessions(expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_app.sessions TO trip_app_rw;
