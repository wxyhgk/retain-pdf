import type {
  ReaderLiveTranslationCommitEvent as LiveTranslationCommitEvent,
  ReaderLiveTranslationItem as LiveTranslationItem,
  ReaderLiveTranslationLayout as LiveTranslationLayout,
  ReaderLiveTranslationLayoutPage as LiveTranslationLayoutPage,
  ReaderLiveTranslationPageSnapshot as LiveTranslationPageSnapshot,
} from "../../contracts/live-translation.js";

export type LiveTranslationPageState = {
  attempt: number;
  generation: number;
  pageHash: string;
  itemsById: ReadonlyMap<string, LiveTranslationItem>;
  /** Last authoritative SSE seq that changed this item; used only as an animation key. */
  changedAtSeqById: ReadonlyMap<string, number>;
  lastEventSeq: number;
};

export type LiveTranslationState = {
  layoutByPage: ReadonlyMap<number, LiveTranslationLayoutPage>;
  pagesByPage: ReadonlyMap<number, LiveTranslationPageState>;
  lastSeq: number;
  connection: "idle" | "connecting" | "live" | "reconnecting" | "terminal" | "unavailable";
  /** Authoritative task status supplied by the Reader session. */
  jobStatus: string;
  /** Human-readable transport/capability failure. Never contains translated content. */
  error: string;
};

export const EMPTY_LIVE_TRANSLATION_STATE: LiveTranslationState = {
  layoutByPage: new Map(),
  pagesByPage: new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: "",
};

export function layoutPageMap(layout: LiveTranslationLayout): ReadonlyMap<number, LiveTranslationLayoutPage> {
  return new Map((layout?.pages || []).map((page) => [page.page_idx, page]));
}

export type SnapshotDecision = "accept" | "ignore" | "retry";

function compareVersion(
  left: Pick<LiveTranslationPageState | LiveTranslationPageSnapshot, "attempt" | "generation">,
  right: Pick<LiveTranslationPageState | LiveTranslationPageSnapshot, "attempt" | "generation">,
): number {
  if (left.attempt !== right.attempt) return left.attempt < right.attempt ? -1 : 1;
  if (left.generation !== right.generation) return left.generation < right.generation ? -1 : 1;
  return 0;
}

/**
 * Decide against the event first, then against the already rendered page.
 * A newer snapshot is valid because the immutable page endpoint may have advanced
 * again between the SSE hint and this read.
 */
export function decideLiveTranslationSnapshot(
  current: LiveTranslationPageState | undefined,
  event: LiveTranslationCommitEvent,
  snapshot: LiveTranslationPageSnapshot,
): SnapshotDecision {
  if (snapshot.page_idx !== event.page_idx) return "retry";
  const againstEvent = compareVersion(snapshot, event);
  if (againstEvent < 0) return "retry";
  if (againstEvent === 0 && snapshot.page_hash !== event.page_hash) return "retry";
  if (!current) return "accept";
  const againstCurrent = compareVersion(snapshot, current);
  if (againstCurrent < 0) return "ignore";
  if (againstCurrent === 0) {
    // 同版本、hash 对不上 → **以后端为准**，不能 retry。
    //
    // 走到这一行时快照已经过了对事件的全部校验（版本不低于事件，且同版本时
    // hash 与事件一致），也就是后端给的就是权威答案。而 retry 会去重读**同一个
    // 不可变端点** 9 次（SNAPSHOT_RETRY_MS 累计 8.2s），后端那三个字段来自同一行
    // DB 记录，9 次的答案必然完全相同 —— 这条 retry 在物理上不可能成功。
    //
    // 代价是实打实的：那 8.2 秒里 onEvent 被 await 堵着，**后面所有页的译文一起
    // 停**；9 次之后放弃这一页并推进 lastSeq，而重连用 afterSeq，这个事件再也不会
    // 被重放 —— 该页于本次会话内永久停在旧版本。
    return snapshot.page_hash === current.pageHash ? "ignore" : "accept";
  }
  return "accept";
}

export function applyLiveTranslationSnapshot(
  state: LiveTranslationState,
  event: LiveTranslationCommitEvent,
  snapshot: LiveTranslationPageSnapshot,
): LiveTranslationState {
  if (event.seq <= state.lastSeq) return state;
  const current = state.pagesByPage.get(event.page_idx);
  const decision = decideLiveTranslationSnapshot(current, event, snapshot);
  if (decision === "retry") return state;
  if (decision === "ignore") {
    return { ...state, lastSeq: event.seq, connection: "live", error: "" };
  }
  const itemsById = new Map(snapshot.items.map((item) => [item.item_id, item]));
  const changedAtSeqById = new Map(current?.changedAtSeqById || []);
  for (const itemId of event.changed_item_ids) {
    if (itemsById.has(itemId)) changedAtSeqById.set(itemId, event.seq);
  }
  const pagesByPage = new Map(state.pagesByPage);
  pagesByPage.set(event.page_idx, {
    attempt: snapshot.attempt,
    generation: snapshot.generation,
    pageHash: snapshot.page_hash,
    itemsById,
    changedAtSeqById,
    lastEventSeq: event.seq,
  });
  return {
    ...state,
    pagesByPage,
    lastSeq: event.seq,
    connection: "live",
    error: "",
  };
}

