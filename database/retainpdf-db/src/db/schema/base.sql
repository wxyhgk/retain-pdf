-- 最早的几张表（任务系统那一批：上传、任务、任务产物、产物登记、事件、术语表）的建表，幂等，每次开库都跑。
-- 新表、新列一律走编号迁移（migrations/），不要往这里加。这里是这几张表在新库上的起点，后来的列在编号迁移里加；
-- 很老的库缺的 jobs.document_id 由 schema/mod.rs 的 LEGACY_COLUMNS 补。
-- 现在每张表的完整样子看 database/retainpdf-db/schema.sql（测试生成的快照）。
-- 开头两行 PRAGMA：新库建表前切到增量收缩（老库要经 `retainpdf compact`，见 db/maintenance.rs）、WAL。
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS uploads (
    upload_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    page_count INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    developer_mode INTEGER NOT NULL,
    content_hash TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    workflow TEXT NOT NULL,
    status_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    upload_id TEXT,
    pid INTEGER,
    command_json TEXT NOT NULL,
    request_json TEXT NOT NULL,
    error TEXT,
    stage TEXT,
    stage_detail TEXT,
    progress_current INTEGER,
    progress_total INTEGER,
    log_tail_json TEXT NOT NULL,
    result_json TEXT,
    runtime_json TEXT,
    failure_json TEXT,
    document_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);
CREATE TABLE IF NOT EXISTS artifacts (
    job_id TEXT PRIMARY KEY,
    artifacts_json TEXT NOT NULL,
    FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id);
CREATE TABLE IF NOT EXISTS job_artifact_entries (
    job_id TEXT NOT NULL,
    artifact_key TEXT NOT NULL,
    artifact_group TEXT NOT NULL,
    artifact_kind TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_name TEXT,
    content_type TEXT NOT NULL,
    ready INTEGER NOT NULL,
    size_bytes INTEGER,
    checksum TEXT,
    source_stage TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(job_id, artifact_key),
    FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_job_artifact_entries_job_id ON job_artifact_entries(job_id);
CREATE TABLE IF NOT EXISTS events (
    job_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    ts TEXT NOT NULL,
    level TEXT NOT NULL,
    stage TEXT,
    stage_detail TEXT,
    provider TEXT,
    provider_stage TEXT,
    event TEXT NOT NULL,
    event_type TEXT,
    progress_current INTEGER,
    progress_total INTEGER,
    payload_json TEXT,
    retry_count INTEGER,
    elapsed_ms INTEGER,
    message TEXT NOT NULL,
    PRIMARY KEY(job_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_events_job_seq ON events(job_id, seq);
CREATE TABLE IF NOT EXISTS glossaries (
    glossary_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_lang TEXT NOT NULL DEFAULT '',
    target_lang TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    entries_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glossaries_updated_at ON glossaries(updated_at DESC);
