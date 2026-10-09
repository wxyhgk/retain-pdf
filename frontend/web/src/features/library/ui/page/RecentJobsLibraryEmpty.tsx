import { EmptyState } from "@/ui/icons/EmptyState.jsx";

type RecentJobsLibraryEmptyProps = {
  mode: string;
  errorMessage?: string;
  emptyMessage?: string;
  onUpload: () => void;
};

// 图书馆空态/加载态/错误态(从 RecentJobsLibrary 抽出,保持同一 DOM 契约)。
export function RecentJobsLibraryEmpty({ mode, errorMessage, emptyMessage, onUpload }: RecentJobsLibraryEmptyProps) {
  return (
    <div id="recent-jobs-empty" className={mode === "list" ? "hidden" : undefined}>
      {mode === "loading" ? (
        <div className="events-empty">正在加载最近任务…</div>
      ) : mode === "error" ? (
        <div className="events-empty">{errorMessage}</div>
      ) : (
        <EmptyState
          instrument="microscope"
          title={emptyMessage || "暂无最近任务"}
          hint="上传 PDF 后会出现在这里，处理完成即可阅读。"
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={onUpload}
          >
            上传 PDF
          </button>
        </EmptyState>
      )}
    </div>
  );
}
