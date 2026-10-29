// 一次选了多个 PDF 时代替单本的上传区：每本一行，显示上传进度和结果，
// 传完以后用同一套选项（上面的「翻译 / 仅 OCR」、选项里的术语表和翻译质量）一起交。
// 展示组件：只收 props 发回调。按钮都是 type="button"——外层是单本提交用的 #job-form。

import type { ReactNode } from "react";
import { Languages, Loader2, ScanSearch, SlidersHorizontal } from "lucide-react";
import { summarizeBatch, type BatchItem, type BatchState } from "../../../domain/upload/batch-session.js";

type BatchUploadPanelProps = {
  batch: BatchState;
  ocrOnly: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onSubmit: () => void;
  onStoreOnly: () => void;
  onReset: () => void;
  optionsSlot: ReactNode;
};

function statusText(item: BatchItem): string {
  switch (item.status) {
    case "waiting":
      return item.message || "等待上传";
    case "uploading":
      return `上传中 ${item.progress}%`;
    case "uploaded":
      return item.pageCount > 0 ? `已上传 · ${item.pageCount} 页` : "已上传";
    case "upload_failed":
      return `上传失败：${item.message}`;
    case "submitting":
      return "正在提交…";
    case "submitted":
      return "已提交";
    case "submit_failed":
      return `没交上：${item.message}`;
    default:
      return "";
  }
}

function isProblem(item: BatchItem) {
  return item.status === "upload_failed" || item.status === "submit_failed";
}

export function BatchUploadPanel({
  batch,
  ocrOnly,
  optionsOpen,
  onToggleOptions,
  onSubmit,
  onStoreOnly,
  onReset,
  optionsSlot,
}: BatchUploadPanelProps) {
  const summary = summarizeBatch(batch);
  const busy = batch.submitting;
  const canSubmit = !summary.uploading && !busy && summary.readyToSubmit > 0;
  const retrying = summary.submitFailed > 0;
  const submitLabel = retrying
    ? `重新提交没交上的 ${summary.readyToSubmit} 本`
    : `${ocrOnly ? "开始 OCR" : "开始翻译"}（${summary.readyToSubmit} 本）`;
  const uploadedCount = batch.items.filter((item) => item.uploadId).length;

  let headline = `共 ${summary.total} 本`;
  if (summary.uploading) headline += `，正在上传（${uploadedCount}/${summary.total}）`;
  else if (summary.submitted) headline += `，已提交 ${summary.submitted} 本`;
  if (summary.uploadFailed) headline += `，${summary.uploadFailed} 本没传上`;

  return (
    <div className="batch-upload" data-batch-upload>
      <div className="batch-upload-head">
        <strong>{headline}</strong>
        <button type="button" className="batch-upload-link" onClick={onReset} disabled={busy} data-batch-action="reset">
          重新选择
        </button>
      </div>

      <ul className="batch-upload-list" aria-label="要处理的 PDF">
        {batch.items.map((item) => (
          <li
            key={item.key}
            className={`batch-upload-row${isProblem(item) ? " is-problem" : ""}${item.status === "submitted" ? " is-done" : ""}`}
            data-batch-status={item.status}
          >
            <span className="batch-upload-name" title={item.name}>{item.name}</span>
            <span className="batch-upload-status">{statusText(item)}</span>
            {item.status === "uploading" ? (
              <span className="batch-upload-progress" aria-hidden="true" style={{ width: `${item.progress}%` }} />
            ) : null}
          </li>
        ))}
      </ul>

      <p className="batch-upload-hint">
        每本都整本处理，用同一套选项。传上的书已经在书库里了，点「仅收藏」就先不处理。
      </p>

      <div className="upload-action-group">
        <button
          type="button"
          className={`batch-upload-options secondary${ocrOnly ? " hidden" : ""}`}
          aria-expanded={optionsOpen}
          title="设置术语表、翻译质量和排版引擎"
          onClick={onToggleOptions}
          data-batch-action="options"
        >
          <SlidersHorizontal aria-hidden="true" />
          选项
        </button>
        <button
          type="button"
          className="batch-upload-store secondary"
          disabled={summary.uploading || busy || uploadedCount === 0}
          title="只加入书架，稍后再处理"
          onClick={onStoreOnly}
          data-batch-action="store-only"
        >
          仅收藏
        </button>
        <button
          type="button"
          className="batch-upload-submit"
          disabled={!canSubmit}
          onClick={onSubmit}
          data-batch-action="submit"
          {...(busy ? { "data-busy": "1" } : {})}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : ocrOnly ? <ScanSearch aria-hidden="true" /> : <Languages aria-hidden="true" />}
          {busy ? "提交中…" : submitLabel}
        </button>
      </div>

      {optionsSlot}
    </div>
  );
}
