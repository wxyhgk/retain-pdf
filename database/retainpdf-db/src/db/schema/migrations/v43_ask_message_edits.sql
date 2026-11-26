-- 2026-11-26：阅读页提问改一条已发出的问（第二期，用户定「后面的作废，从这里重问」）。
-- 改主对话里较早的一条问：这条和它之后的消息标为作废（`superseded_at`，原文留着，界面折叠），盖过这些消息的压缩摘要也作废；
-- 改后的问作为新的一条追加在最后，`edited_from` 指回被改的那条。上下文、压缩、「这本书上问过的地方」都不看作废的。
ALTER TABLE ask_conversation_messages ADD COLUMN superseded_at TEXT;
ALTER TABLE ask_conversation_messages ADD COLUMN edited_from TEXT;
ALTER TABLE ask_compactions ADD COLUMN superseded_at TEXT;
