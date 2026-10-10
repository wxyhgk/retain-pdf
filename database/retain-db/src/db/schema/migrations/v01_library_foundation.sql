-- 图书馆地基 —— 文档一等公民 + 锚点收藏 + 合集/标签 + FTS5
CREATE TABLE IF NOT EXISTS documents (
    document_id     TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    authors_json    TEXT NOT NULL DEFAULT '[]',
    year            INTEGER,
    doi             TEXT NOT NULL DEFAULT '',
    source_filename TEXT NOT NULL,
    page_count      INTEGER NOT NULL DEFAULT 0,
    bytes           INTEGER NOT NULL DEFAULT 0,
    active_job_id   TEXT,
    reading_status  TEXT NOT NULL DEFAULT 'unread',
    added_at        TEXT NOT NULL,
    last_opened_at  TEXT,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_added_at ON documents(added_at DESC);
CREATE TABLE IF NOT EXISTS favorites (
    favorite_id     TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    job_id          TEXT NOT NULL,
    page_idx        INTEGER NOT NULL,
    block_id        TEXT NOT NULL,
    char_start      INTEGER,
    char_end        INTEGER,
    kind            TEXT NOT NULL DEFAULT 'sentence',
    quote_text      TEXT NOT NULL,
    translated_quote_text TEXT NOT NULL DEFAULT '',
    note            TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_favorites_document ON favorites(document_id, page_idx);
CREATE TABLE IF NOT EXISTS collections (
    collection_id   TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    parent_id       TEXT REFERENCES collections(collection_id) ON DELETE SET NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_documents (
    collection_id   TEXT NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    added_at        TEXT NOT NULL,
    PRIMARY KEY(collection_id, document_id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
    document_id UNINDEXED, job_id UNINDEXED, page_idx UNINDEXED, block_id UNINDEXED,
    source_text, translated_text,
    tokenize='trigram'
);
