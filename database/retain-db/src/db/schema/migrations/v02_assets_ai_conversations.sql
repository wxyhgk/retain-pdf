-- 资产存储(内容寻址,收藏图片附件)+ AI 问答会话/消息。
-- 设计原则:用户策展(收藏)是硬锚点,机器生成(问答引用)是软锚点
-- ——引用只存 citations_json 快照,不做 job 删除保护。
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
