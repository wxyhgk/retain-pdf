/**
 * retainpdf-pi 的记忆和对话上下文（2026-11-26 第二期），和 Python 自带 agent 的 `retainpdf_ask_agent/memory.py` 同一套：
 * 经后端接口读写，库是正本。方案 docs/ops/planning/reader-ask/20261126-主对话副对话和记忆.md。
 *
 * - 开会话时取上下文（桥给了 `RETAIN_ASK_CONVERSATION_ID`）：`GET /ai/ask-conversations/{id}/context`。记忆那段（`memory_text`）
 *   由 `index.ts` 放进系统提示词的一节；摘要和最近几轮写成一段文字，放在这个会话第一问的最前面（pi 的会话历史塞不进去，
 *   和本机 agent 用 `context.text` 一个道理）。取不到当没有前文。
 * - 两个工具（有后端地址和密钥就给，不要书）：`remember`、`search_memories`，说明和 Python 版一字不差（测试钉着）。
 *   每一问最多记 3 次、查 2 次（额度在 `index.ts` 的 RoundGuard）。
 * - 「让 AI 使用记忆」总开关：每次调这两个工具前看一眼，关着就不发请求、回「用户关掉了记忆」。
 * - pi-acp 不转发我们的 `_meta`，「已记住（撤销）」小条前端按对话的新记忆取（`GET /ai/memories?source_conversation_id=…`）。
 */
import { ID_RE } from "./book.ts";
import type { ToolResult } from "./book.ts";

export const REMEMBER_TOOL = "remember";
export const SEARCH_TOOL = "search_memories";
export const MEMORY_TOOLS = [REMEMBER_TOOL, SEARCH_TOOL];
export const REMEMBER_PER_TURN = 3;
export const SEARCH_PER_TURN = 2;
export const MAX_MEMORY_CHARS = 500;
export const DEFAULT_SEARCH_LIMIT = 8;
export const MAX_SEARCH_LIMIT = 20;
// scope=all 时一起查的对话摘要：最多给几份、每份最多几个字（2026-11-26 第二期，和 Python 版一样）
export const MAX_SUMMARY_HITS = 3;
export const SUMMARY_HIT_CHARS = 400;
const SUMMARY_KIND_LABELS: Record<string, string> = { side: "副对话的结论", compaction: "以前对话的摘要" };
export const RECENT_TURNS = 6;
const TIMEOUT_MS = 10_000;
const CONTEXT_TIMEOUT_MS = 3_000;
export const CATEGORIES = ["preference", "background", "style", "progress", "term", "conclusion", "other"];
const CATEGORY_LABELS: Record<string, string> = {
  preference: "偏好", background: "背景", style: "回答风格", progress: "进度", term: "术语", conclusion: "结论", other: "其他",
};
export const DISABLED_NOTE = "用户在设置里关掉了「让 AI 使用记忆」，这次没有{}。照常回答，不用再调记忆的工具；用户要你记的话，告诉他先在设置里打开。";
export const SUMMARY_HEADING = "【之前对话的摘要】";

export const MEMORY_TOOL_SPECS = [
  {
    name: REMEMBER_TOOL,
    label: "记住",
    description:
      "把关于用户或这本书的一件事记下来，以后的对话都能用（用户能看到「已记住」，也能撤销）。"
      + "只记用户明说的偏好、背景、对回答的要求，和跟用户一起定下的术语译法、结论、读到哪；"
      + "不记书的内容本身，不记密钥、密码和别的隐私。一条一件事，写成「用户……」或「这本书……」。"
      + "和已有的记忆矛盾或要更新时，用 replaces 给旧记忆的编号（[mem-…]），不要再记一条重复的。",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: MAX_MEMORY_CHARS, description: "要记的一件事" },
        scope: { type: "string", enum: ["user", "book"], description: "user：关于用户（偏好、背景、回答风格）；book：关于正在读的这本书（读到哪、术语、结论）" },
        category: { type: "string", enum: CATEGORIES, description: "类别，默认 other" },
        replaces: { type: "string", description: "要替代的旧记忆编号（mem-…），可选" },
      },
      required: ["text", "scope"],
      additionalProperties: false,
    },
  },
  {
    name: SEARCH_TOOL,
    label: "查记忆",
    description:
      "查之前记下的记忆（关于用户的、关于这本书的），系统提示词里没列全或要找某件事时用；"
      + "scope=all 时也查以前对话的摘要（副对话的结论、压缩了的旧对话），想知道以前聊过什么也用它。"
      + "空格隔开的几个词都要在同一条里；找不到换个说法再试一次。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "要找的字或词" },
        scope: { type: "string", enum: ["user", "book", "all"], description: "查哪一层，默认 all（书层只查这本书）" },
        limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH_LIMIT, description: `最多几条，默认 ${DEFAULT_SEARCH_LIMIT}` },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

