import { Fragment, type ReactElement, type ReactNode } from "react";
import { Button } from "@retainpdf/ui";
import { ArrowDownToLine, CheckCircle2, Radio } from "lucide-react";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
import { useReaderContext } from "./reader-context.js";

export type ReaderWorkspaceView = "reading" | "compare" | "markdown" | "ai";
export type ReaderWorkspaceMode = "source" | "compare" | "translated";

// 只写字（2026-11-28：以前字前面各有一个图标，三个方框图标挨着，重复感最强，去掉了）。
const WORKSPACES = [
  { id: "source", label: "原文" },
  { id: "compare", label: "对照" },
  { id: "translated", label: "译文" },
] as const;

export type ReaderWorkspaceTabsProps = {
  mode: ReaderWorkspaceMode;
  documentReady: boolean;
  /**
   * 「无可并排的最终译文」(sourceOnly || !translatedUrl)。
   * 与 FAB 的 sourceOnly（无 job）语义不同：禁对照/译文页签看这个。
   */
  sourceViewOnly?: boolean;
  onModeChange: (mode: ReaderWorkspaceMode) => void;
  liveTranslation?: {
    visible: boolean;
    state: LiveTranslationState;
    onToggle: () => void;
    /** 最近译好的那一页（1 起）和跳过去的办法；已经在那一页、或没有时不显示按钮。 */
    latestPage?: number | null;
    currentPage?: number;
    onJumpToLatest?: () => void;
  } | null;
  /** 这次看着它翻完了：顶栏左边换成「翻译完成 · 看对照」。 */
  completion?: { onOpenCompare: () => void } | null;
  /** 顶栏左段（2026-11-28 起顶栏是三段：左返回、左栏、书名；中原文 / 对照 / 译文；右面板和看法、下载）。 */
  start?: ReactNode;
  /** 顶栏右段。 */
  end?: ReactNode;
  /** 「对照」后面紧跟的东西（对比版本的 ▾，ReaderBarTools place="compare"；只有一份译文时没有）。 */
  compareExtra?: ReactNode;
};

export function liveTranslationStatusCopy(state: LiveTranslationState): string {
  if (state.connection === "live") {
    // 版面里有几页就是一共几页（OCR 做完才有版面）。
    const total = state.layoutByPage.size;
    return total > 0
      ? `已译 ${state.pagesByPage.size} / ${total} 页`
      : `已译 ${state.pagesByPage.size} 页`;
  }
  if (state.connection === "reconnecting") return "实时译文 · 重连中";
  if (state.connection === "unavailable") return "实时译文 · 不可用";
  if (state.connection === "terminal") {
    if (state.jobStatus === "failed") return "实时译文 · 已暂停";
    if (state.jobStatus === "cancelled" || state.jobStatus === "canceled") return "实时译文 · 已取消";
    if (state.jobStatus === "succeeded") return "实时译文 · 已完成";
    return "实时译文 · 已结束";
  }
  return state.error || "实时译文 · 连接中";
}

export function isReaderWorkspaceDisabled(input: {
  id: ReaderWorkspaceMode;
  documentReady: boolean;
  /** 「无可并排的最终译文」；有 live 译文时对照仍可开 */
  sourceViewOnly: boolean;
  liveTranslationAvailable: boolean;
}): boolean {
  if (input.id === "translated") return input.sourceViewOnly;
  if (input.id === "compare") {
    return !input.documentReady || (input.sourceViewOnly && !input.liveTranslationAvailable);
  }
  return false;
}

export function ReaderWorkspaceTabs(props: ReaderWorkspaceTabsProps): ReactElement {
  const ctx = useReaderContext();
  const {
    mode,
    documentReady,
    onModeChange,
    liveTranslation = null,
    completion = null,
  } = props;
  const sourceViewOnly = props.sourceViewOnly ?? ctx?.sourceViewOnly ?? false;
  const liveCopy = liveTranslation ? liveTranslationStatusCopy(liveTranslation.state) : "";
  return (
    <header className="reader-workspace-bar">
      {/* 装饰位钩子：顶栏两端（装饰包 ornaments.reader-bar-left / reader-bar-right），绝对定位，不占位 */}
      <span className="theme-ornament" data-ornament="reader-bar-left" aria-hidden="true" />
      <span className="theme-ornament" data-ornament="reader-bar-right" aria-hidden="true" />
      <div className="reader-workspace-start">{props.start}</div>
      {/* 进度那一组挂在页签右边（相对这一层定位），页签照旧居中（左右两段同宽的网格）。 */}
      <div className="reader-workspace-center">
        <div className="reader-workspace-tabs" role="tablist" aria-label="阅读工作区">
          {WORKSPACES.map(({ id, label }) => {
            const active = mode === id;
            const disabled = isReaderWorkspaceDisabled({
              id,
              documentReady,
              sourceViewOnly,
              liveTranslationAvailable: Boolean(liveTranslation),
            });
            return (
              <Fragment key={id}>
              <button
                type="button"
                className={`reader-workspace-tab${active ? " is-active" : ""}`}
                role="tab"
                aria-selected={active}
                aria-label={label}
                title={disabled ? `${label} 需要文档任务` : label}
                disabled={disabled}
                onClick={() => onModeChange(id)}
              >
                <span className="reader-workspace-tab-label">{label}</span>
              </button>
              {id === "compare" ? props.compareExtra : null}
              </Fragment>
            );
          })}
        </div>
        {liveTranslation ? (
          <div className="reader-live-strip">
            <button
              type="button"
              className={`reader-live-translation-toggle is-${liveTranslation.state.connection}${liveTranslation.visible ? " is-active" : ""}`}
              aria-pressed={liveTranslation.visible}
              aria-label={liveTranslation.visible ? "隐藏实时译文" : "显示实时译文"}
              title={liveTranslation.state.error
                || `${liveCopy}，${liveTranslation.visible ? "点一下看原文" : "点一下叠上译文"}`}
              onClick={liveTranslation.onToggle}
            >
              <Radio size={14} strokeWidth={2.2} aria-hidden />
              <span className="reader-live-translation-toggle-label">{liveCopy}</span>
            </button>
            {liveTranslation.latestPage
              && liveTranslation.onJumpToLatest
              && liveTranslation.latestPage !== liveTranslation.currentPage ? (
                <Button
                  className="reader-live-translation-toggle reader-live-jump"
                  aria-label={`跳到最新译好的第 ${liveTranslation.latestPage} 页`}
                  title={`跳到最新译好的第 ${liveTranslation.latestPage} 页`}
                  onClick={liveTranslation.onJumpToLatest}
                >
                  <ArrowDownToLine size={14} strokeWidth={2.2} aria-hidden />
                  <span className="reader-live-translation-toggle-label">跳到最新</span>
                </Button>
              ) : null}
          </div>
        ) : completion ? (
          <div className="reader-live-strip">
            <Button
              className="reader-live-translation-toggle is-done"
              title="翻译完成，左右对照看最终译文"
              onClick={completion.onOpenCompare}
            >
              <CheckCircle2 size={14} strokeWidth={2.2} aria-hidden />
              <span className="reader-live-translation-toggle-label">翻译完成 · 看对照</span>
            </Button>
          </div>
        ) : null}
      </div>
      <div className="reader-workspace-end">{props.end}</div>
    </header>
  );
}
