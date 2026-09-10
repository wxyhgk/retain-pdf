// 详情「翻译」Tab：发起 / 重新翻译表单。
// 从原 TranslateWorkspacePanel 抽出；书已在馆，无需 WorkflowPanel 上传瓦片。

import { Check, Languages } from "lucide-react";
import { btn } from "../ui.jsx";

export type BookTranslateLaunchFormProps = {
  canTranslate: boolean;
  readerAvailable?: boolean;
  isActive?: boolean;
  statusTone?: string;
  rangeOn: boolean;
  startPage: string | number;
  endPage: string | number;
  pageCount?: number;
  busy?: string;
  error?: string;
  ocrReuse?: { jobId: string } | null;
  onRangeOnChange: (value: boolean) => void;
  onStartPageChange: (value: string) => void;
  onEndPageChange: (value: string) => void;
  onTranslate: () => void;
};

export function BookTranslateLaunchForm({
  canTranslate,
  readerAvailable = false,
  isActive = false,
  statusTone = "",
  rangeOn,
  startPage,
  endPage,
  pageCount,
  busy = "",
  error = "",
  ocrReuse = null,
  onRangeOnChange,
  onStartPageChange,
  onEndPageChange,
  onTranslate,
}: BookTranslateLaunchFormProps) {
  return (
    <div className="book-translate-launch-form space-y-2.5">
      {error ? (
        <p
          id="book-detail-translate-error"
          className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {canTranslate ? (
        <div className="book-detail-processing-actions flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ocrReuse ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted px-2 py-1 text-[11px] font-medium text-foreground"
                data-ocr-reuse="true"
                title={`复用 OCR 任务 ${ocrReuse.jobId}`}
              >
                <Check className="size-3" aria-hidden="true" />
                复用已有 OCR
              </span>
            ) : null}
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-muted-foreground/40"
                checked={rangeOn}
                onChange={(e) => onRangeOnChange(e.target.checked)}
              />
              指定页码
            </label>
            {rangeOn ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={startPage}
                  aria-label="起始页"
                  onChange={(e) => onStartPageChange(e.target.value)}
                  className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  type="number"
                  min="1"
                  value={endPage}
                  aria-label="结束页"
                  onChange={(e) => onEndPageChange(e.target.value)}
                  className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                />
                <span className="text-[11px] text-muted-foreground/70">
                  / {pageCount || "?"} 页
                </span>
              </div>
            ) : null}
          </div>
          <button
            id="book-detail-translate-btn"
            type="button"
            className={btn("default")}
            disabled={Boolean(busy)}
            onClick={onTranslate}
          >
            <Languages className="mr-1 size-4" aria-hidden="true" />
            {busy === "translate"
              ? "提交中…"
              : rangeOn
                ? "翻译选定页码"
                : statusTone === "failed"
                  ? "重新翻译整本"
                  : "翻译整本"}
          </button>
        </div>
      ) : readerAvailable ? (
        <p className="book-detail-processing-hint">左侧可直接对照阅读</p>
      ) : isActive ? (
        null
      ) : null}
    </div>
  );
}
