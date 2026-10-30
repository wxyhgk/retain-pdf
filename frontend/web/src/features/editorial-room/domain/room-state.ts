/** 翻译编辑部的状态：把 editorial.v1 事件一条条叠上去，得到「每页走到哪、每个工位在忙什么、累计数字」。
 *
 * 纯函数，不碰 React 和时间。回放、以后接真实进度，都是同一个 reduceEditorialEvent 往上叠。
 *
 * 一页稿子的流转：
 *   通读（整本书一次）→ 派到译者 → 质检 →（不合格退回译者重翻，还不行进「待人看」筐）
 *   → 审校开单 → 修订 → 定稿归档。
 * 工位手上是哪一页不单独记，由每页的 stage 推出来（stationPages），免得两处对不上。
 */

import type { EditorialEvent, GlossaryAction } from "./events.js";

export type PageStage =
  | "waiting" // 还没派
  | "queued" // 派出去了，译者还没开始
  | "translating"
  | "checking"
  | "retrying" // 质检不合格，退回译者
  | "reviewing"
  | "revising"
  | "done";

export type CheckCounts = { ok: number; warn: number; error: number };

export type PageCard = {
  page: number;
  label: string;
  blocks: number;
  stage: PageStage;
  attempt: number;
  /** 最近一次质检（重翻后以新的为准）；定稿后换成 page_done 的终态。 */
  check: CheckCounts | null;
  codes: Record<string, number>;
  /** 显示原文、进了「待人看」筐的块数。 */
  fallback: number;
  review: { tickets: number; applied: number; rejected: number } | null;
  /** 最后一次变动的序号：同一工位有几页时，显示最近动过的那页。 */
  touched: number;
};

export type GlossaryEntry = { version: number; action: GlossaryAction; source: string; target: string };
export type AmbiguityTicket = { term: string; current: string; proposed: string; page: number };
export type BasketItem = { page: number; block: string; reason: string };

export type RunStatus = "idle" | "reading" | "running" | "stopped" | "done";

export type RoomState = {
  /** 已叠上去的事件数。 */
  seq: number;
  status: RunStatus;
  docTitle: string;
  model: string;
  pageCount: number;
  stopReason: string;
  reading: { genre: string; namePolicy: string; terms: number; headings: number } | null;
  readerDone: boolean;
  pages: PageCard[];
  glossary: { version: number; recent: GlossaryEntry[]; changedAt: number };
  tickets: AmbiguityTicket[];
  basket: BasketItem[];
  retries: number;
  last: EditorialEvent | null;
};

const GLOSSARY_RECENT = 5;

export function initialRoomState(): RoomState {
  return {
    seq: 0,
    status: "idle",
    docTitle: "",
    model: "",
    pageCount: 0,
    stopReason: "",
    reading: null,
    readerDone: false,
    pages: [],
    glossary: { version: 0, recent: [], changedAt: 0 },
    tickets: [],
    basket: [],
    retries: 0,
    last: null,
  };
}

function blankPage(page: number, touched: number): PageCard {
  return {
    page,
    label: String(page),
    blocks: 0,
    stage: "waiting",
    attempt: 0,
    check: null,
    codes: {},
    fallback: 0,
    review: null,
    touched,
  };
}

/** 改一页；没见过的页（run_started 没说那么多页）补上，按页码排好。 */
function withPage(state: RoomState, page: number, patch: (card: PageCard) => Partial<PageCard>): PageCard[] {
  const seq = state.seq + 1;
  const found = state.pages.some((card) => card.page === page);
  const pages = found ? state.pages : [...state.pages, blankPage(page, seq)].sort((a, b) => a.page - b.page);
  return pages.map((card) => (card.page === page ? { ...card, ...patch(card), touched: seq } : card));
}

export function reduceEditorialEvent(state: RoomState, event: EditorialEvent): RoomState {
  const next = applyEvent(state, event);
  return { ...next, seq: state.seq + 1, last: event };
}

