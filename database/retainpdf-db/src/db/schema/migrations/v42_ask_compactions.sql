-- 2026-11-26：主对话太长时的压缩摘要（docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md 第 4 节，第二期）。
-- 一份摘要替代这个对话 `seq <= covers_to_seq` 的消息；新的压缩把上一份摘要和之后的消息一起再压，`covers_to_seq` 最大的那份生效，
-- 旧的留着可查。原始消息一条不删（ask_conversation_messages 不动）。摘要由后端用用户设置里那条模型生成（`python -m retainpdf_ask_agent summarize`）。
-- 对话删了摘要跟着删；不同步。
CREATE TABLE IF NOT EXISTS ask_compactions (
    compaction_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ask_conversations(conversation_id) ON DELETE CASCADE,
    covers_to_seq INTEGER NOT NULL CHECK (covers_to_seq >= 1),
    summary TEXT NOT NULL,
    -- 涉及的书和页：[{"document_id", "pages": [..]}]；没有是 NULL。
    sources_json TEXT,
    model TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ask_compactions_conversation ON ask_compactions(conversation_id, covers_to_seq);