/** (方法, 路径, 请求体或 null, 超时) → { status, json }；连不上抛错。 */
export type HttpCall = (method: string, path: string, body: unknown, timeoutMs: number) => Promise<{ status: number; json: any }>;

export function defaultHttpCall(baseUrl: string, apiKey: string): HttpCall {
  const base = baseUrl.replace(/\/+$/, "");
  return async (method, path, body, timeoutMs) => {
    const response = await fetch(base + path, {
      method,
      headers: { "X-API-Key": apiKey, Accept: "application/json", ...(body == null ? {} : { "Content-Type": "application/json" }) },
      body: body == null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let json: any = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json };
  };
}

function ok(text: string, summary: string): ToolResult {
  return { text, images: [], isError: false, summary: summary.slice(0, 200) };
}

function fail(text: string, summary = text): ToolResult {
  return { text, images: [], isError: true, summary: summary.slice(0, 200) };
}

/** `{code, message, data}` → [data, 出错说明]。 */
function payload(reply: { status: number; json: any }): [any, string] {
  const json = reply.json;
  if (reply.status >= 200 && reply.status < 300 && json && typeof json === "object") return [json.data, ""];
  const message = json?.message ?? "";
  const reason = json?.error?.details?.reason;
  return [null, `HTTP ${reply.status}：${message}${reason ? `（${reason}）` : ""}`];
}

export function memoryLine(memory: Record<string, any>): string {
  const date = String(memory.updated_at ?? "").slice(0, 10);
  const label = CATEGORY_LABELS[String(memory.category ?? "")] ?? "其他";
  return `- [${memory.memory_id}] ${date} ${label}：${String(memory.text ?? "").trim()}`;
}

/** 查到的对话摘要：`- [副对话的结论] 日期：摘要（太长截断）`。 */
export function summaryLine(hit: Record<string, any>): string {
  const date = String(hit.created_at ?? "").slice(0, 10);
  const label = SUMMARY_KIND_LABELS[String(hit.kind ?? "")] ?? "以前对话的摘要";
  let text = String(hit.summary ?? "").split(/\s+/).filter(Boolean).join(" ");
  if ([...text].length > SUMMARY_HIT_CHARS) text = [...text].slice(0, SUMMARY_HIT_CHARS).join("") + "……";
  return `- [${label}] ${date}：${text}`;
}

/** 上下文 → 放在第一问前面的那段（摘要 + 最近几轮）；什么都没有是空串。记忆那段另放系统提示词。 */
export function historyText(context: Record<string, any> | null): string {
  if (!context) return "";
  const parts: string[] = [];
  const summary = String(context.summary ?? "").trim();
  if (summary) parts.push(`${SUMMARY_HEADING}\n${summary}`);
  const lines: string[] = [];
  const sources = [...((context.parent?.messages as any[]) ?? []), ...((context.messages as any[]) ?? [])];
  for (const message of sources) {
    if (!message || typeof message !== "object") continue;
    const text = String(message.text ?? "").trim();
    if (!text) continue;
    if (message.role === "side_summary") lines.push(`（副对话的结论）${text}`);
    else if (message.role === "assistant") lines.push(`你：${text}`);
    else lines.push(`我${Number.isInteger(message.page) ? `（第 ${message.page} 页）` : ""}：${text}`);
  }
  if (lines.length) parts.push(`【我们之前的对话（最近几轮）】\n\n${lines.join("\n\n")}`);
  return parts.join("\n\n");
}

export class MemoryTools {
  http: HttpCall;
  conversationId: string;
  documentId: string;
  jobId: string;
  /** 这一问的页（`index.ts` 从问题里的出处认出来），`remember` 记进出处。 */
  page: number | null = null;
  private contextPromise: Promise<Record<string, any> | null> | null = null;

  constructor(options: { http: HttpCall; conversationId?: string; documentId?: string; jobId?: string }) {
    this.http = options.http;
    const clean = (value?: string) => (value && ID_RE.test(value) ? value : "");
    this.conversationId = clean(options.conversationId);
    this.documentId = clean(options.documentId);
    this.jobId = clean(options.jobId);
  }

  /** 这个对话的上下文；只取一次（开会话时），取不到是 null。 */
  context(): Promise<Record<string, any> | null> {
    if (!this.contextPromise) this.contextPromise = this.fetchContext();
    return this.contextPromise;
  }

  private async fetchContext(): Promise<Record<string, any> | null> {
    if (!this.conversationId) return null;
    const query = new URLSearchParams({ recent_turns: String(RECENT_TURNS), ...(this.documentId ? { document_id: this.documentId } : {}) });
    try {
      const [data, problem] = payload(await this.http("GET", `/api/v1/ai/ask-conversations/${this.conversationId}/context?${query}`, null, CONTEXT_TIMEOUT_MS));
      return !problem && data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  /** 「让 AI 使用记忆」开着没有；看不了当开着（请求自己会报错）。 */
  async enabled(): Promise<boolean> {
    try {
      const [data, problem] = payload(await this.http("GET", "/api/v1/ai/ask-settings", null, TIMEOUT_MS));
      return problem !== "" || !data || data.memory_enabled !== false;
    } catch {
      return true;
    }
  }

  async run(name: string, args: Record<string, any>): Promise<ToolResult> {
    if (!MEMORY_TOOLS.includes(name)) return fail(`没有工具 ${name}`);
    if (!(await this.enabled())) return fail(DISABLED_NOTE.replace("{}", name === REMEMBER_TOOL ? "记" : "查"), "用户关掉了记忆");
    return name === REMEMBER_TOOL ? this.remember(args) : this.search(args);
  }

  private async remember(args: Record<string, any>): Promise<ToolResult> {
    const text = String(args.text ?? "").trim();
    const scope = args.scope;
    if (!text) return fail("text 不能是空的：写要记的那件事。");
    if ([...text].length > MAX_MEMORY_CHARS) return fail(`一条最多 ${MAX_MEMORY_CHARS} 字：拆成几件事分别记，或者写短一点。`);
    if (scope !== "user" && scope !== "book") return fail("scope 只能是 user 或 book。");
    const category = args.category || "other";
    if (!CATEGORIES.includes(category)) return fail(`category 只能是 ${CATEGORIES.join(", ")} 之一。`);
    const body: Record<string, any> = { scope, category, text, origin: "agent", agent_id: "retainpdf-pi" };
    if (scope === "book") {
      if (!this.documentId) return fail("现在不知道是哪本书，记不了书层的记忆；关于用户的事用 scope=user。");
      body.document_id = this.documentId;
    }
    if (this.conversationId) body.source_conversation_id = this.conversationId;
    if (this.jobId) body.source_job_id = this.jobId;
    if (this.page) body.source_page = this.page;
    const replaces = typeof args.replaces === "string" ? args.replaces.trim() : "";
    if (replaces) {
      if (!ID_RE.test(replaces)) return fail("replaces 要写旧记忆的编号（mem-…）。");
      body.replaces = replaces;
    }
    let reply;
    try {
      reply = await this.http("POST", "/api/v1/ai/memories", body, TIMEOUT_MS);
    } catch (error) {
      return fail(`连不上 RetainPDF 后端，没记上：${error}`);
    }
    const [data, problem] = payload(reply);
    if (problem.includes("ask_memory_disabled")) return fail(DISABLED_NOTE.replace("{}", "记"), "用户关掉了记忆");
    if (problem || !data?.memory) return fail(`没记上：${problem || "后端回的不对"}`);
    const memory = data.memory;
    const note = data.created ? "记住了" : "已经记过一模一样的，没有重复记";
    const replaced = data.replaced ? `旧的 ${data.replaced} 已标为被替代。` : "";
    return ok(`${note}（${memory.memory_id}）。${replaced}`, `已记住：${memory.text}`);
  }

  private async search(args: Record<string, any>): Promise<ToolResult> {
    const query = String(args.query ?? "").trim();
    if (!query) return fail("query 不能是空的。");
    const scope = args.scope || "all";
    if (!["user", "book", "all"].includes(scope)) return fail("scope 只能是 user、book 或 all。");
    const limit = Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= MAX_SEARCH_LIMIT ? args.limit : DEFAULT_SEARCH_LIMIT;
    const found: Record<string, any>[] = [];
    const summaries: Record<string, any>[] = [];
    for (const layer of scope === "all" ? ["user", "book"] : [scope]) {
      const documentId = layer === "book" ? this.documentId : "";
      if (layer === "book" && scope === "all" && !documentId) continue;
      const params = new URLSearchParams({ q: query, scope: layer, limit: String(limit), ...(documentId ? { document_id: documentId } : {}) });
      // 对话摘要不分层，跟着第一次查一起要
      if (scope === "all" && layer === "user") params.set("include_summaries", "true");
      let reply;
      try {
        reply = await this.http("GET", `/api/v1/ai/memories?${params}`, null, TIMEOUT_MS);
      } catch (error) {
        return fail(`没查成：连不上 RetainPDF 后端：${error}`);
      }
      const [data, problem] = payload(reply);
      if (problem) return fail(`没查成：${problem}`);
      found.push(...((data?.memories as any[]) ?? []).filter((memory) => memory && typeof memory === "object"));
      summaries.push(...((data?.summaries as any[]) ?? []).filter((hit) => hit && typeof hit === "object"));
    }
    if (!found.length && !summaries.length) return ok(`记忆里没有找到「${query}」。`, "没找到");
    const lines = found.slice(0, limit).map((memory) => {
      const layer = memory.scope === "user" ? "关于用户" : memory.document_id === this.documentId ? "这本书" : "别的书";
      return `${memoryLine(memory)}（${layer}）`;
    });
    lines.push(...summaries.slice(0, MAX_SUMMARY_HITS).map(summaryLine));
    const note = `找到 ${Math.min(found.length, limit)} 条` + (summaries.length ? `、${Math.min(summaries.length, MAX_SUMMARY_HITS)} 份对话摘要` : "");
    return ok(lines.join("\n"), note);
  }
}

/** 按桥给的环境变量建；没有后端地址或密钥就不给（没有记忆、没有前文）。 */
export function makeMemoryTools(env: NodeJS.ProcessEnv = process.env, http?: HttpCall): MemoryTools | null {
  const baseUrl = (env.RETAIN_ASK_BACKEND_URL || "").trim();
  const apiKey = (env.RETAIN_ASK_BACKEND_KEY || "").trim();
  if (!baseUrl || !apiKey) return null;
  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) return null;
  } catch {
    return null;
  }
  return new MemoryTools({
    http: http ?? defaultHttpCall(baseUrl, apiKey),
    conversationId: env.RETAIN_ASK_CONVERSATION_ID,
    documentId: env.RETAIN_ASK_DOCUMENT_ID,
    jobId: env.RETAIN_ASK_JOB_ID,
  });
}
