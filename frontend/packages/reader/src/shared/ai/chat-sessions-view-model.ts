// 共享真值（原 frontend/web/src/js/reader/ai/chat-sessions-view-model.ts），已抽离为 standalone
// 无宿主依赖，纯逻辑
import type {
  ReaderAiChatSession,
  ReaderAiSessionSummary,
  ReaderAiSessionsBag,
} from "../types/types.js";

export const MAX_SESSIONS = 20;
const TITLE_MAX = 18;

// 会话标题:取首条用户消息(清洗空白后裁剪);无用户消息则回退占位。
export function deriveSessionTitle(session: ReaderAiChatSession = {}): string {
  const messages = Array.isArray((session as any)?.messages) ? (session as any).messages : [];
  const firstUser = messages.find(
    (item: any) => item?.role === "user" && `${item?.text || ""}`.trim(),
  );
  const raw = `${(firstUser as any)?.text || (session as any)?.title || ""}`.replace(/\s+/g, " ").trim();
  if (!raw) {
    return "新对话";
  }
  return raw.length > TITLE_MAX ? `${raw.slice(0, TITLE_MAX).trim()}…` : raw;
}

// 会话摘要:按 updatedAt 倒序(新在前),标记 active,供下拉渲染。
export function summarizeSessions({
  sessions = [],
  activeId = "",
}: ReaderAiSessionsBag = {}): ReaderAiSessionSummary[] {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => ({
      id: `${(session as any)?.id || ""}`,
      title: deriveSessionTitle(session as any),
      updatedAt: Number((session as any)?.updatedAt) || 0,
      messageCount: Array.isArray((session as any)?.messages) ? (session as any).messages.length : 0,
      active: `${(session as any)?.id || ""}` === `${activeId}`,
    }))
    .filter((summary) => summary.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// 上限截断:保留最近更新的 max 个;active 会话始终保留(挤掉最旧的一个)。
export function trimSessions(
  { sessions = [], activeId = "" }: ReaderAiSessionsBag = {},
  max = MAX_SESSIONS,
): ReaderAiChatSession[] {
  const list = Array.isArray(sessions) ? [...sessions] : [];
  if (list.length <= max) {
    return list;
  }
  const sorted = list.sort(
    (a, b) => (Number((b as any)?.updatedAt) || 0) - (Number((a as any)?.updatedAt) || 0),
  );
  const kept = sorted.slice(0, max);
  if (activeId && !kept.some((session) => `${(session as any)?.id}` === `${activeId}`)) {
    const active = list.find((session) => `${(session as any)?.id}` === `${activeId}`);
    if (active) {
      kept[kept.length - 1] = active;
    }
  }
  return kept;
}
