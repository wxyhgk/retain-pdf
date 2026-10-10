-- 多设备同步(retain-data::sync)的本地记账。
--
-- - sync_dirty:书库表的增删改由下面的触发器记成「哪个实体变了」(去重,只留最后
--   一次变化时刻);同步时据此导出,不需要业务代码各处记得通知同步。API、jobsd、
--   任何直接写库的进程改的都记得到。
-- - sync_apply_guard:应用别的设备的改动时在事务里放一行,触发器看到它就不记,
--   免得把收到的改动当成本机改动再发出去。
-- - sync_entities / sync_entity_files:每个实体最后一次导出或应用后的状态:时钟、
--   内容摘要、当时的内容与每个字段的时钟(按字段合并用),以及它管理的文件(删除或
--   替换时只动这些文件,其它文件一概不碰)。
-- - 其余:设备身份与时钟、读别的设备改动记录读到哪、等依赖到齐的改动、文件哈希缓存。
CREATE TABLE sync_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE sync_dirty (
    kind       TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    PRIMARY KEY(kind, entity_key)
);
CREATE TABLE sync_apply_guard (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1)
);
CREATE TABLE sync_entities (
    kind       TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    clock      TEXT NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    digest     TEXT NOT NULL DEFAULT '',
    base_json  TEXT NOT NULL DEFAULT '',
    clocks_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY(kind, entity_key)
);
CREATE TABLE sync_entity_files (
    kind       TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    path       TEXT NOT NULL,
    sha256     TEXT NOT NULL,
    PRIMARY KEY(kind, entity_key, path)
);
CREATE INDEX idx_sync_entity_files_path ON sync_entity_files(path);
CREATE TABLE sync_cursors (
    device_id TEXT PRIMARY KEY,
    segment   INTEGER NOT NULL
);
CREATE TABLE sync_pending (
    kind        TEXT NOT NULL,
    entity_key  TEXT NOT NULL,
    clock       TEXT NOT NULL,
    record_json TEXT NOT NULL,
    reason      TEXT NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(kind, entity_key)
);
CREATE TABLE sync_file_cache (
    path     TEXT PRIMARY KEY,
    size     INTEGER NOT NULL,
    mtime_ns INTEGER NOT NULL,
    sha256   TEXT NOT NULL
);
CREATE TRIGGER sync_dirty_uploads_insert AFTER INSERT ON uploads
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('upload', NEW.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_uploads_update AFTER UPDATE ON uploads
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('upload', NEW.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_uploads_delete AFTER DELETE ON uploads
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('upload', OLD.upload_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_documents_insert AFTER INSERT ON documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_documents_update AFTER UPDATE ON documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_documents_delete AFTER DELETE ON documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_document_title_state_insert AFTER INSERT ON document_title_state
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_document_title_state_update AFTER UPDATE ON document_title_state
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_document_title_state_delete AFTER DELETE ON document_title_state
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('document', OLD.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collections_insert AFTER INSERT ON collections
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection', NEW.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collections_update AFTER UPDATE ON collections
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection', NEW.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collections_delete AFTER DELETE ON collections
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection', OLD.collection_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collection_documents_insert AFTER INSERT ON collection_documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', NEW.collection_id || '|' || NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collection_documents_update AFTER UPDATE ON collection_documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', NEW.collection_id || '|' || NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_collection_documents_delete AFTER DELETE ON collection_documents
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('collection_member', OLD.collection_id || '|' || OLD.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_favorites_insert AFTER INSERT ON favorites
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('favorite', NEW.favorite_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_favorites_update AFTER UPDATE ON favorites
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('favorite', NEW.favorite_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_favorites_delete AFTER DELETE ON favorites
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('favorite', OLD.favorite_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_jobs_insert AFTER INSERT ON jobs
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_jobs_update AFTER UPDATE ON jobs
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_jobs_delete AFTER DELETE ON jobs
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_artifacts_insert AFTER INSERT ON artifacts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_artifacts_update AFTER UPDATE ON artifacts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_artifacts_delete AFTER DELETE ON artifacts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_job_artifact_entries_insert AFTER INSERT ON job_artifact_entries
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_job_artifact_entries_update AFTER UPDATE ON job_artifact_entries
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_job_artifact_entries_delete AFTER DELETE ON job_artifact_entries
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_attempts_insert AFTER INSERT ON pipeline_attempts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_attempts_update AFTER UPDATE ON pipeline_attempts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_attempts_delete AFTER DELETE ON pipeline_attempts
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_stages_insert AFTER INSERT ON pipeline_stages
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_stages_update AFTER UPDATE ON pipeline_stages
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_stages_delete AFTER DELETE ON pipeline_stages
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_units_insert AFTER INSERT ON pipeline_units
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_units_update AFTER UPDATE ON pipeline_units
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_units_delete AFTER DELETE ON pipeline_units
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_dispatches_insert AFTER INSERT ON pipeline_dispatches
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_dispatches_update AFTER UPDATE ON pipeline_dispatches
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_pipeline_dispatches_delete AFTER DELETE ON pipeline_dispatches
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_events_insert AFTER INSERT ON events
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_events_update AFTER UPDATE ON events
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', NEW.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
CREATE TRIGGER sync_dirty_events_delete AFTER DELETE ON events
WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
BEGIN
    INSERT INTO sync_dirty(kind, entity_key, changed_at)
    VALUES('job', OLD.job_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
END;
