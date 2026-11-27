// 实时译文叠在原文 PDF 上：开没开、可见台面、两个开关摆哪、什么时候自动开 / 关（从 ReaderAppReactPdf 拆出，2026-11-27）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReaderReactController } from "../hooks/use-reader-react-controller.js";
import {
  latestLiveTranslationPage,
  resolveLiveTranslationToggles,
  shouldAutoOpenLiveTranslation,
  shouldOfferLiveTranslationCompletion,
} from "../shared/data/live-translation-state.js";
import { resolveReaderPaneComposition, type ReaderPaneComposition } from "./pane-composition.js";

/** 叠不叠实时译文 + 由它派生的可见台面。三个 effect 的先后有讲究（复位在前、自动打开在后），整段原样搬来。 */
export function useLiveTranslationOverlay(c: ReaderReactController, assistantOpen: boolean, compareFits = true) {
  const { sessionFiles } = c;
  const [liveTranslationVisible, setLiveTranslationVisible] = useState(false);
  // 是否有「可叠加到原文 PDF 上的流式译文内容」：进行中（available）或已完成
  // （实时页仍在 state 里）都成立，供源栏开关显示与叠加判定。
  const hasOverlayContent = c.liveTranslationAvailable
    || c.liveTranslation.pagesByPage.size > 0;
  // 可见台面唯一真源：Grid / Tabs / 键盘 / HUD 都从这里取。
  const paneComposition = resolveReaderPaneComposition({
    mode: c.mode,
    sourceOnly: c.sourceOnly,
    translatedUrl: sessionFiles.translatedUrl,
    overlayContentAvailable: hasOverlayContent,
    liveTranslationVisible,
    assistantOpen,
    compareFits,
  });
  // 叠层的两个开关分别摆在哪 —— 判断在 live-translation-state.ts 里，因为
  // 「收掉顶栏 pill 之后叠层还够得着吗」这个不变式要能单测（见那里的注释）。
  const liveToggles = resolveLiveTranslationToggles({
    hasOverlayContent,
    connection: c.liveTranslation.connection,
    showSource: paneComposition.showSource,
    liveTranslationVisible,
    assistantOpen,
  });
  const sourceViewOnly = paneComposition.sourceViewOnly;
  const visiblePdfMode = paneComposition.visibleMode;
  // 换文档（或 viewStateKey 迁移）时丢掉上一本书的选区上下文。
  //
  // 这里原来还有一行 `setLiveTranslationVisible(true)`，它让上面那个
  // `useState(false)` 成了死初值 —— 挂载时就跑，而且 viewStateKey 每迁一次就
  // 再跑一次，连「任务到终态自动取消叠加」都能被它翻回来。和
  // resolveReaderPaneComposition 头上写的「默认不叠加，避免旧『左右都是中文』
  // 的自动叠加 bug」直接矛盾，删掉才是那段注释说的行为。
  // 需要自动打开的那一处走 resolveLiveTranslationVisibleOnWorkspaceChange。
  useEffect(() => {
    setLiveTranslationVisible(false);
  }, [c.viewStateKey]);

  // 任务到终态后自动取消「实时译文」选中：终态应回到最终译文 PDF / 对照，
  // 不应默认停留在实时叠加态（用户仍可手动再点开）。
  useEffect(() => {
    if (c.session.jobTerminal) setLiveTranslationVisible(false);
  }, [c.session.jobTerminal]);

  // 翻译还在跑、还没有最终译文时，打开就叠上译文（条件见 shouldAutoOpenLiveTranslation）。
  // 每本书（viewStateKey）只自动开一次：之后用户关掉就是关掉，不再被翻回来。
  // 上面那个按 viewStateKey 复位成 false 的 effect 写在前面，同一次提交里先跑，这里再打开。
  const autoLiveOpenedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoLiveOpenedKeyRef.current === c.viewStateKey) return;
    if (!shouldAutoOpenLiveTranslation({
      liveTranslationAvailable: c.liveTranslationAvailable,
      sourceViewOnly,
      jobTerminal: c.session.jobTerminal,
    })) return;
    autoLiveOpenedKeyRef.current = c.viewStateKey;
    setLiveTranslationVisible(true);
  }, [c.liveTranslationAvailable, c.session.jobTerminal, c.viewStateKey, sourceViewOnly]);
  return { liveTranslationVisible, setLiveTranslationVisible, paneComposition, liveToggles, sourceViewOnly, visiblePdfMode };
}

type Overlay = Pick<ReturnType<typeof useLiveTranslationOverlay>, "liveTranslationVisible" | "setLiveTranslationVisible" | "liveToggles" | "sourceViewOnly"> & {
  visiblePdfMode: ReaderPaneComposition["visibleMode"];
};

/** 顶栏 pill 的「跳到最新一页」、「翻译完成 · 看对照」提示、源栏的「译文」开关。 */
export function useLiveTranslationControls(c: ReaderReactController, { liveTranslationVisible, setLiveTranslationVisible, liveToggles, sourceViewOnly, visiblePdfMode }: Overlay) {
  const latestLivePage = latestLiveTranslationPage(c.liveTranslation);
  const jumpToLatestLivePage = useCallback(() => {
    if (latestLivePage) c.goToPage(latestLivePage, "source");
  }, [c.goToPage, latestLivePage]);
  // 「翻译完成 · 看对照」：点过、或者自己切到过对照，这本书就不再提示。
  const [completionDismissedKey, setCompletionDismissedKey] = useState<string | null>(null);
  useEffect(() => {
    if (visiblePdfMode === "compare" && c.session.jobTerminal) setCompletionDismissedKey(c.viewStateKey);
  }, [c.session.jobTerminal, c.viewStateKey, visiblePdfMode]);
  const offerCompletion = completionDismissedKey !== c.viewStateKey
    && shouldOfferLiveTranslationCompletion({
      state: c.liveTranslation,
      sourceViewOnly,
      visibleMode: visiblePdfMode,
    });

  // 源栏「译文」开关：把流式译文直接叠在原文 PDF 上 / 收起。进行中与完成后
  // 都可用（只要有可叠加内容）。默认关，避免自动叠加造成「左右都中文」。
  const sourcePaneAction = useMemo(() => {
    if (!liveToggles.sourcePaneToggle) return null;
    return (
      <button
        type="button"
        className={`reader-live-translation-toggle${liveTranslationVisible ? " is-active" : ""}`}
        onClick={() => setLiveTranslationVisible((visible) => !visible)}
        aria-pressed={liveTranslationVisible}
        title={liveTranslationVisible ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文"}
      >
        译文
      </button>
    );
  }, [liveToggles.sourcePaneToggle, liveTranslationVisible]);
  return { latestLivePage, jumpToLatestLivePage, offerCompletion, setCompletionDismissedKey, sourcePaneAction };
}
