// 问答记录的格式转换（纯函数，测试在 frontend/web/tests/ask/）：
// - assistant-ui 的对话 → 存到后端的问答（问题 / 回答 + 思考 + 用量），每答完一轮整段写一次；
// - 存着的问答 → 重新打开时交给 assistant-ui 的 initialMessages（回答底下照样有用量那一行，没有速度）；
// - agent 那边是新会话（ACP 的 session/load 后端还没开）：第一问前面带上之前几轮的文字。

import type { AskMessage } from "../contract.js";
import { emptyTurn, type AskTurn, type AskUsage } from "./parts.js";

type PartLike = { type: string; text?: string; timing?: { startedAt?: number; completedAt?: number } };
type MessageLike = { role: string; content: readonly PartLike[]; metadata?: { custom?: Record<string, unknown> } };

const HISTORY_MESSAGES = 12;
const HISTORY_CHARS = 8000;

function joinParts(content: readonly PartLike[], type: string): string {
  return content.filter((part) => part.type === type).map((part) => part.text || "").join("").trim();
}

/** 存的用量：AskUsage 里有的项，加上这一轮的用时（秒）。 */
function storedUsage(turn: AskTurn | undefined, endedAt: number | undefined): Record<string, unknown> | null {
  if (!turn) return null;
  const usage: Record<string, unknown> = { ...turn.usage };
  if (endedAt != null) usage.elapsedMs = Math.round(endedAt - turn.startedAt);
  if (turn.firstTokenAt != null) usage.firstTokenMs = Math.round(turn.firstTokenAt - turn.startedAt);
  return Object.keys(usage).length ? usage : null;
}

/** 这一轮思考了多久（各段思考的起止加起来）；没有计时就是 null。 */
function thinkingMs(content: readonly PartLike[]): number | null {
  let total = 0;
  let seen = false;
  for (const part of content) {
    if (part.type !== "reasoning" || part.timing?.startedAt == null || part.timing.completedAt == null) continue;
    total += part.timing.completedAt - part.timing.startedAt;
    seen = true;
  }
  return seen ? Math.round(total) : null;
}

export function toStoredMessages(messages: readonly MessageLike[]): AskMessage[] {
  const out: AskMessage[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = joinParts(message.content, "text");
      if (text) out.push({ role: "user", text });
    } else if (message.role === "assistant") {
      const custom = message.metadata?.custom as { turn?: AskTurn; endedAt?: number } | undefined;
      const text = joinParts(message.content, "text");
      const thought = joinParts(message.content, "reasoning");
      if (!text && !thought) continue;
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
export function toInitialMessages(messages: readonly AskMessage[]) {
  return messages.map((message) => {
    const id = message.id ? { id: message.id } : {};
    if (message.role === "user") {
      const custom = { ...(message.context ? { context: message.context } : {}), ...(message.marks?.rewrote ? { rewrote: message.marks.rewrote } : {}) };
      return { ...id, role: "user" as const, content: message.text, ...(Object.keys(custom).length ? { metadata: { custom } } : {}) };
    }
    const usage = (message.usage || {}) as AskUsage & { elapsedMs?: number; firstTokenMs?: number; thoughtMs?: number };
    // 思考用时放回思考那一段的起止（标题照样写「思考 · 1.2s」）。
    const thoughtTiming = typeof usage.thoughtMs === "number" ? { timing: { startedAt: 0, completedAt: usage.thoughtMs } } : {};
    const turn: AskTurn = { ...emptyTurn(0), usage, firstTokenAt: usage.firstTokenMs ?? null };
    return {
      ...id,
      role: "assistant" as const,
      content: [
        ...(message.thought ? [{ type: "reasoning" as const, text: message.thought, ...thoughtTiming }] : []),
        { type: "text" as const, text: message.text },
      ],
      status: { type: "complete" as const, reason: "stop" as const },
      metadata: { custom: { turn, endedAt: usage.elapsedMs ?? undefined, stored: { id: message.id, marks: message.marks } } },
    };
  });
}

/** 新会话的第一问前面带的「之前的对话」：最近几条，太长从前面截。没有就是空串。 */
export function historyText(messages: readonly MessageLike[]): string {
  const stored = toStoredMessages(messages).slice(-HISTORY_MESSAGES);
  if (!stored.length) return "";
  let text = stored.map((message) => `${message.role === "user" ? "我" : "你"}：${message.text}`).join("\n\n");
  if (text.length > HISTORY_CHARS) text = `…${text.slice(-HISTORY_CHARS)}`;
  return `之前我们在这一处聊过（接着聊）：\n\n${text}`;
}
