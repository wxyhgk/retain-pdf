-- durable document metadata suggestions and title provenance.  The
-- suggestion is immutable evidence; application is a separate guarded
-- transition so a refresh or lost response cannot overwrite a user title.
CREATE TABLE IF NOT EXISTS document_title_state (
    document_id    TEXT PRIMARY KEY REFERENCES documents(document_id) ON DELETE CASCADE,
    source         TEXT NOT NULL DEFAULT 'filename'
                   CHECK(source IN ('filename', 'pdf_metadata', 'ocr', 'ai', 'user')),
    locked         INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0, 1)),
    suggestion_id  TEXT,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_metadata_suggestions (
    suggestion_id    TEXT PRIMARY KEY,
    document_id      TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    source_job_id    TEXT,
    artifact_sha256  TEXT NOT NULL,
    fields_json      TEXT NOT NULL DEFAULT '["title"]',
    candidates_json  TEXT NOT NULL,
    selected_title   TEXT NOT NULL,
    generation_method TEXT NOT NULL DEFAULT 'deterministic',
    needs_ai_review  INTEGER NOT NULL DEFAULT 0 CHECK(needs_ai_review IN (0, 1)),
    status           TEXT NOT NULL DEFAULT 'completed'
                     CHECK(status IN ('completed', 'applied')),
    applied_at       TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_metadata_suggestions_document
    ON document_metadata_suggestions(document_id, created_at DESC, suggestion_id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_metadata_suggestions_evidence
    ON document_metadata_suggestions(
        document_id,
        COALESCE(source_job_id, ''),
        artifact_sha256,
        selected_title
    );
