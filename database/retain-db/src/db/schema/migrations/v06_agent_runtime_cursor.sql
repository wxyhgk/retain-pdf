-- durable adapter cursor for one agent runtime session per
-- conversation. The cursor is internal control-plane state and is not
-- exposed through the public conversation record. Revision provides a
-- compare-and-swap boundary when a crashed runtime and its replacement
-- race to publish a new session.
ALTER TABLE ai_conversations ADD COLUMN agent_runtime_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_conversations ADD COLUMN agent_session_cursor TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_conversations ADD COLUMN agent_session_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_conversations ADD COLUMN agent_session_updated_at TEXT NOT NULL DEFAULT '';
