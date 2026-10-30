/** 翻译编辑部的事件格式 editorial.v1：后端翻译 agent 按这个推进度，前端只认这些事件。
 *
 * 每条都有 { v: "editorial.v1", ts: 秒, type }，再加各自的字段。后端约定只加不改：
 * 不认识的 type、多出来的字段都忽略，不报错；版本号不是 editorial.v1 的整条忽略。
 */

export const EDITORIAL_EVENT_VERSION = "editorial.v1";

export type StopReason = "quota_exhausted" | "auth_failed" | "rate_limited" | string;
export type GlossaryAction = "add" | "promote" | "revise" | "widen" | "candidate" | string;

type Base = { ts: number };

export type EditorialEvent =
  | (Base & { type: "run_started"; pages: number; model: string; doc_title: string })
  | (Base & { type: "reading_started" })
  | (Base & { type: "reading_done"; genre: string; name_policy: string; terms: number; headings: number })
  | (Base & { type: "page_started"; page: number; label: string; blocks: number })
  // role：translator 译者（缺省）、reviewer 审校、reviser 改稿、reader 通读。现在每个角色只有一个。
  | (Base & { type: "translate_call"; page: number; attempt: number; blocks: string[]; role: string })
  | (Base & {
      type: "check_result";
      page: number;
      attempt: number;
      ok: number;
      warn: number;
      error: number;
      codes: Record<string, number>;
    })
  | (Base & { type: "retry"; page: number; blocks: string[] })
  | (Base & { type: "fallback"; page: number; block: string; reason: string })
  | (Base & { type: "review_started"; page: number; blocks: number })
  | (Base & { type: "review_done"; page: number; tickets: number; applied: number; rejected: number })
  | (Base & { type: "glossary_changed"; version: number; action: GlossaryAction; source: string; target: string })
  | (Base & { type: "ticket_opened"; term: string; current: string; proposed: string; page: number })
  | (Base & {
      type: "page_done";
      page: number;
      statuses: { ok: number; warn: number; error: number; fallback_source: number };
    })
  | (Base & { type: "run_stopped"; reason: StopReason })
  | (Base & { type: "run_done"; pages: number; glossary_version: number; tickets: number });

export type EditorialEventType = EditorialEvent["type"];

type Rec = Record<string, unknown>;

const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.map(str) : []);
const counts = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Rec).map(([key, n]) => [key, num(n)]));
};

// 每种事件怎么从原始 JSON 取字段。缺的字段给 0 / 空串，不整条丢掉。
const READERS: Record<EditorialEventType, (raw: Rec) => Rec> = {
  run_started: (r) => ({ pages: num(r.pages), model: str(r.model), doc_title: str(r.doc_title) }),
  reading_started: () => ({}),
  reading_done: (r) => ({
    genre: str(r.genre),
    name_policy: str(r.name_policy),
    terms: num(r.terms),
    headings: num(r.headings),
  }),
  page_started: (r) => ({ page: num(r.page), label: str(r.label ?? r.page), blocks: num(r.blocks) }),
  translate_call: (r) => ({
    page: num(r.page),
    attempt: num(r.attempt) || 1,
    blocks: strList(r.blocks),
    role: str(r.role) || "translator",
  }),
  check_result: (r) => ({
    page: num(r.page),
    attempt: num(r.attempt) || 1,
    ok: num(r.ok),
    warn: num(r.warn),
    error: num(r.error),
    codes: counts(r.codes),
  }),
  retry: (r) => ({ page: num(r.page), blocks: strList(r.blocks) }),
  fallback: (r) => ({ page: num(r.page), block: str(r.block), reason: str(r.reason) }),
  review_started: (r) => ({ page: num(r.page), blocks: num(r.blocks) }),
  review_done: (r) => ({
    page: num(r.page),
    tickets: num(r.tickets),
    applied: num(r.applied),
    rejected: num(r.rejected),
  }),
  glossary_changed: (r) => ({
    version: num(r.version),
    action: str(r.action),
    source: str(r.source),
    target: str(r.target),
  }),
  ticket_opened: (r) => ({ term: str(r.term), current: str(r.current), proposed: str(r.proposed), page: num(r.page) }),
  page_done: (r) => {
    const s = (r.statuses && typeof r.statuses === "object" ? r.statuses : {}) as Rec;
    return {
      page: num(r.page),
      statuses: { ok: num(s.ok), warn: num(s.warn), error: num(s.error), fallback_source: num(s.fallback_source) },
    };
  },
  run_stopped: (r) => ({ reason: str(r.reason) }),
  run_done: (r) => ({ pages: num(r.pages), glossary_version: num(r.glossary_version), tickets: num(r.tickets) }),
};

/** 原始 JSON → 事件。版本不对、type 不认识的返回 null（调用方跳过）。 */
export function parseEditorialEvent(raw: unknown): EditorialEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Rec;
  if (rec.v !== EDITORIAL_EVENT_VERSION) return null;
  const type = str(rec.type) as EditorialEventType;
  const read = Object.prototype.hasOwnProperty.call(READERS, type) ? READERS[type] : null;
  if (!read) return null;
  return { type, ts: num(rec.ts), ...read(rec) } as EditorialEvent;
}

/** 一串原始 JSON（或 JSONL 文本拆好的行）→ 认得的事件，保持原来的先后。 */
export function parseEditorialEvents(raws: readonly unknown[]): EditorialEvent[] {
  return raws.map(parseEditorialEvent).filter((event): event is EditorialEvent => event !== null);
}
