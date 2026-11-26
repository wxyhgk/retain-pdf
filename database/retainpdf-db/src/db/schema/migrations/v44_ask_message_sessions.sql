-- 2026-11-26：主对话里每条消息记下是哪个 agent 会话答的（ACP 的会话编号，前端追加时带）。删对话时据此删掉 agent 自己存的那份
-- （现在只有 retainpdf-pi 的会话文件，`<数据目录>/ask-pi/sessions/`），和删问答记录（ask_threads.session_id）一样。老消息没有，留空。
ALTER TABLE ask_conversation_messages ADD COLUMN session_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ask_conversation_messages_session ON ask_conversation_messages(session_id) WHERE session_id IS NOT NULL;
