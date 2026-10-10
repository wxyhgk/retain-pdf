-- durable AI-invokable document operation control plane. Attempts keep
-- immutable manifest/state snapshots; events are append-only; candidate
-- document versions require an explicit compare-and-swap commit.
CREATE TABLE IF NOT EXISTS document_operations (
    operation_id       TEXT PRIMARY KEY,
    conversation_id    TEXT REFERENCES ai_conversations(conversation_id) ON DELETE SET NULL,
    request_message_id TEXT NOT NULL DEFAULT '',
    document_id        TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    base_job_id        TEXT NOT NULL,
    base_version_id    TEXT,
    intent_summary     TEXT NOT NULL,
    status             TEXT NOT NULL,
    current_attempt    INTEGER NOT NULL,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_operations_document
    ON document_operations(document_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_operations_status
    ON document_operations(status, updated_at);

CREATE TABLE IF NOT EXISTS document_operation_attempts (
    operation_id       TEXT NOT NULL REFERENCES document_operations(operation_id) ON DELETE CASCADE,
    attempt            INTEGER NOT NULL,
    dispatch_id        TEXT NOT NULL UNIQUE,
    program_sha256     TEXT NOT NULL,
    manifest_json      TEXT NOT NULL,
    state_json         TEXT NOT NULL,
    status             TEXT NOT NULL,
    dispatch_intent_at TEXT,
    dispatch_receipt_json TEXT,
    terminal_receipt_at TEXT,
    candidate_pdf_sha256 TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    PRIMARY KEY(operation_id, attempt)
);
CREATE INDEX IF NOT EXISTS idx_document_operation_attempts_status
    ON document_operation_attempts(status, updated_at);

CREATE TABLE IF NOT EXISTS document_operation_events (
    operation_id TEXT NOT NULL REFERENCES document_operations(operation_id) ON DELETE CASCADE,
    seq          INTEGER NOT NULL,
    attempt      INTEGER NOT NULL,
    ts           TEXT NOT NULL,
    event        TEXT NOT NULL,
    status       TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY(operation_id, seq)
);

CREATE TABLE IF NOT EXISTS document_versions (
    version_id       TEXT PRIMARY KEY,
    document_id      TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    base_version_id  TEXT REFERENCES document_versions(version_id) ON DELETE SET NULL,
    operation_id     TEXT NOT NULL UNIQUE REFERENCES document_operations(operation_id) ON DELETE CASCADE,
    source_job_id    TEXT NOT NULL DEFAULT '',
    artifact_key     TEXT NOT NULL,
    content_sha256   TEXT NOT NULL,
    status           TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    committed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_document_versions_document
    ON document_versions(document_id, created_at);

ALTER TABLE documents ADD COLUMN active_version_id TEXT;
