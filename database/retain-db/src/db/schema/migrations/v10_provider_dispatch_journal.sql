-- external provider dispatch journal. The intent is committed before
-- a non-idempotent OCR submit; a provider handle is a separate receipt.
-- A surviving intent without a receipt is ambiguous and must not be
-- automatically replayed after runtime restart.
CREATE TABLE IF NOT EXISTS pipeline_dispatches (
    job_id              TEXT NOT NULL,
    attempt             INTEGER NOT NULL,
    stage_key           TEXT NOT NULL,
    dispatch_key        TEXT NOT NULL,
    generation          INTEGER NOT NULL,
    provider            TEXT NOT NULL,
    operation           TEXT NOT NULL,
    request_hash        TEXT NOT NULL,
    status              TEXT NOT NULL,
    receipt_json        TEXT,
    ambiguity_reason    TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    receipted_at        TEXT,
    PRIMARY KEY(job_id, attempt, dispatch_key),
    FOREIGN KEY(job_id, attempt)
        REFERENCES pipeline_attempts(job_id, attempt) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pipeline_dispatch_status
    ON pipeline_dispatches(job_id, attempt, status, stage_key);
