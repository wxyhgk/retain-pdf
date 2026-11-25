-- 2026-11-25：阅读页提问的问答记录（docs/ops/planning/reader-ask/20261125-第3步：问答记录.md）。
--
-- - ask_threads：一次提问一行（书页上的一个「?」）。挂在书的文件上（`document_id` = `item_files.file_id`，PDF 的内容指纹），
--   删书时跟着外键级联删，和译文版本一样。问的是哪儿（锚点）是几列：栏、页、块、选中的字、那一块的原文译文、章节、页内位置。
--   `session_id` 是 agent 那边的 ACP 会话编号（以后 `session/load` 用），可以空。
-- - ask_messages：一条问或答一行，`position` 从 0 起。前端每答完一轮整份写一次（删了重插），用量整块存 JSON。
-- 不同步（各设备自己的）、不进多用户的归属表（归属跟着书走）；数量和长度上限在书库包 `ask_threads.rs`。
CREATE TABLE IF NOT EXISTS ask_threads (
    thread_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES item_files(file_id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL CHECK (length(trim(agent_id)) > 0),
    session_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    pane TEXT NOT NULL CHECK (pane IN ('source', 'translated')),
    page INTEGER NOT NULL CHECK (page >= 1),
    item_id TEXT,
    selection TEXT NOT NULL DEFAULT '',
    source_text TEXT NOT NULL DEFAULT '',
    translated_text TEXT NOT NULL DEFAULT '',
    section TEXT NOT NULL DEFAULT '',
    -- 页内位置（占整页的比例，0–1）；两个都空 = 没有位置。
    point_x REAL CHECK (point_x IS NULL OR (point_x >= 0 AND point_x <= 1)),
    point_y REAL CHECK (point_y IS NULL OR (point_y >= 0 AND point_y <= 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((point_x IS NULL) = (point_y IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_ask_threads_document ON ask_threads(document_id, updated_at);

CREATE TABLE IF NOT EXISTS ask_messages (
    thread_id TEXT NOT NULL REFERENCES ask_threads(thread_id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    -- 思考摘要；空 = 没有。
    thought TEXT,
    -- 用量（JSON 对象，原样存前端给的）；空 = 没有。
    usage_json TEXT,
    PRIMARY KEY (thread_id, position)
);
