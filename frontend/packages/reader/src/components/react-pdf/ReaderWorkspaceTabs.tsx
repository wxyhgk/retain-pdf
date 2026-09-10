import type { ReactElement } from "react";
import { Columns2, FileText, Languages, Radio } from "lucide-react";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";

export type ReaderWorkspaceView = "reading" | "compare" | "markdown" | "ai";
export type ReaderWorkspaceMode = "source" | "compare" | "translated";

const WORKSPACES = [
  { id: "source", label: "源文件", Icon: FileText },
  { id: "compare", label: "对照", Icon: Columns2 },
  { id: "translated", label: "翻译文件", Icon: Languages },
] as const;

export type ReaderWorkspaceTabsProps = {
  mode: ReaderWorkspaceMode;
  documentReady: boolean;
  sourceOnly?: boolean;
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
  sourceOnly: boolean;
  liveTranslationAvailable: boolean;
}): boolean {
  if (input.id === "translated") return input.sourceOnly;
  if (input.id === "compare") {
    return !input.documentReady || (input.sourceOnly && !input.liveTranslationAvailable);
  }
  return false;
}

export function ReaderWorkspaceTabs({
  mode,
  documentReady,
  sourceOnly = false,
  onModeChange,
  liveTranslation = null,
}: ReaderWorkspaceTabsProps): ReactElement {
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
            sourceOnly,
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
