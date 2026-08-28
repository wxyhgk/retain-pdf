// Pure logic for multi-session chat management: title derivation, summary sorting, and max-size trimming.
// No DOM or storage, so it is easy to unit test; the store and chat controller share the same semantics.

import type {
  ReaderAiChatSession,
  ReaderAiSessionSummary,
  ReaderAiSessionsBag,
} from "../types.js";

export const MAX_SESSIONS = 20;
const TITLE_MAX = 18;

// Session title: use the first user message after whitespace cleanup and clipping; fall back when no user message exists.
export function deriveSessionTitle(session: ReaderAiChatSession = {}) {
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const firstUser = messages.find(
    (item) => item?.role === "user" && `${item?.text || ""}`.trim(),
  );
  const raw = `${firstUser?.text || session?.title || ""}`.replace(/\s+/g, " ").trim();
  if (!raw) {
    return "Hội thoại mới";
  }
  return raw.length > TITLE_MAX ? `${raw.slice(0, TITLE_MAX).trim()}…` : raw;
}

// Session summary: sort by updatedAt descending, mark active, and feed dropdown rendering.
export function summarizeSessions({
  sessions = [],
  activeId = "",
}: ReaderAiSessionsBag = {}): ReaderAiSessionSummary[] {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => ({
      id: `${session?.id || ""}`,
      title: deriveSessionTitle(session),
      updatedAt: Number(session?.updatedAt) || 0,
      messageCount: Array.isArray(session?.messages) ? session.messages.length : 0,
      active: `${session?.id || ""}` === `${activeId}`,
    }))
    .filter((summary) => summary.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Max-size trimming: keep the latest max sessions; always preserve the active session by replacing the oldest kept one.
export function trimSessions(
  { sessions = [], activeId = "" }: ReaderAiSessionsBag = {},
  max = MAX_SESSIONS,
): ReaderAiChatSession[] {
  const list = Array.isArray(sessions) ? [...sessions] : [];
  if (list.length <= max) {
    return list;
  }
  const sorted = list.sort(
    (a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0),
  );
  const kept = sorted.slice(0, max);
  if (activeId && !kept.some((session) => `${session?.id}` === `${activeId}`)) {
    const active = list.find((session) => `${session?.id}` === `${activeId}`);
    if (active) {
      kept[kept.length - 1] = active;
    }
  }
  return kept;
}
