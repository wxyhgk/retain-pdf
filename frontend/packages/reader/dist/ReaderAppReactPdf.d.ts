import type { ReaderWorkspaceMode } from "./components/react-pdf/index.js";
/** 阅读视图可见台面的判别联合。 */
export type ReaderPaneComposition = {
    /**
     * 台面形态（单一真源）：
     * - source-only：单栏原文；
     * - translated-only：仅译文（右栏语义）；
     * - final-compare：左源右最终译文的并排；
     * - live-overlay：源栏原文 + 流式实时译文叠加（对照态保留右栏最终译文）。
     */
    kind: "source-only" | "translated-only" | "final-compare" | "live-overlay";
    /** 顶栏页签 / 键盘 / HUD 使用的可见 PDF 模式 */
    visibleMode: "source" | "compare" | "translated";
    compareMode: boolean;
    showSource: boolean;
    showTranslated: boolean;
    /**
     * 单一真值：是否把流式实时译文叠加到原文 PDF 上（Grid 消费）。
     * 仅在实时译文可用（最终译文 PDF 未就绪）时为 true；最终就绪后恒为 false。
     */
    overlayOnSource: boolean;
    /** 无 job：FAB / Markdown / AI 等「需要任务」能力判定 */
    sourceOnly: boolean;
    /** 无可并排的最终译文 (sourceOnly || !translatedUrl)：页签禁用判定 */
    sourceViewOnly: boolean;
};
/**
 * 单一纯函数，从 session.mode、实时译文可用/可见、助手开合与译文产物派生
 * 可见台面。原先散落在 app 的实时对照 / visiblePdfMode /
 * resolveReaderGridPresentation 全部收口到这里，Grid/Tabs/键盘/HUD 只消费结果。
 *
 * liveTranslationVisible 只作为「用户是否想开实时译文」的用户意图（默认关）：
 * 源栏按钮切换后，实时译文直接叠加在原文 PDF 上（overlayOnSource）；
 * overlayContentAvailable 表示「有可叠加的流式译文内容」（进行中或已完成都成立）。
 * 默认不叠加，避免旧「左右都是中文」的自动叠加 bug。
 */
export declare function resolveReaderPaneComposition(input: {
    mode: "source" | "compare" | "translated";
    sourceOnly: boolean;
    translatedUrl: string;
    overlayContentAvailable: boolean;
    liveTranslationVisible: boolean;
    assistantOpen: boolean;
    assistantPdfPane?: "source" | "translated" | null;
}): ReaderPaneComposition;
/**
 * 切换工作区页签时，是否自动开关实时译文叠加。
 * - 切到对照：仅在“实时译文真正可用（最终译文 PDF 未就绪）”时自动打开。
 *   任务完成后即使残留已提交的实时页，也不得自动选中「实时译文 · 已完成」。
 * - 离开对照（原文/译文）：关闭，回到页签自身的显示。
 * 返回 null 表示保持用户当前选择不动。
 */
export declare function resolveLiveTranslationVisibleOnWorkspaceChange(next: ReaderWorkspaceMode, liveTranslationAvailable: boolean): boolean | null;
export declare function ReaderAppReactPdf(): import("react").JSX.Element;
//# sourceMappingURL=ReaderAppReactPdf.d.ts.map