/** 编辑部的模拟进度：后端还没推真实事件之前，用这串 editorial.v1 事件演示和测试。
 *
 * 6 页，每页安排一种情况：重翻后合格、有警告、重翻还不行进「待人看」筐、歧义单、
 * 术语表改版……第 N 页在审校的同时，第 N+1 页已经派给译者，两个工位一起动。
 * stopAfterPage 给了就在那页定稿后以「额度用完」停下（演示能接着跑的停法）。
 */

import { EDITORIAL_EVENT_VERSION, type EditorialEvent } from "./events.js";

type Aside =
  | { type: "glossary_changed"; version: number; action: string; source: string; target: string }
  | { type: "ticket_opened"; term: string; current: string; proposed: string; page: number };

type PageScript = {
  blocks: number;
  /** 每次质检的 [合格, 警告, 不合格, 代码]；不止一次就是有重翻。 */
  checks: Array<[number, number, number, Record<string, number>]>;
  /** 重翻还不行、放进「待人看」筐的块。 */
  fallback?: { block: string; reason: string };
  review: [blocks: number, tickets: number, applied: number, rejected: number];
  /** 审校这页时顺带发生的事（术语表改版、歧义单）。 */
  aside?: Aside[];
};

const PAGES: PageScript[] = [
  { blocks: 6, checks: [[5, 0, 1, { number_lost: 1 }], [6, 0, 0, {}]], review: [4, 2, 1, 1] },
  {
    blocks: 8,
    checks: [[7, 1, 0, { term_mismatch: 1 }]],
    review: [6, 1, 1, 0],
    aside: [{ type: "glossary_changed", version: 3, action: "promote", source: "bounding box", target: "边界框" }],
  },
  {
    blocks: 5,
    checks: [[4, 0, 1, { formula_changed: 1 }], [4, 0, 1, { formula_changed: 1 }]],
    fallback: { block: "p3-2", reason: "formula_changed" },
    review: [4, 0, 0, 0],
  },
  {
    blocks: 7,
    checks: [[7, 0, 0, {}]],
    review: [5, 3, 2, 1],
    aside: [
      { type: "ticket_opened", term: "attention", current: "注意力", proposed: "关注", page: 4 },
      { type: "glossary_changed", version: 4, action: "candidate", source: "reading order", target: "阅读顺序" },
    ],
  },
  { blocks: 9, checks: [[7, 2, 0, { footnote_lost: 2 }]], review: [7, 1, 1, 0] },
  {
    blocks: 4,
    checks: [[4, 0, 0, {}]],
    review: [3, 0, 0, 0],
    aside: [{ type: "glossary_changed", version: 5, action: "revise", source: "token", target: "词元" }],
  },
];

export const DEMO_DOC_TITLE = "Reading Machines";
export const DEMO_MODEL = "claude-haiku-5-5";

export function buildDemoEditorialRun(options: { stopAfterPage?: number } = {}): EditorialEvent[] {
  const events: EditorialEvent[] = [];
  let ts = 0;
  // 每条事件离上一条隔几秒（模拟真实耗时；回放时会按倍速压缩）。
  const push = (gap: number, event: Record<string, unknown>) => {
    ts += gap;
    events.push({ v: EDITORIAL_EVENT_VERSION, ts, ...event } as unknown as EditorialEvent);
  };
  const total = PAGES.length;
  const blockIds = (page: number, n: number) => Array.from({ length: n }, (_, i) => `p${page}-${i + 1}`);

  const head = (page: number) => {
    const script = PAGES[page - 1];
    push(1, { type: "page_started", page, label: String(page), blocks: script.blocks });
    push(1, { type: "translate_call", page, attempt: 1, blocks: blockIds(page, script.blocks), role: "translator" });
  };
  const tail = (page: number) => {
    const script = PAGES[page - 1];
    script.checks.forEach(([ok, warn, error, codes], index) => {
      const attempt = index + 1;
      if (attempt > 1) {
        const failed = script.fallback ? [script.fallback.block] : [`p${page}-3`];
        push(1, { type: "retry", page, blocks: failed });
        push(1, { type: "translate_call", page, attempt, blocks: failed, role: "translator" });
      }
      push(attempt > 1 ? 3 : 5, { type: "check_result", page, attempt, ok, warn, error, codes });
    });
    if (script.fallback) push(1, { type: "fallback", page, ...script.fallback });
  };

  push(0, { type: "run_started", pages: total, model: DEMO_MODEL, doc_title: DEMO_DOC_TITLE });
  push(1, { type: "reading_started" });
  push(3, { type: "glossary_changed", version: 1, action: "add", source: "bounding box", target: "边界框" });
  push(2, { type: "glossary_changed", version: 2, action: "add", source: "layout analysis", target: "版面分析" });
  push(3, { type: "reading_done", genre: "science_paper", name_policy: "keep", terms: 22, headings: 43 });

  head(1);
  tail(1);
  for (let page = 1; page <= total; page += 1) {
    const script = PAGES[page - 1];
    const [blocks, tickets, applied, rejected] = script.review;
    push(1, { type: "review_started", page, blocks });
    const hasNext = page < total && page !== options.stopAfterPage;
    if (hasNext) head(page + 1);
    for (const aside of script.aside || []) push(1, aside);
    push(2, { type: "review_done", page, tickets, applied, rejected });
    const [ok, warn, error] = script.checks[script.checks.length - 1];
    push(1, {
      type: "page_done",
      page,
      statuses: { ok, warn, error: script.fallback ? 0 : error, fallback_source: script.fallback ? 1 : 0 },
    });
    if (page === options.stopAfterPage) {
      push(1, { type: "run_stopped", reason: "quota_exhausted" });
      return events;
    }
    if (hasNext) tail(page + 1);
  }
  const tickets = PAGES.reduce((sum, script) => sum + (script.aside || []).filter((a) => a.type === "ticket_opened").length, 0);
  const version = Math.max(2, ...PAGES.flatMap((script) => (script.aside || []).map((a) => (a.type === "glossary_changed" ? a.version : 0))));
  push(1, { type: "run_done", pages: total, glossary_version: version, tickets });
  return events;
}
