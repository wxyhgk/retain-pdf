-- model execution journal. Never persist prompts, bearer tokens or
-- reasoning text. A dispatched request without a receipt is not replayable.
CREATE TABLE model_sessions (
    job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    profile_json TEXT NOT NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE model_operations (
    job_id TEXT NOT NULL REFERENCES model_sessions(job_id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','ambiguous','cancelled')),
    result_json TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(job_id, operation_id)
);
CREATE INDEX idx_model_operations_unit ON model_operations(job_id, unit_id);
CREATE INDEX idx_model_operations_status ON model_operations(status);
