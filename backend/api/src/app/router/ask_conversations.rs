//! 阅读页提问的主对话、副对话和记忆（2026-11-26，数据库 v40）。全局的用户数据、没有归属列，多用户模式下关闭。
//! 逻辑在书库领域的 `ask_conversations.rs`、`ask_memories.rs`；方案 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md。

use crate::app::AppState;
use crate::routes::ask_conversations;

crate::endpoints! {
    state: AppState;
    owner: library;
    /// 阅读页提问的设置（「让 AI 使用记忆」总开关）；自带 agent 每次调记忆工具前看一眼
    GET "/api/v1/ai/ask-settings" => ask_conversations::get_settings_route, closed by(agent);
    /// 改阅读页提问的设置
    PATCH "/api/v1/ai/ask-settings" => ask_conversations::patch_settings_route, closed by(none);
    /// 取或建当前的全局主对话（同一时间只有一个开着的）
    POST "/api/v1/ai/ask-conversations/main" => ask_conversations::ensure_main_conversation_route, closed by(none);
    /// 列对话（主对话、副对话，可按种类、状态、主对话筛）
    GET "/api/v1/ai/ask-conversations" => ask_conversations::list_conversations_route, closed by(none);
    /// 从主对话的某条消息开一个副对话
    POST "/api/v1/ai/ask-conversations" => ask_conversations::create_side_conversation_route, closed by(none);
    /// 一个对话
    GET "/api/v1/ai/ask-conversations/:conversation_id" => ask_conversations::get_conversation_route, closed by(none);
    /// 改对话：标题、归档主对话、再开副对话
    PATCH "/api/v1/ai/ask-conversations/:conversation_id" => ask_conversations::patch_conversation_route, closed by(none);
    /// 删对话（连同消息和它的副对话；记忆留着）；开着的主对话不能删，先归档
    DELETE "/api/v1/ai/ask-conversations/:conversation_id" => ask_conversations::delete_conversation_route, closed by(none);
    /// 结束副对话：给了结论（或给了模型让后端总结）就回填到主对话（一张摘要卡片）
    POST "/api/v1/ai/ask-conversations/:conversation_id/close" => ask_conversations::close_conversation_route, closed by(none);
    /// 对话的消息（按 seq 往前翻页）
    GET "/api/v1/ai/ask-conversations/:conversation_id/messages" => ask_conversations::list_messages_route, closed by(none);
    /// 追加一轮（问和答一起，每条带结构化出处；只追加不覆盖）
    POST "/api/v1/ai/ask-conversations/:conversation_id/messages" => ask_conversations::append_messages_route, closed by(none);
    /// 改后重问的第一步：从这条问起作废（它和之后的消息、盖过它的压缩摘要；原文留着），改后的问再照常追加、带 edited_from
    POST "/api/v1/ai/ask-conversations/:conversation_id/messages/:message_id/supersede" => ask_conversations::supersede_messages_route, closed by(none);
    /// 压缩：后端用设置里的模型把上一份摘要之后、最近几轮之前的消息压成一份新摘要（原始消息不删）
    POST "/api/v1/ai/ask-conversations/:conversation_id/compactions" => ask_conversations::create_compaction_route, closed by(none);
    /// 一个对话所有的压缩摘要（旧的也在）
    GET "/api/v1/ai/ask-conversations/:conversation_id/compactions" => ask_conversations::list_compactions_route, closed by(none);
    /// 开新会话用的上下文：用户层和当前书的记忆、最近几轮、拼好的文字
    GET "/api/v1/ai/ask-conversations/:conversation_id/context" => ask_conversations::context_route, closed by(agent);
    /// 记忆：列、全文检索（按层、书、状态筛）
    GET "/api/v1/ai/memories" => ask_conversations::list_memories_route, closed by(agent);
    /// 记一条记忆（用户自己加，或 agent 的 remember；可以替代旧的一条）
    POST "/api/v1/ai/memories" => ask_conversations::create_memory_route, closed by(agent);
    /// 改一条记忆
    PATCH "/api/v1/ai/memories/:memory_id" => ask_conversations::patch_memory_route, closed by(none);
    /// 删（撤销）一条记忆：标 deleted，被它替代的旧条恢复
    DELETE "/api/v1/ai/memories/:memory_id" => ask_conversations::delete_memory_route, closed by(none);
}
