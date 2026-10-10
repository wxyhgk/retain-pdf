-- favorites.job_id 外键硬约束（与应用层 books.rs 409 语义一致 ON DELETE RESTRICT）
PRAGMA foreign_keys=OFF;
CREATE TABLE favorites_new (
    favorite_id     TEXT PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    job_id          TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE RESTRICT,
    page_idx        INTEGER NOT NULL,
    block_id        TEXT NOT NULL,
    char_start      INTEGER,
    char_end        INTEGER,
    kind            TEXT NOT NULL DEFAULT 'sentence',
    quote_text      TEXT NOT NULL,
    translated_quote_text TEXT NOT NULL DEFAULT '',
    note            TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    asset_id        TEXT NOT NULL DEFAULT '',
    rect_json       TEXT NOT NULL DEFAULT ''
);
INSERT INTO favorites_new (favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, created_at, updated_at, asset_id, rect_json)
    SELECT favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, created_at, updated_at, asset_id, rect_json FROM favorites;
DROP TABLE favorites;
ALTER TABLE favorites_new RENAME TO favorites;
CREATE INDEX IF NOT EXISTS idx_favorites_document ON favorites(document_id, page_idx);
PRAGMA foreign_keys=ON;