function applyEvent(state: RoomState, event: EditorialEvent): RoomState {
  switch (event.type) {
    case "run_started": {
      const fresh = initialRoomState();
      const pages = Array.from({ length: Math.max(0, event.pages) }, (_, i) => blankPage(i + 1, 0));
      return {
        ...fresh,
        seq: state.seq,
        status: "running",
        docTitle: event.doc_title,
        model: event.model,
        pageCount: event.pages,
        pages,
      };
    }
    case "reading_started":
      return { ...state, status: "reading", readerDone: false };
    case "reading_done":
      return {
        ...state,
        status: "running",
        readerDone: true,
        reading: {
          genre: event.genre,
          namePolicy: event.name_policy,
          terms: event.terms,
          headings: event.headings,
        },
      };
    case "page_started":
      return {
        ...state,
        status: state.status === "reading" ? "running" : state.status,
        pages: withPage(state, event.page, () => ({
          label: event.label || String(event.page),
          blocks: event.blocks,
          stage: "queued",
        })),
      };
    case "translate_call":
      // 不是译者的模型调用记到各自的工位上：审校的请求算审校中，改稿的算修订中，通读的不动页。
      if (event.role === "reviewer") return { ...state, pages: withPage(state, event.page, () => ({ stage: "reviewing" })) };
      if (event.role === "reviser") return { ...state, pages: withPage(state, event.page, () => ({ stage: "revising" })) };
      if (event.role === "reader") return state;
      return {
        ...state,
        pages: withPage(state, event.page, () => ({ stage: "translating", attempt: event.attempt })),
      };
    case "check_result":
      return {
        ...state,
        pages: withPage(state, event.page, () => ({
          stage: "checking",
          attempt: event.attempt,
          check: { ok: event.ok, warn: event.warn, error: event.error },
          codes: event.codes,
        })),
      };
    case "retry":
      return {
        ...state,
        retries: state.retries + 1,
        pages: withPage(state, event.page, () => ({ stage: "retrying" })),
      };
    case "fallback":
      return {
        ...state,
        basket: [...state.basket, { page: event.page, block: event.block, reason: event.reason }],
        pages: withPage(state, event.page, (card) => ({ fallback: card.fallback + 1 })),
      };
    case "review_started":
      return { ...state, pages: withPage(state, event.page, () => ({ stage: "reviewing" })) };
    case "review_done":
      return {
        ...state,
        pages: withPage(state, event.page, () => ({
          stage: "revising",
          review: { tickets: event.tickets, applied: event.applied, rejected: event.rejected },
        })),
      };
    case "page_done": {
      const { ok, warn, error, fallback_source } = event.statuses;
      return {
        ...state,
        pages: withPage(state, event.page, (card) => ({
          stage: "done",
          check: { ok, warn, error },
          fallback: Math.max(card.fallback, fallback_source),
        })),
      };
    }
    case "glossary_changed": {
      const entry = { version: event.version, action: event.action, source: event.source, target: event.target };
      return {
        ...state,
        glossary: {
          version: Math.max(state.glossary.version, event.version),
          recent: [entry, ...state.glossary.recent].slice(0, GLOSSARY_RECENT),
          changedAt: state.seq + 1,
        },
      };
    }
    case "ticket_opened":
      return {
        ...state,
        tickets: [
          ...state.tickets,
          { term: event.term, current: event.current, proposed: event.proposed, page: event.page },
        ],
      };
    case "run_stopped":
      return { ...state, status: "stopped", stopReason: event.reason };
    case "run_done":
      return {
        ...state,
        status: "done",
        glossary: { ...state.glossary, version: Math.max(state.glossary.version, event.glossary_version) },
      };
    default:
      return state;
  }
}

/** 从头叠到第 count 条（回放拖进度条用）。 */
export function roomStateAt(events: readonly EditorialEvent[], count: number): RoomState {
  return events.slice(0, Math.max(0, count)).reduce(reduceEditorialEvent, initialRoomState());
}

export type StationKey = "translator" | "checker" | "reviewer" | "reviser";

const STAGE_STATION: Partial<Record<PageStage, StationKey>> = {
  // 派出去还没开翻的页已经在译者桌上了。
  queued: "translator",
  translating: "translator",
  retrying: "translator",
  checking: "checker",
  reviewing: "reviewer",
  revising: "reviser",
};

/** 每个工位手上的页：同一工位有几页时取最近动过的那页。 */
export function stationPages(state: RoomState): Record<StationKey, PageCard | null> {
  const result: Record<StationKey, PageCard | null> = { translator: null, checker: null, reviewer: null, reviser: null };
  for (const card of state.pages) {
    const key = STAGE_STATION[card.stage];
    if (key && (!result[key] || card.touched > (result[key] as PageCard).touched)) result[key] = card;
  }
  return result;
}

export type RoomTotals = CheckCounts & {
  fallback: number;
  applied: number;
  rejected: number;
  reviewTickets: number;
  donePages: number;
  glossaryVersion: number;
  ambiguity: number;
  retries: number;
};

/** 累计数字。质检数按每页最近一次算（重翻的块不重复计），定稿后按终态算。 */
export function roomTotals(state: RoomState): RoomTotals {
  const totals: RoomTotals = {
    ok: 0,
    warn: 0,
    error: 0,
    fallback: state.basket.length,
    applied: 0,
    rejected: 0,
    reviewTickets: 0,
    donePages: 0,
    glossaryVersion: state.glossary.version,
    ambiguity: state.tickets.length,
    retries: state.retries,
  };
  let finalFallback = 0;
  for (const card of state.pages) {
    if (card.check) {
      totals.ok += card.check.ok;
      totals.warn += card.check.warn;
      totals.error += card.check.error;
    }
    if (card.review) {
      totals.applied += card.review.applied;
      totals.rejected += card.review.rejected;
      totals.reviewTickets += card.review.tickets;
    }
    finalFallback += card.fallback;
    if (card.stage === "done") totals.donePages += 1;
  }
  totals.fallback = Math.max(totals.fallback, finalFallback);
  return totals;
}

/** 调度看板上还没派出去的页。 */
export function waitingPages(state: RoomState): PageCard[] {
  return state.pages.filter((card) => card.stage === "waiting");
}
