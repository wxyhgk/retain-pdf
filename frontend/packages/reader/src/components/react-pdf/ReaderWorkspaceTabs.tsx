import type { ReactElement } from "react";
import { Columns2, FileText, Languages, Radio } from "lucide-react";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
import { useReaderContext } from "./reader-context.js";

export type ReaderWorkspaceView = "reading" | "compare" | "markdown" | "ai";
export type ReaderWorkspaceMode = "source" | "compare" | "translated";

// 页签上写着字（窄屏只剩图标，见 chrome.css）：只有图标时看不出哪颗是哪颗。
const WORKSPACES = [
  { id: "source", label: "原文", Icon: FileText },
  { id: "compare", label: "对照", Icon: Columns2 },
  { id: "translated", label: "译文", Icon: Languages },
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
  } | null;
};

export function liveTranslationStatusCopy(state: LiveTranslationState): string {
  if (state.connection === "live") return `实时译文 · ${state.pagesByPage.size} 页`;
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
  } = props;
  const sourceViewOnly = props.sourceViewOnly ?? ctx?.sourceViewOnly ?? false;
  const liveCopy = liveTranslation ? liveTranslationStatusCopy(liveTranslation.state) : "";
  return (
    <header className="reader-workspace-bar">
      {liveTranslation ? (
        <button
          type="button"
          className={`reader-live-translation-toggle is-${liveTranslation.state.connection}${liveTranslation.visible ? " is-active" : ""}`}
          aria-pressed={liveTranslation.visible}
          aria-label={liveTranslation.visible ? "隐藏实时译文" : "显示实时译文"}
          title={liveTranslation.state.error || liveCopy}
          onClick={liveTranslation.onToggle}
        >
          <Radio size={14} strokeWidth={2.2} aria-hidden />
          <span className="reader-live-translation-toggle-label">{liveCopy}</span>
        </button>
      ) : null}
      <div className="reader-workspace-tabs" role="tablist" aria-label="阅读工作区">
        {WORKSPACES.map(({ id, label, Icon }) => {
          const active = mode === id;
          const disabled = isReaderWorkspaceDisabled({
            id,
            documentReady,
            sourceViewOnly,
            liveTranslationAvailable: Boolean(liveTranslation),
          });
          return (
            <button
              key={id}
              type="button"
              className={`reader-workspace-tab${active ? " is-active" : ""}`}
              role="tab"
              aria-selected={active}
              aria-label={label}
              title={disabled ? `${label} 需要文档任务` : label}
              disabled={disabled}
              onClick={() => onModeChange(id)}
            >
              <Icon size={15} strokeWidth={2.2} aria-hidden />
              <span className="reader-workspace-tab-label">{label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
