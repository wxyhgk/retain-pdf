use anyhow::Result;
use rusqlite::{Connection, Transaction, TransactionBehavior};

/// 图书馆数据层的编号迁移阶梯(PRAGMA user_version)。
///
/// 现有 ensure_schema 的幂等 DDL 与 ensure_*_column 增量加列继续负责
/// 任务系统的表;平台新表(documents/favorites/...)从这里走版本化
/// 迁移,后续破坏性变更只能追加新版本,不允许改历史条目。
/// 迁移阶梯当前版本数——测试用它做幂等断言，加迁移时无需再手改测试；备份据此判断
/// 结构要不要升级、一份备份是不是来自更新的版本。
pub(crate) fn versioned_migration_count() -> i64 {
    VERSIONED_MIGRATIONS.len() as i64
}

const VERSIONED_MIGRATIONS: &[&str] = &[
    // v1: 图书馆地基 —— 文档一等公民 + 锚点收藏 + 合集/标签 + FTS5
    r#"
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
    "#,
    // v2: 资产存储(内容寻址,收藏图片附件)+ AI 问答会话/消息。
    // 设计原则:用户策展(收藏)是硬锚点,机器生成(问答引用)是软锚点
    // ——引用只存 citations_json 快照,不做 job 删除保护。
    r#"
    CREATE TABLE IF NOT EXISTS assets (
        asset_id    TEXT PRIMARY KEY,          -- sha256(文件字节)
        mime        TEXT NOT NULL,
        bytes       INTEGER NOT NULL,
        width       INTEGER,
        height      INTEGER,
        created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
        conversation_id TEXT PRIMARY KEY,
        title           TEXT NOT NULL DEFAULT '',
        document_id     TEXT REFERENCES documents(document_id) ON DELETE SET NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);
    CREATE TABLE IF NOT EXISTS ai_messages (
        message_id      TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
        seq             INTEGER NOT NULL,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        citations_json  TEXT NOT NULL DEFAULT '[]',
        tool_trace_json TEXT NOT NULL DEFAULT '[]',
        model           TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL,
        UNIQUE(conversation_id, seq)
    );
    ALTER TABLE favorites ADD COLUMN asset_id  TEXT NOT NULL DEFAULT '';
    ALTER TABLE favorites ADD COLUMN rect_json TEXT NOT NULL DEFAULT '';
    "#,
    // v3: AI 消息树分支 —— parent_id 形成兄弟分支; head_id 记录当前可见叶。
    // 与 ChatGPT / assistant-ui 一致:同 parent 的多条 message 即 alternate。
    // 兼容:旧行 parent_id 为空,按 seq 串成线性链;load 时无 head 或 max(seq)。
    r#"
    ALTER TABLE ai_conversations ADD COLUMN head_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE ai_messages ADD COLUMN parent_id TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_ai_messages_parent
        ON ai_messages(conversation_id, parent_id);
    "#,
    // v4: favorites.job_id 外键硬约束（与应用层 books.rs 409 语义一致 ON DELETE RESTRICT）
    r#"
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
    "#,
    // v5: durable AI-invokable document operation control plane. Attempts keep
    // immutable manifest/state snapshots; events are append-only; candidate
    // document versions require an explicit compare-and-swap commit.
    r#"
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
    "#,
    // v6: durable adapter cursor for one agent runtime session per
    // conversation. The cursor is internal control-plane state and is not
    // exposed through the public conversation record. Revision provides a
    // compare-and-swap boundary when a crashed runtime and its replacement
    // race to publish a new session.
    r#"
    ALTER TABLE ai_conversations ADD COLUMN agent_runtime_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE ai_conversations ADD COLUMN agent_session_cursor TEXT NOT NULL DEFAULT '';
    ALTER TABLE ai_conversations ADD COLUMN agent_session_revision INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE ai_conversations ADD COLUMN agent_session_updated_at TEXT NOT NULL DEFAULT '';
    "#,
    // v7: a retry is a new immutable document-operation attempt. Persist the
    // request idempotency key on that attempt so a lost HTTP response cannot
    // turn one confirmed retry into multiple executor dispatches.
    r#"
    ALTER TABLE document_operation_attempts
        ADD COLUMN retry_idempotency_key TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_operation_attempt_retry_key
        ON document_operation_attempts(operation_id, retry_idempotency_key)
        WHERE retry_idempotency_key <> '';
    "#,
    // v8: authoritative durable pipeline state. A generation is a fencing
    // token: every accepted transition advances it, so a worker superseded by
    // restart or a concurrent claimant cannot publish stale checkpoints.
    r#"
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
    "#,
    // v9: the durable stage row also owns the latest worker observation.
    // Public progress events are emitted from this update transaction; the
    // worker JSONL remains a legacy/debug projection rather than state truth.
    r#"
    ALTER TABLE pipeline_stages ADD COLUMN raw_stage TEXT;
    ALTER TABLE pipeline_stages ADD COLUMN substage TEXT;
    ALTER TABLE pipeline_stages ADD COLUMN stage_detail TEXT;
    ALTER TABLE pipeline_stages ADD COLUMN progress_current INTEGER;
    ALTER TABLE pipeline_stages ADD COLUMN progress_total INTEGER;
    ALTER TABLE pipeline_stages ADD COLUMN progress_unit TEXT;
    ALTER TABLE pipeline_stages ADD COLUMN producer_seq INTEGER;
    ALTER TABLE pipeline_stages ADD COLUMN observation_payload_json TEXT NOT NULL DEFAULT '{}';
    "#,
    // v10: external provider dispatch journal. The intent is committed before
    // a non-idempotent OCR submit; a provider handle is a separate receipt.
    // A surviving intent without a receipt is ambiguous and must not be
    // automatically replayed after runtime restart.
    r#"
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
    "#,
    // v11: durable, conversation-scoped calculation runs. Inputs are recorded
    // by reference and hash; generated files are an immutable, controlled
    // relative-path manifest committed atomically with successful completion.
    r#"
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
    "#,
    // v12: durable document metadata suggestions and title provenance.  The
    // suggestion is immutable evidence; application is a separate guarded
    // transition so a refresh or lost response cannot overwrite a user title.
    r#"
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
    "#,
    // v13: model execution journal. Never persist prompts, bearer tokens or
    // reasoning text. A dispatched request without a receipt is not replayable.
    r#"
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
    "#,
    // v14: durable event identities and owner-scoped, rebuildable read feeds.
    // Source versions deliberately outlive job deletion: a reused job/sequence
    // identity must never accidentally validate an old source checkpoint.
    r#"
    CREATE INDEX idx_jobs_document_updated
        ON jobs(document_id, updated_at DESC, job_id DESC);
    CREATE INDEX idx_events_translation_commit
        ON events(job_id, seq)
        WHERE event = 'pipeline_unit_committed' AND stage = 'translate';

    ALTER TABLE events ADD COLUMN event_uid TEXT NOT NULL DEFAULT '';
    UPDATE events SET event_uid = lower(hex(randomblob(16))) WHERE event_uid = '';
    CREATE UNIQUE INDEX idx_events_uid ON events(event_uid) WHERE event_uid <> '';
    CREATE TABLE event_source_versions (
        job_id TEXT PRIMARY KEY,
        high_seq INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO event_source_versions(job_id, high_seq)
        SELECT job_id, MAX(seq) FROM events GROUP BY job_id;

    CREATE TRIGGER events_assign_uid AFTER INSERT ON events WHEN NEW.event_uid = ''
    BEGIN
        UPDATE events SET event_uid = lower(hex(randomblob(16)))
        WHERE job_id = NEW.job_id AND seq = NEW.seq;
    END;
    CREATE TRIGGER events_immutable_uid BEFORE UPDATE OF event_uid ON events
        WHEN OLD.event_uid <> '' AND NEW.event_uid IS NOT OLD.event_uid
    BEGIN
        SELECT RAISE(ABORT, 'event_uid is immutable');
    END;
    CREATE TRIGGER events_source_insert AFTER INSERT ON events
    BEGIN
        INSERT INTO event_source_versions(job_id, high_seq, revision)
        VALUES(NEW.job_id, NEW.seq, 0)
        ON CONFLICT(job_id) DO UPDATE SET
            revision = revision + CASE WHEN NEW.seq <= high_seq THEN 1 ELSE 0 END,
            high_seq = MAX(high_seq, NEW.seq);
    END;
    CREATE TRIGGER events_source_update AFTER UPDATE OF
        job_id, seq, ts, level, stage, stage_detail, provider, provider_stage,
        event, event_type, progress_current, progress_total, payload_json,
        retry_count, elapsed_ms, message ON events
    BEGIN
        INSERT INTO event_source_versions(job_id, high_seq, revision)
        VALUES(OLD.job_id, OLD.seq, 1)
        ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1;
        INSERT INTO event_source_versions(job_id, high_seq, revision)
        SELECT NEW.job_id, NEW.seq, 1 WHERE NEW.job_id <> OLD.job_id
        ON CONFLICT(job_id) DO UPDATE SET
            revision = revision + 1, high_seq = MAX(high_seq, NEW.seq);
        UPDATE event_source_versions SET high_seq = MAX(high_seq, NEW.seq)
        WHERE job_id = NEW.job_id;
    END;
    CREATE TRIGGER events_source_delete AFTER DELETE ON events
    BEGIN
        INSERT INTO event_source_versions(job_id, high_seq, revision)
        VALUES(OLD.job_id, OLD.seq, 1)
        ON CONFLICT(job_id) DO UPDATE SET revision = revision + 1;
    END;

    CREATE TABLE event_feeds (
        owner_job_id TEXT PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
        epoch TEXT NOT NULL,
        revision INTEGER NOT NULL,
        context TEXT NOT NULL,
        checkpoints_json TEXT NOT NULL,
        high_seq INTEGER NOT NULL DEFAULT 0,
        retention_cutoff TEXT
    );
    CREATE TABLE event_feed_items (
        owner_job_id TEXT NOT NULL REFERENCES event_feeds(owner_job_id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        source_key TEXT NOT NULL,
        event_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY(owner_job_id, seq),
        UNIQUE(owner_job_id, source_key),
        UNIQUE(owner_job_id, event_id)
    );
    CREATE TABLE event_feed_retention (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        cutoff TEXT NOT NULL
    );
    "#,
    // v15: remember cleanup on each source, including children consumed only
    // through a parent's feed. Rerendering must not resurrect expired history.
    r#"
    ALTER TABLE event_source_versions ADD COLUMN retention_cutoff TEXT;
    INSERT INTO event_source_versions(job_id, revision, retention_cutoff)
        SELECT owner_job_id, 1, retention_cutoff FROM event_feeds
        WHERE retention_cutoff IS NOT NULL
        ON CONFLICT(job_id) DO UPDATE SET
            revision = revision + 1, retention_cutoff = excluded.retention_cutoff;
    INSERT INTO event_source_versions(job_id, revision, retention_cutoff)
        SELECT jobs.job_id, 1, event_feed_retention.cutoff
        FROM jobs CROSS JOIN event_feed_retention
        WHERE jobs.status_json IN ('"succeeded"', '"failed"', '"canceled"')
        ON CONFLICT(job_id) DO UPDATE SET
            revision = revision + 1, retention_cutoff = excluded.retention_cutoff
        WHERE retention_cutoff IS NULL OR retention_cutoff < excluded.retention_cutoff;
    "#,
    // v16: 消息记住自己是怎么结束的。空 = 正常答完;"cancelled" = 用户点了停止,
    // 正文只有半截;"rounds_exhausted" = 工具轮次预算用尽,模型被逼着收尾——它的
    // 语气照常,不记下来的话刷新回来就看不出这条回答其实没做完。
    // 兼容:旧行为空串,读出来就是"正常答完",与此前的呈现一致。
    r#"
    ALTER TABLE ai_messages ADD COLUMN finish_reason TEXT NOT NULL DEFAULT '';
    "#,    // v17: 多设备同步(retain-data::sync)的本地记账。
    //
    // - sync_dirty:书库表的增删改由下面的触发器记成「哪个实体变了」(去重,只留最后
    //   一次变化时刻);同步时据此导出,不需要业务代码各处记得通知同步。API、jobsd、
    //   任何直接写库的进程改的都记得到。
    // - sync_apply_guard:应用别的设备的改动时在事务里放一行,触发器看到它就不记,
    //   免得把收到的改动当成本机改动再发出去。
    // - sync_entities / sync_entity_files:每个实体最后一次导出或应用后的状态:时钟、
    //   内容摘要、当时的内容与每个字段的时钟(按字段合并用),以及它管理的文件(删除或
    //   替换时只动这些文件,其它文件一概不碰)。
    // - 其余:设备身份与时钟、读别的设备改动记录读到哪、等依赖到齐的改动、文件哈希缓存。
    r#"
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
    "#,
    // v18: 同步文件夹里的文件按段打包(格式 2)。记下每份文件内容在哪台设备、哪一段的包里、
    // 什么位置:收的时候按位置取,发的时候已经在某个包里的不再重复上传。
    r#"
    CREATE TABLE sync_blobs (
        sha256  TEXT PRIMARY KEY,
        device  TEXT NOT NULL,
        segment INTEGER NOT NULL,
        offset  INTEGER NOT NULL,
        length  INTEGER NOT NULL
    );
    "#,
    // v19: 同步第三期——术语表、收藏截图、AI 对话(含消息)、AI 计算结果、AI 改文档的操作与
    // 版本,以及书的标题建议(挂在书下面)。触发器同 v17。
    r#"
    CREATE TRIGGER sync_dirty_glossaries_insert AFTER INSERT ON glossaries
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('glossary', NEW.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_glossaries_update AFTER UPDATE ON glossaries
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('glossary', NEW.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_glossaries_delete AFTER DELETE ON glossaries
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('glossary', OLD.glossary_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_assets_insert AFTER INSERT ON assets
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('asset', NEW.asset_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_assets_update AFTER UPDATE ON assets
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('asset', NEW.asset_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_assets_delete AFTER DELETE ON assets
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('asset', OLD.asset_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_conversations_insert AFTER INSERT ON ai_conversations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', NEW.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_conversations_update AFTER UPDATE ON ai_conversations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', NEW.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_conversations_delete AFTER DELETE ON ai_conversations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', OLD.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_messages_insert AFTER INSERT ON ai_messages
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', NEW.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_messages_update AFTER UPDATE ON ai_messages
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', NEW.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_ai_messages_delete AFTER DELETE ON ai_messages
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('conversation', OLD.conversation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_runs_insert AFTER INSERT ON agent_calculation_runs
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', NEW.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_runs_update AFTER UPDATE ON agent_calculation_runs
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', NEW.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_runs_delete AFTER DELETE ON agent_calculation_runs
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', OLD.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_artifacts_insert AFTER INSERT ON agent_calculation_artifacts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', NEW.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_artifacts_update AFTER UPDATE ON agent_calculation_artifacts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', NEW.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_agent_calculation_artifacts_delete AFTER DELETE ON agent_calculation_artifacts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('calculation', OLD.calculation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operations_insert AFTER INSERT ON document_operations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operations_update AFTER UPDATE ON document_operations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operations_delete AFTER DELETE ON document_operations
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', OLD.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_attempts_insert AFTER INSERT ON document_operation_attempts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_attempts_update AFTER UPDATE ON document_operation_attempts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_attempts_delete AFTER DELETE ON document_operation_attempts
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', OLD.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_events_insert AFTER INSERT ON document_operation_events
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_events_update AFTER UPDATE ON document_operation_events
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_operation_events_delete AFTER DELETE ON document_operation_events
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', OLD.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_versions_insert AFTER INSERT ON document_versions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_versions_update AFTER UPDATE ON document_versions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', NEW.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_versions_delete AFTER DELETE ON document_versions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('operation', OLD.operation_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_metadata_suggestions_insert AFTER INSERT ON document_metadata_suggestions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_metadata_suggestions_update AFTER UPDATE ON document_metadata_suggestions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('document', NEW.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    CREATE TRIGGER sync_dirty_document_metadata_suggestions_delete AFTER DELETE ON document_metadata_suggestions
    WHEN NOT EXISTS (SELECT 1 FROM sync_apply_guard)
    BEGIN
        INSERT INTO sync_dirty(kind, entity_key, changed_at)
        VALUES('document', OLD.document_id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(kind, entity_key) DO UPDATE SET changed_at = excluded.changed_at;
    END;
    "#,
    // v20: 同步文件夹的整理与回收(格式 3)。
    // - sync_blobs 一份内容可以记几个位置:重新打包后新旧包里都有,两台设备也可能各传过一份;
    // - sync_own_records:本机发出的每个实体的最后一条改动记录在哪一段(整理时只读这些段);
    // - sync_retired_packs:各设备停用的包(将要删除或已经删了),不再往里引用、取文件时排最后。
    r#"
    CREATE TABLE sync_blobs_v20 (
        sha256  TEXT NOT NULL,
        device  TEXT NOT NULL,
        segment INTEGER NOT NULL,
        offset  INTEGER NOT NULL,
        length  INTEGER NOT NULL,
        PRIMARY KEY(sha256, device, segment)
    );
    INSERT INTO sync_blobs_v20(sha256, device, segment, offset, length)
        SELECT sha256, device, segment, offset, length FROM sync_blobs;
    DROP TABLE sync_blobs;
    ALTER TABLE sync_blobs_v20 RENAME TO sync_blobs;
    CREATE INDEX idx_sync_blobs_pack ON sync_blobs(device, segment);
    CREATE TABLE sync_own_records (
        kind       TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        segment    INTEGER NOT NULL,
        PRIMARY KEY(kind, entity_key)
    );
    CREATE INDEX idx_sync_own_records_segment ON sync_own_records(segment);
    CREATE TABLE sync_retired_packs (
        device  TEXT NOT NULL,
        segment INTEGER NOT NULL,
        since   TEXT NOT NULL,
        PRIMARY KEY(device, segment)
    );
    "#,
    // 多用户：账号与会话。单机模式下这两张表是空的（只有一个固定的本机用户，不落库）。
    // 会话只存令牌的 sha256，库泄露了也拿不到能用的令牌。
    r#"
    CREATE TABLE IF NOT EXISTS users (
        user_id              TEXT PRIMARY KEY,
        username             TEXT NOT NULL,
        username_key         TEXT NOT NULL UNIQUE,
        password_hash        TEXT NOT NULL,
        role                 TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        status               TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        must_change_password INTEGER NOT NULL DEFAULT 0,
        failed_logins        INTEGER NOT NULL DEFAULT 0,
        locked_until         TEXT NOT NULL DEFAULT '',
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        last_login_at        TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token_hash   TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        created_at   TEXT NOT NULL,
        expires_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
    "#,
    // 多用户：数据归属。默认 'local'（单机模式的本机用户），所以单机版什么都不用改；
    // 多用户模式下归不到任何账号的行仍是 'local'，没有哪个网站账号看得见（宁可看不见，不可看错）。
    // 任务和书不由调用方填：插入时由触发器继承——任务跟上传走、没有上传就跟源任务走；
    // 书跟同指纹的上传走（多用户下指纹按账号区分，见 services/accounts::scoped_content_hash）。
    // 这样 jobsd、重跑、续跑、重新渲染这些不经过 API 的写入路径也不会漏掉归属。
    r#"
    ALTER TABLE uploads ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE jobs ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE documents ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE glossaries ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE collections ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local';
    CREATE INDEX IF NOT EXISTS idx_uploads_owner ON uploads(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
    CREATE TRIGGER IF NOT EXISTS jobs_inherit_owner AFTER INSERT ON jobs
    BEGIN
        UPDATE jobs SET owner_user_id = COALESCE(
            (SELECT u.owner_user_id FROM uploads u WHERE u.upload_id = NEW.upload_id),
            (SELECT p.owner_user_id FROM jobs p
              WHERE p.job_id = CASE WHEN json_valid(NEW.request_json)
                                    THEN json_extract(NEW.request_json, '$.source.artifact_job_id') END
                AND p.job_id <> NEW.job_id),
            owner_user_id)
        WHERE job_id = NEW.job_id AND owner_user_id = 'local';
    END;
    CREATE TRIGGER IF NOT EXISTS documents_inherit_owner AFTER INSERT ON documents
    BEGIN
        UPDATE documents SET owner_user_id = COALESCE(
            (SELECT u.owner_user_id FROM uploads u WHERE u.content_hash = NEW.document_id
              ORDER BY u.uploaded_at LIMIT 1),
            owner_user_id)
        WHERE document_id = NEW.document_id AND owner_user_id = 'local';
    END;
    "#,
];

pub(super) fn run_versioned_migrations(conn: &Connection) -> Result<()> {
    let initial_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, migration) in VERSIONED_MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        if version <= initial_version {
            continue;
        }
        // API and jobsd can start together. Re-read the version while holding
        // the write reservation, so only one process executes additive ALTERs.
        let tx = Transaction::new_unchecked(conn, TransactionBehavior::Immediate)?;
        let current: i64 = tx.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version <= current {
            continue;
        }
        tx.execute_batch(migration)?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

pub(super) fn ensure_uploads_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "uploads", column, column_def)
}

pub(super) fn ensure_jobs_column(conn: &Connection, column: &str, column_def: &str) -> Result<()> {
    ensure_table_column(conn, "jobs", column, column_def)
}

pub(super) fn ensure_events_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "events", column, column_def)
}

pub(super) fn ensure_glossaries_column(
    conn: &Connection,
    column: &str,
    column_def: &str,
) -> Result<()> {
    ensure_table_column(conn, "glossaries", column, column_def)
}

fn ensure_table_column(
    conn: &Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_column = false;
    for row in rows {
        if row? == column {
            has_column = true;
            break;
        }
    }
    if !has_column {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {column_def}"),
            [],
        )?;
    }
    Ok(())
}

pub(super) fn ensure_no_legacy_artifacts_json(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(jobs)")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_legacy_column = false;
    for row in rows {
        if row? == "artifacts_json" {
            has_legacy_column = true;
            break;
        }
    }
    if !has_legacy_column {
        return Ok(());
    }
    let legacy_count: i64 = conn.query_row(
        r#"
        SELECT COUNT(*)
        FROM jobs
        WHERE artifacts_json IS NOT NULL AND TRIM(artifacts_json) <> ''
        "#,
        [],
        |row| row.get(0),
    )?;
    if legacy_count > 0 {
        anyhow::bail!(
            "legacy jobs.artifacts_json storage is no longer supported; found {legacy_count} legacy rows, clear the DB or rerun those jobs"
        );
    }
    Ok(())
}
