-- durable, conversation-scoped calculation runs. Inputs are recorded
-- by reference and hash; generated files are an immutable, controlled
-- relative-path manifest committed atomically with successful completion.
CREATE TABLE IF NOT EXISTS agent_calculation_runs (
    calculation_id    TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
    request_message_id TEXT NOT NULL DEFAULT '',
    document_id       TEXT,
    job_id            TEXT,
    tool_name         TEXT NOT NULL,
    tool_call_id      TEXT NOT NULL DEFAULT '',
    input_refs_json   TEXT NOT NULL,
    input_sha256      TEXT NOT NULL,
    status            TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
    result_summary    TEXT,
    failure_summary   TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    finished_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_calculation_runs_conversation
    ON agent_calculation_runs(conversation_id, created_at DESC, calculation_id DESC);
CREATE INDEX IF NOT EXISTS idx_agent_calculation_runs_document
    ON agent_calculation_runs(document_id, created_at DESC)
    WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_calculation_runs_job
    ON agent_calculation_runs(job_id, created_at DESC)
    WHERE job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_calculation_artifacts (
    artifact_id       TEXT PRIMARY KEY,
    calculation_id    TEXT NOT NULL REFERENCES agent_calculation_runs(calculation_id) ON DELETE CASCADE,
    kind              TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    relative_path     TEXT NOT NULL,
    mime_type         TEXT NOT NULL,
    size_bytes        INTEGER NOT NULL CHECK(size_bytes >= 0),
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_calculation_artifacts_run
    ON agent_calculation_artifacts(calculation_id, artifact_id);
