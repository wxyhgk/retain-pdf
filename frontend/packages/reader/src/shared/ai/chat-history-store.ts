// 共享真值（原 frontend/web/src/js/reader/ai/chat-history-store.ts），已抽离为 standalone
// 无宿主依赖，纯 localStorage + view-model

import { summarizeSessions, trimSessions } from "./chat-sessions-view-model.js";

const STORAGE_PREFIX = "retainpdf-ai-chat-v1:";
const MAX_TURNS = 40;

function storageKey(jobId: string): string {
  return `${STORAGE_PREFIX}${`${jobId || ""}`.trim()}`;
}

function nowMs(): number {
  try {
    return Date.now();
  } catch (_err) {
    return 0;
  }
}

function emptySession(id: string, createdAt: number): any {
  return { id, title: "", createdAt, updatedAt: createdAt, messages: [], history: [] };
}

export function createReaderAiHistoryStore({
  jobId = "",
  storage = (globalThis as any).localStorage || null,
}: { jobId?: string; storage?: Storage | null } = {}): any {
  const key = storageKey(jobId);
  const enabled = Boolean(`${jobId || ""}`.trim() && storage);
  let seq = 0;

  function newId(): string {
    seq += 1;
    return `s-${nowMs().toString(36)}-${seq}`;
  }

  // 读出规范化的多会话数据;吞掉解析异常并迁移旧格式。
  function readData(): any {
    const blank = { activeId: "", sessions: [] };
    if (!enabled) {
      return blank;
    }
    let parsed: any = null;
    try {
      const raw = storage!.getItem(key);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return blank;
    }
    if (!parsed || typeof parsed !== "object") {
      return blank;
    }
    // 新格式
    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.filter((item: any) => item && `${item.id || ""}`.trim());
      const activeId = sessions.some((item: any) => `${item.id}` === `${parsed.activeId}`)
        ? `${parsed.activeId}`
        : `${sessions[0]?.id || ""}`;
      return { activeId, sessions };
    }
    // 旧格式单会话:{messages, history} → 迁移为一条会话
    if (Array.isArray(parsed.messages) || Array.isArray(parsed.history)) {
      const created = nowMs();
      const session = {
        ...emptySession(newId(), created),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
      return { activeId: session.id, sessions: [session] };
    }
    return blank;
  }

  function writeData(data: any): void {
    if (!enabled) {
      return;
    }
    try {
      const sessions = trimSessions(data);
      const activeId = sessions.some((item: any) => `${item.id}` === `${data.activeId}`)
        ? data.activeId
        : `${sessions[0]?.id || ""}`;
      storage!.setItem(key, JSON.stringify({ v: 2, activeId, sessions }));
    } catch (_err) {
      // 配额满/隐私模式:静默失败,不影响会话内使用
    }
  }

  // 取当前 active 会话;没有则就地补一条空会话(save/newSession 前的兜底)。
  function ensureActive(data: any): any {
    let active = data.sessions.find((item: any) => `${item.id}` === `${data.activeId}`);
    if (!active) {
      active = emptySession(newId(), nowMs());
      data.sessions.push(active);
      data.activeId = active.id;
    }
    return active;
  }

  // ===== 单会话层(向后兼容) =====

  function load(): any {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    const active = data.sessions.find((item: any) => `${item.id}` === `${data.activeId}`);
    return {
      messages: Array.isArray(active?.messages) ? active.messages : [],
      history: Array.isArray(active?.history) ? active.history : [],
    };
  }

  function save({ messages = [], history = [] }: { messages?: any[]; history?: any[] } = {}): void {
    if (!enabled) {
      return;
    }
    const data = readData();
    const active = ensureActive(data);
    // 上限截断:每条会话只保留最近若干轮,避免 localStorage 无限增长
    active.messages = messages.slice(-MAX_TURNS);
    active.history = history.slice(-MAX_TURNS);
    active.updatedAt = nowMs();
    writeData(data);
  }

  // 清空当前会话内容(会话本身保留,标题回退占位)。
  function clear(): void {
    if (!enabled) {
      return;
    }
    const data = readData();
    const active = ensureActive(data);
    active.messages = [];
    active.history = [];
    active.title = "";
    active.updatedAt = nowMs();
    writeData(data);
  }

  // ===== 多会话层 =====

  function listSessions(): any[] {
    if (!enabled) {
      return [];
    }
    return summarizeSessions(readData());
  }

  function activeSessionId(): string {
    if (!enabled) {
      return "";
    }
    return `${readData().activeId || ""}`;
  }

  // 新建空会话并置为 active,返回新会话 id。
  function newSession(): string {
    if (!enabled) {
      return "";
    }
    const data = readData();
    const session = emptySession(newId(), nowMs());
    data.sessions.push(session);
    data.activeId = session.id;
    writeData(data);
    return session.id;
  }

  // 切换 active 会话;id 不存在则忽略。返回该会话的 {messages, history}。
  function switchSession(id: string): any {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    if (data.sessions.some((item: any) => `${item.id}` === `${id}`)) {
      data.activeId = `${id}`;
      writeData(data);
    }
    return load();
  }

  // 删除指定会话;删的是 active 时改指向最近更新的一条(全删光则补一条空会话)。
  // 返回删除后 active 会话的 {messages, history}。
  function deleteSession(id: string): any {
    if (!enabled) {
      return { messages: [], history: [] };
    }
    const data = readData();
    const target = `${id || data.activeId}`;
    data.sessions = data.sessions.filter((item: any) => `${item.id}` !== target);
    if (`${data.activeId}` === target) {
      const next = summarizeSessions(data)[0];
      data.activeId = next ? next.id : "";
    }
    if (!data.sessions.length) {
      const session = emptySession(newId(), nowMs());
      data.sessions.push(session);
      data.activeId = session.id;
    }
    writeData(data);
    return load();
  }

  return {
    load,
    save,
    clear,
    enabled,
    listSessions,
    activeSessionId,
    newSession,
    switchSession,
    deleteSession,
  };
}
