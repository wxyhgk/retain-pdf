// 问答记录的格式转换（纯函数，测试在 frontend/web/tests/ask/）：
// - assistant-ui 的对话 → 存到后端的问答（问题 / 回答 + 思考 + 用量），每答完一轮整段写一次；
// - 存着的问答 → 重新打开时交给 assistant-ui 的 initialMessages（回答底下照样有用量那一行，没有速度）；
// - agent 那边是新会话（ACP 的 session/load 后端还没开）：第一问前面带上之前几轮的文字。
import { emptyTurn } from "./parts.js";
const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 8000;
function joinParts(content, type) {
    return content.filter((part) => part.type === type).map((part) => part.text || "").join("").trim();
}
/** 存的用量：AskUsage 里有的项，加上这一轮的用时（秒）。 */
function storedUsage(turn, endedAt) {
    if (!turn)
        return null;
    const usage = { ...turn.usage };
    if (endedAt != null)
        usage.elapsedMs = Math.round(endedAt - turn.startedAt);
    if (turn.firstTokenAt != null)
        usage.firstTokenMs = Math.round(turn.firstTokenAt - turn.startedAt);
    return Object.keys(usage).length ? usage : null;
}
/** 这一轮思考了多久（各段思考的起止加起来）；没有计时就是 null。 */
function thinkingMs(content) {
    let total = 0;
    let seen = false;
    for (const part of content) {
        if (part.type !== "reasoning" || part.timing?.startedAt == null || part.timing.completedAt == null)
            continue;
        total += part.timing.completedAt - part.timing.startedAt;
        seen = true;
    }
    return seen ? Math.round(total) : null;
}
export function toStoredMessages(messages) {
    const out = [];
    for (const message of messages) {
        if (message.role === "user") {
            const text = joinParts(message.content, "text");
            if (text)
                out.push({ role: "user", text });
        }
        else if (message.role === "assistant") {
            const custom = message.metadata?.custom;
            const text = joinParts(message.content, "text");
            const thought = joinParts(message.content, "reasoning");
            if (!text && !thought)
                continue;
            const usage = storedUsage(custom?.turn, custom?.endedAt);
            const thoughtMs = thinkingMs(message.content);
            out.push({ role: "assistant", text, thought: thought || null, usage: thoughtMs != null ? { ...usage, thoughtMs } : usage });
        }
    }
    return out;
}
/**
 * 重新打开：交给 assistant-ui（ThreadMessageLike）。用量放回 metadata，回答底下那一行照样画（没有速度、首字照存的写）。
 * 宿主的编号当消息编号；问题的出处、回答的标记（结论卡片、压缩点）放 metadata.custom，插槽从那里读。
 */
export function toInitialMessages(messages) {
    return messages.map((message) => {
        const id = message.id ? { id: message.id } : {};
        if (message.role === "user") {
            return { ...id, role: "user", content: message.text, ...(message.context ? { metadata: { custom: { context: message.context } } } : {}) };
        }
        const usage = (message.usage || {});
        // 思考用时放回思考那一段的起止（标题照样写「思考 · 1.2s」）。
        const thoughtTiming = typeof usage.thoughtMs === "number" ? { timing: { startedAt: 0, completedAt: usage.thoughtMs } } : {};
        const turn = { ...emptyTurn(0), usage, firstTokenAt: usage.firstTokenMs ?? null };
        return {
            ...id,
            role: "assistant",
            content: [
                ...(message.thought ? [{ type: "reasoning", text: message.thought, ...thoughtTiming }] : []),
                { type: "text", text: message.text },
            ],
            status: { type: "complete", reason: "stop" },
            metadata: { custom: { turn, endedAt: usage.elapsedMs ?? undefined, stored: { id: message.id, marks: message.marks } } },
        };
    });
}
/** 新会话的第一问前面带的「之前的对话」：最近几条，太长从前面截。没有就是空串。 */
export function historyText(messages) {
    const stored = toStoredMessages(messages).slice(-HISTORY_MESSAGES);
    if (!stored.length)
        return "";
    let text = stored.map((message) => `${message.role === "user" ? "我" : "你"}：${message.text}`).join("\n\n");
    if (text.length > HISTORY_CHARS)
        text = `…${text.slice(-HISTORY_CHARS)}`;
    return `之前我们在这一处聊过（接着聊）：\n\n${text}`;
}
