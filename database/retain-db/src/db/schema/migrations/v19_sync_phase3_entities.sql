-- 同步第三期——术语表、收藏截图、AI 对话(含消息)、AI 计算结果、AI 改文档的操作与
-- 版本,以及书的标题建议(挂在书下面)。触发器同 v17。
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
