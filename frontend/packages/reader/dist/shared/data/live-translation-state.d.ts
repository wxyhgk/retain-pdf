import type { ReaderLiveTranslationCommitEvent as LiveTranslationCommitEvent, ReaderLiveTranslationItem as LiveTranslationItem, ReaderLiveTranslationLayout as LiveTranslationLayout, ReaderLiveTranslationLayoutPage as LiveTranslationLayoutPage, ReaderLiveTranslationPageSnapshot as LiveTranslationPageSnapshot } from "../../contracts/live-translation.js";
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
export declare const EMPTY_LIVE_TRANSLATION_STATE: LiveTranslationState;
export declare function layoutPageMap(layout: LiveTranslationLayout): ReadonlyMap<number, LiveTranslationLayoutPage>;
export type SnapshotDecision = "accept" | "ignore" | "retry";
/**
 * Decide against the event first, then against the already rendered page.
 * A newer snapshot is valid because the immutable page endpoint may have advanced
 * again between the SSE hint and this read.
 */
export declare function decideLiveTranslationSnapshot(current: LiveTranslationPageState | undefined, event: LiveTranslationCommitEvent, snapshot: LiveTranslationPageSnapshot): SnapshotDecision;
export declare function applyLiveTranslationSnapshot(state: LiveTranslationState, event: LiveTranslationCommitEvent, snapshot: LiveTranslationPageSnapshot): LiveTranslationState;
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
export declare function resolveLiveTranslationToggles(input: {
    hasOverlayContent: boolean;
    connection: LiveTranslationState["connection"];
    showSource: boolean;
    /** 用户开着叠层没有。不看它，overlayRenderable 就是在说「有内容」而不是
     * 「在画」。 */
    liveTranslationVisible: boolean;
    /** 辅助面板开着时叠层被抑制（resolveReaderPaneComposition 的 overlayOnSource
     * 里那条 `&& !assistantOpen`）。 */
    assistantOpen: boolean;
}): LiveTranslationToggles;
/** 最近一次有译文落进来的那一页（1 起），一页都没有时为 null。顶栏「跳到最新」跳这里。
 * 按事件序号取，不按页码取：并发翻译时页不是按顺序出来的。 */
export declare function latestLiveTranslationPage(state: LiveTranslationState): number | null;
/** 这一页叠层开着、别的页已经有译文、唯独这页还没有 —— 页面上提示一句「还没翻到」，
 * 不然用户看到一页原文，分不清是没翻到还是叠层坏了。一页都没有时由整栏的等待提示说，
 * 任务停了（终态）也不说「会自动出现」。 */
export declare function liveTranslationPageMissing(state: LiveTranslationState | undefined, pageIdx: number): boolean;
/** 打开阅读页时要不要直接把实时译文叠上去。
 *
 * 从进度页点「实时译文」进来，要看的就是译文；以前默认关着，进来只看到原文，
 * 得自己找左上角的小按钮。只在还没有最终译文 PDF（sourceViewOnly）时自动打开：
 * 那时只有一栏原文，不会出现以前「左右都是中文」的问题。 */
export declare function shouldAutoOpenLiveTranslation(input: {
    liveTranslationAvailable: boolean;
    sourceViewOnly: boolean;
    jobTerminal: boolean;
}): boolean;
/** 这次在阅读页里看着它翻完了：顶栏给一个「翻译完成 · 看对照」。
 * 打开时就已经完成的书不给（没跟实时译文，pagesByPage 是空的）。 */
export declare function shouldOfferLiveTranslationCompletion(input: {
    state: LiveTranslationState;
    sourceViewOnly: boolean;
    visibleMode: "source" | "compare" | "translated";
}): boolean;
//# sourceMappingURL=live-translation-state.d.ts.map