/** 实时译文叠层的开关分布在两处，这里是那个分布的唯一真源。
 *
 * - 顶栏 pill（ReaderWorkspaceTabs 的 liveTranslation）：兼报状态（N 页 /
 *   重连中），任务进终态后只剩一句永久的「已完成」，所以终态不给。
 * - 源文栏内的「译文」按钮（ReaderAppReactPdf 的 sourcePaneAction）：只要源文
 *   栏在台面上就在，它贴着叠层落地的那一栏。
 *
 * 收掉顶栏 pill 的前提是第二个开关接得住 —— 这个函数存在就是为了让那句话可测，
 * 见 reader-one-ai-door.test.mjs 的「叠层画得出来，就一定至少有一个开关够得着」。
 *
 * # 两处曾经写错的地方（都被 subagent 审查抓出来）
 *
 * 1. 注释里写的是「见 overlayToggleAlwaysReachable」，而那个名字**全仓不存在**
 *    —— 写注释时凭印象编了个英文名，没回头核。
 * 2. `overlayRenderable` 号称「叠层此刻是否真的会画到屏幕上」，实际算的是
 *    `hasOverlayContent && showSource`，漏了 liveTranslationVisible 和
 *    assistantOpen。穷举 96 种组合，**有 24 行它在撒谎**（返回 true 而叠层一行
 *    都没画）。于是那条不变式测试守的是一个名不副实的条件。
 *
 * 现在它按 overlayOnSource 的真实条件算（见 resolveReaderPaneComposition）。
 */
export type LiveTranslationToggles = {
  /** 顶栏那个带状态文字的 pill */
  topBarPill: boolean;
  /** 源文栏内部那个「译文」按钮 */
  sourcePaneToggle: boolean;
  /** 叠层此刻是否**真的会画到屏幕上**。名字说什么就得是什么 —— 它曾经只算
   * 「有内容 + 源文栏在台面上」，96 种组合里有 24 行在撒谎。 */
  overlayRenderable: boolean;
};

export function resolveLiveTranslationToggles(input: {
  hasOverlayContent: boolean;
  connection: LiveTranslationState["connection"];
  showSource: boolean;
  /** 用户开着叠层没有。不看它，overlayRenderable 就是在说「有内容」而不是
   * 「在画」。 */
  liveTranslationVisible: boolean;
  /** 辅助面板开着时叠层被抑制（resolveReaderPaneComposition 的 overlayOnSource
   * 里那条 `&& !assistantOpen`）。 */
  assistantOpen: boolean;
}): LiveTranslationToggles {
  const { hasOverlayContent, connection, showSource } = input;
  return {
    topBarPill: hasOverlayContent && connection !== "terminal",
    // 顶栏 pill 在的时候它就是开关（还带进度），源栏不再另放一颗「译文」：
    // 两颗管同一件事的按钮并排在屏幕上，看着像两个功能。
    sourcePaneToggle: hasOverlayContent && showSource && connection === "terminal",
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: hasOverlayContent
      && showSource
      && input.liveTranslationVisible
      && !input.assistantOpen,
  };
}

/** 最近一次有译文落进来的那一页（1 起），一页都没有时为 null。顶栏「跳到最新」跳这里。
 * 按事件序号取，不按页码取：并发翻译时页不是按顺序出来的。 */
export function latestLiveTranslationPage(state: LiveTranslationState): number | null {
  let latest: { page: number; seq: number } | null = null;
  for (const [pageIdx, page] of state.pagesByPage) {
    if (!latest || page.lastEventSeq > latest.seq) latest = { page: pageIdx + 1, seq: page.lastEventSeq };
  }
  return latest ? latest.page : null;
}

/** 这一页叠层开着、别的页已经有译文、唯独这页还没有 —— 页面上提示一句「还没翻到」，
 * 不然用户看到一页原文，分不清是没翻到还是叠层坏了。一页都没有时由整栏的等待提示说，
 * 任务停了（终态）也不说「会自动出现」。 */
export function liveTranslationPageMissing(state: LiveTranslationState | undefined, pageIdx: number): boolean {
  if (!state || state.connection === "terminal") return false;
  if (state.pagesByPage.size === 0) return false;
  return state.layoutByPage.has(pageIdx) && !state.pagesByPage.has(pageIdx);
}

/** 打开阅读页时要不要直接把实时译文叠上去。
 *
 * 从进度页点「实时译文」进来，要看的就是译文；以前默认关着，进来只看到原文，
 * 得自己找左上角的小按钮。只在还没有最终译文 PDF（sourceViewOnly）时自动打开：
 * 那时只有一栏原文，不会出现以前「左右都是中文」的问题。 */
export function shouldAutoOpenLiveTranslation(input: {
  liveTranslationAvailable: boolean;
  sourceViewOnly: boolean;
  jobTerminal: boolean;
}): boolean {
  return input.liveTranslationAvailable && input.sourceViewOnly && !input.jobTerminal;
}

/** 这次在阅读页里看着它翻完了：顶栏给一个「翻译完成 · 看对照」。
 * 打开时就已经完成的书不给（没跟实时译文，pagesByPage 是空的）。 */
export function shouldOfferLiveTranslationCompletion(input: {
  state: LiveTranslationState;
  sourceViewOnly: boolean;
  visibleMode: "source" | "compare" | "translated";
}): boolean {
  return input.state.connection === "terminal"
    && input.state.jobStatus === "succeeded"
    && input.state.pagesByPage.size > 0
    && !input.sourceViewOnly
    && input.visibleMode !== "compare";
}
