-- authoritative durable pipeline state. A generation is a fencing
-- token: every accepted transition advances it, so a worker superseded by
-- restart or a concurrent claimant cannot publish stale checkpoints.
CREATE TABLE IF NOT EXISTS pipeline_attempts (
    job_id          TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    attempt         INTEGER NOT NULL,
    generation      INTEGER NOT NULL,
    status          TEXT NOT NULL,
    worker_id       TEXT NOT NULL,
    current_stage   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    finished_at     TEXT,
    PRIMARY KEY(job_id, attempt)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_attempt_generation
    ON pipeline_attempts(job_id, attempt, generation);
CREATE INDEX IF NOT EXISTS idx_pipeline_attempt_status
    ON pipeline_attempts(status, updated_at);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    job_id                    TEXT NOT NULL,
    attempt                   INTEGER NOT NULL,
    stage_key                 TEXT NOT NULL,
    stage_order               INTEGER NOT NULL,
    generation                INTEGER NOT NULL,
    status                    TEXT NOT NULL,
    last_committed_unit_key   TEXT,
    last_committed_unit_order INTEGER,
    last_page_hash            TEXT,
    created_at                TEXT NOT NULL,
    updated_at                TEXT NOT NULL,
    finished_at               TEXT,
    PRIMARY KEY(job_id, attempt, stage_key),
    FOREIGN KEY(job_id, attempt)
        REFERENCES pipeline_attempts(job_id, attempt) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_status
    ON pipeline_stages(job_id, attempt, status, stage_order);

CREATE TABLE IF NOT EXISTS pipeline_units (
    job_id              TEXT NOT NULL,
    attempt             INTEGER NOT NULL,
    stage_key           TEXT NOT NULL,
    unit_key            TEXT NOT NULL,
    unit_order          INTEGER NOT NULL,
    generation          INTEGER NOT NULL,
    producer_generation INTEGER,
    status              TEXT NOT NULL,
    page_index          INTEGER,
    page_hash           TEXT NOT NULL,
    payload_json        TEXT NOT NULL DEFAULT '{}',
    committed_at        TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    PRIMARY KEY(job_id, attempt, stage_key, unit_key),
    FOREIGN KEY(job_id, attempt, stage_key)
        REFERENCES pipeline_stages(job_id, attempt, stage_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pipeline_unit_order
    ON pipeline_units(job_id, attempt, stage_key, unit_order);
