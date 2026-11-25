// 问答记录的格式转换（纯函数，测试在 frontend/web/tests/reader/reader-ask.test.mjs）：
// - assistant-ui 的对话 → 存到后端的问答（问题 / 回答 + 思考 + 用量），每答完一轮整段写一次；
// - 存着的问答 → 重新打开时交给 assistant-ui 的 initialMessages（回答底下照样有用量那一行，没有速度）；
// - agent 那边是新会话（ACP 的 session/load 后端还没开）：第一问前面带上之前几轮的文字。

import type { ReaderAskMessage } from "../contracts/ask.js";
import { emptyTurn, type AskTurn, type AskUsage } from "./acp-parts.js";

type PartLike = { type: string; text?: string };
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

export function toStoredMessages(messages: readonly MessageLike[]): ReaderAskMessage[] {
  const out: ReaderAskMessage[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const text = joinParts(message.content, "text");
      if (text) out.push({ role: "user", text });
    } else if (message.role === "assistant") {
      const custom = message.metadata?.custom as { turn?: AskTurn; endedAt?: number } | undefined;
      const text = joinParts(message.content, "text");
      const thought = joinParts(message.content, "reasoning");
      if (!text && !thought) continue;
      out.push({ role: "assistant", text, thought: thought || null, usage: storedUsage(custom?.turn, custom?.endedAt) });
    }
  }
  return out;
}

/** 重新打开：交给 assistant-ui（ThreadMessageLike）。用量放回 metadata，回答底下那一行照样画（没有速度、首字照存的写）。 */
export function toInitialMessages(messages: readonly ReaderAskMessage[]) {
  return messages.map((message) => {
    if (message.role === "user") return { role: "user" as const, content: message.text };
    const usage = (message.usage || {}) as AskUsage & { elapsedMs?: number; firstTokenMs?: number };
    const turn: AskTurn = { ...emptyTurn(0), usage, firstTokenAt: usage.firstTokenMs ?? null };
    return {
      role: "assistant" as const,
      content: [
        ...(message.thought ? [{ type: "reasoning" as const, text: message.thought }] : []),
        { type: "text" as const, text: message.text },
      ],
      status: { type: "complete" as const, reason: "stop" as const },
      metadata: { custom: { turn, endedAt: usage.elapsedMs ?? undefined } },
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
