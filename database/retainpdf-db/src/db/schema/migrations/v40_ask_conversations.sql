-- 2026-11-26：阅读页提问的主对话、副对话和记忆（docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md）。只加表，不动 v39 的问答记录。
--
-- - ask_conversations：一个对话一行。`main` 是全局主对话（同一时间只有一个 open 的），`side` 是从主对话某条消息分出来的副对话。
--   没有归属列：这批接口多用户模式下关闭（网站账号 404）。
-- - ask_conversation_messages：一条消息一行，只追加。`seq` 从 1 起；每条记自己属于哪本书（`document_id`）和结构化出处
--   （查得多的几项拆成列，整个出处在 `selection_json`）；`job_id`、`version_id` 只存编号（提示）。`side_summary` 是副对话结束时回到主对话的卡片。
-- - ask_memories：记忆。`user` 层关于用户，`book` 层挂在书上（删书跟着删）。状态 active / superseded（被新的替代）/ deleted（用户删的，行留着）。
--   出处（对话、消息）删了置空，删对话不删记忆。ask_memories_fts 是它的全文索引（trigram，和 blocks_fts 一样），触发器跟着改。
-- 不同步（各设备自己的）；长度、数量上限在书库包 `ask_conversations.rs`、`ask_memories.rs`。
CREATE TABLE IF NOT EXISTS ask_conversations (
    conversation_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('main', 'side')),
    parent_id TEXT REFERENCES ask_conversations(conversation_id) ON DELETE CASCADE,
    forked_from_message_id TEXT REFERENCES ask_conversation_messages(message_id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'archived')),
    title TEXT NOT NULL DEFAULT '',
    -- 副对话结束时的结论；没有是空。
    summary TEXT,
    document_id TEXT REFERENCES item_files(file_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT,
    CHECK ((kind = 'main') = (parent_id IS NULL)),
    CHECK (kind = 'side' OR status IN ('open', 'archived'))
);
-- 同一时间只有一个 open 的主对话。
CREATE UNIQUE INDEX IF NOT EXISTS idx_ask_conversations_one_open_main ON ask_conversations(kind) WHERE kind = 'main' AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_ask_conversations_parent ON ask_conversations(parent_id, created_at);

CREATE TABLE IF NOT EXISTS ask_conversation_messages (
    message_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ask_conversations(conversation_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL CHECK (seq >= 1),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'side_summary')),
    text TEXT NOT NULL,
    thought TEXT,
    usage_json TEXT,
    agent_id TEXT,
    side_conversation_id TEXT REFERENCES ask_conversations(conversation_id) ON DELETE SET NULL,
    document_id TEXT REFERENCES item_files(file_id) ON DELETE SET NULL,
    job_id TEXT,
    version_id TEXT,
    pane TEXT CHECK (pane IS NULL OR pane IN ('source', 'translated')),
    page INTEGER CHECK (page IS NULL OR page >= 1),
    selection_json TEXT,
    client_message_id TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (conversation_id, seq),
    UNIQUE (conversation_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS idx_ask_conversation_messages_document ON ask_conversation_messages(document_id, page)
    WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ask_memories (
    memory_id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('user', 'book')),
    document_id TEXT REFERENCES item_files(file_id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('preference', 'background', 'style', 'progress', 'term', 'conclusion', 'other')),
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'deleted')),
    superseded_by TEXT REFERENCES ask_memories(memory_id) ON DELETE SET NULL,
    origin TEXT NOT NULL CHECK (origin IN ('agent', 'user')),
    agent_id TEXT,
    source_conversation_id TEXT REFERENCES ask_conversations(conversation_id) ON DELETE SET NULL,
    source_message_id TEXT REFERENCES ask_conversation_messages(message_id) ON DELETE SET NULL,
    source_job_id TEXT,
    source_page INTEGER CHECK (source_page IS NULL OR source_page >= 1),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    CHECK ((scope = 'book') = (document_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_ask_memories_scope ON ask_memories(scope, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_ask_memories_document ON ask_memories(document_id, status, updated_at) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ask_memories_source_conversation ON ask_memories(source_conversation_id, created_at)
    WHERE source_conversation_id IS NOT NULL;

CREATE VIRTUAL TABLE IF NOT EXISTS ask_memories_fts USING fts5(memory_id UNINDEXED, text, tokenize='trigram');
CREATE TRIGGER IF NOT EXISTS ask_memories_fts_insert AFTER INSERT ON ask_memories BEGIN
    INSERT INTO ask_memories_fts (memory_id, text) VALUES (new.memory_id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS ask_memories_fts_update AFTER UPDATE OF text ON ask_memories BEGIN
    DELETE FROM ask_memories_fts WHERE memory_id = old.memory_id;
    INSERT INTO ask_memories_fts (memory_id, text) VALUES (new.memory_id, new.text);
END;
CREATE TRIGGER IF NOT EXISTS ask_memories_fts_delete AFTER DELETE ON ask_memories BEGIN
    DELETE FROM ask_memories_fts WHERE memory_id = old.memory_id;
END;
