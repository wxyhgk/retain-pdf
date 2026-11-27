-- 2026-11-27 用户定：主对话改成每本书一个（「主对话串了，好几个 pdf 打开都是同一个聊天框」；选「每本书一个主对话，用户层记忆照旧所有书共用」），
-- 推翻 11-26 的「主对话是全局的」。见 docs/ops/planning/reader-ask/20261127-主对话按书分.md。
--
-- - 主对话用 ask_conversations.document_id 记是哪本书的（以前只有副对话用这一列）；没有书的照旧是全局那条。
--   「同一时间只有一个开着的主对话」改成按书算：唯一索引从 (kind) 换成 (COALESCE(document_id, ''))。
-- - 删书时这一列置空（外键 ON DELETE SET NULL），开着的会和全局那条撞唯一索引、书删不掉：删书之前先把这本书开着的主对话归档。
-- - 已有的主对话按书拆开（用户定「按书拆开」）：带书的消息挪到那本书的主对话里（每本书一个，状态、标题照旧，按原来的顺序重新编号），
--   副对话跟着它分叉的那条消息走（没有就看它开在哪本书），回到主对话的结论卡片跟着副对话走，记忆的出处对话跟着消息走；
--   拆过的对话的压缩摘要作废（摘要里几本书混在一起，按剩下的消息重新压）。没有书的消息留在原来那条。

DROP INDEX IF EXISTS idx_ask_conversations_one_open_main;

CREATE TEMP TABLE ask_main_split AS
SELECT DISTINCT c.conversation_id AS old_id, m.document_id AS document_id,
       c.conversation_id || '-' || substr(m.document_id, 1, 12) AS new_id
FROM ask_conversations c
JOIN ask_conversation_messages m ON m.conversation_id = c.conversation_id
WHERE c.kind = 'main' AND c.document_id IS NULL AND m.document_id IS NOT NULL;

INSERT INTO ask_conversations (conversation_id, kind, status, title, document_id, created_at, updated_at, closed_at)
SELECT s.new_id, 'main', c.status, c.title, s.document_id,
       (SELECT MIN(m.created_at) FROM ask_conversation_messages m WHERE m.conversation_id = s.old_id AND m.document_id = s.document_id),
       (SELECT MAX(m.created_at) FROM ask_conversation_messages m WHERE m.conversation_id = s.old_id AND m.document_id = s.document_id),
       c.closed_at
FROM ask_main_split s
JOIN ask_conversations c ON c.conversation_id = s.old_id;

-- 副对话挪到哪条主对话：先看分叉的那条消息是哪本书的，再看副对话开在哪本书；都没有就留在原来那条。
CREATE TEMP TABLE ask_side_targets AS
SELECT side.conversation_id AS side_id, side.parent_id AS old_id,
       COALESCE(
           (SELECT s.new_id FROM ask_conversation_messages fork
            JOIN ask_main_split s ON s.old_id = fork.conversation_id AND s.document_id = fork.document_id
            WHERE fork.message_id = side.forked_from_message_id),
           (SELECT s.new_id FROM ask_main_split s WHERE s.old_id = side.parent_id AND s.document_id = side.document_id)
       ) AS new_id
FROM ask_conversations side
WHERE side.kind = 'side' AND side.parent_id IN (SELECT old_id FROM ask_main_split);

-- 挪哪些消息、挪过去是第几条：带书的按书；没带书的结论卡片跟着它的副对话。
CREATE TEMP TABLE ask_main_moves AS
SELECT message_id, old_id, new_id, ROW_NUMBER() OVER (PARTITION BY new_id ORDER BY seq) AS new_seq
FROM (
    SELECT m.message_id, m.seq, m.conversation_id AS old_id, COALESCE(s.new_id, t.new_id) AS new_id
    FROM ask_conversation_messages m
    LEFT JOIN ask_main_split s ON s.old_id = m.conversation_id AND s.document_id = m.document_id
    LEFT JOIN ask_side_targets t
        ON m.document_id IS NULL AND t.side_id = m.side_conversation_id AND t.old_id = m.conversation_id
    WHERE m.conversation_id IN (SELECT old_id FROM ask_main_split)
)
WHERE new_id IS NOT NULL;

UPDATE ask_conversation_messages
SET conversation_id = (SELECT v.new_id FROM ask_main_moves v WHERE v.message_id = ask_conversation_messages.message_id),
    seq = (SELECT v.new_seq FROM ask_main_moves v WHERE v.message_id = ask_conversation_messages.message_id)
WHERE message_id IN (SELECT message_id FROM ask_main_moves);

UPDATE ask_conversations
SET parent_id = (SELECT t.new_id FROM ask_side_targets t WHERE t.side_id = ask_conversations.conversation_id)
WHERE conversation_id IN (SELECT side_id FROM ask_side_targets WHERE new_id IS NOT NULL);

UPDATE ask_memories
SET source_conversation_id = (SELECT v.new_id FROM ask_main_moves v WHERE v.message_id = ask_memories.source_message_id)
WHERE source_message_id IN (SELECT message_id FROM ask_main_moves);

UPDATE ask_compactions
SET superseded_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE superseded_at IS NULL AND conversation_id IN (SELECT old_id FROM ask_main_moves);

DROP TABLE ask_main_moves;
DROP TABLE ask_side_targets;
DROP TABLE ask_main_split;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ask_conversations_one_open_main
    ON ask_conversations(COALESCE(document_id, '')) WHERE kind = 'main' AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_ask_conversations_main_document
    ON ask_conversations(document_id, status) WHERE kind = 'main';

CREATE TRIGGER IF NOT EXISTS ask_main_archive_before_document_delete
BEFORE DELETE ON item_files
BEGIN
    UPDATE ask_conversations
    SET status = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE kind = 'main' AND status = 'open' AND document_id = old.file_id;
END;
