-- AI 消息树分支 —— parent_id 形成兄弟分支; head_id 记录当前可见叶。
-- 与 ChatGPT / assistant-ui 一致:同 parent 的多条 message 即 alternate。
-- 兼容:旧行 parent_id 为空,按 seq 串成线性链;load 时无 head 或 max(seq)。
ALTER TABLE ai_conversations ADD COLUMN head_id TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_messages ADD COLUMN parent_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_ai_messages_parent
    ON ai_messages(conversation_id, parent_id);
