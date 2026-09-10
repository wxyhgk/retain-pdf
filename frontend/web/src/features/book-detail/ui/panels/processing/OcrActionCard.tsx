import { btn } from "../ui.jsx";
import { ProcessingJobSummary } from "./ProcessingJobSummary.jsx";
import { isDocumentJobActive } from "../../use-document-jobs.js";
import { documentJobPresentation } from "../../use-document-jobs.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import { ProcessingCapabilityHeader } from "./ProcessingCapabilityHeader.jsx";

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8M8 15h6" />
    </svg>
  );
}

export function OcrActionCard({
  job,
  rangeOn,
  startPage,
  endPage,
  pageCount,
  pending,
  error,
  onRangeOnChange,
  onStartPageChange,
  onEndPageChange,
  onOcr,
}: any & { job?: DocumentJobSummary | null }) {
  const active = isDocumentJobActive(job);
  const status = documentJobPresentation(job, "尚未执行");
  const showDetail = active || status.tone === "failed";
  return (
    <section className="book-detail-processing-card" data-processing-capability="ocr">
      <ProcessingCapabilityHeader
        icon={<ScanIcon />}
        title="OCR 识别"
        description="提取文字、表格和公式，不生成译文"
        status={{
          ...status,
          label: status.tone === "active"
            ? "处理中"
            : status.tone === "done"
              ? "已完成"
              : status.tone === "failed"
                ? "失败"
                : "未执行",
        }}
      />
      {showDetail ? (
        <ProcessingJobSummary
          job={job}
          idleText="尚未执行 OCR"
          id="book-detail-ocr-progress"
          labels={{ active: "OCR 处理中", done: "OCR 完成", failed: "OCR 失败" }}
          subject="OCR"
        />
      ) : (
        <span id="book-detail-ocr-progress" className="sr-only" data-job-status={job?.status || "idle"} aria-hidden="true" />
      )}
      {error ? <p className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{error}</p> : null}
      <div className="book-detail-processing-actions flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={rangeOn} onChange={(event) => onRangeOnChange(event.target.checked)} />
            指定页码
          </label>
          {rangeOn ? (
            <div className="flex items-center gap-2">
              <input aria-label="OCR 起始页" type="number" min="1" value={startPage} onChange={(event) => onStartPageChange(event.target.value)} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm" />
              <span className="text-xs text-muted-foreground">–</span>
              <input aria-label="OCR 结束页" type="number" min="1" value={endPage} onChange={(event) => onEndPageChange(event.target.value)} className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm" />
              <span className="text-[11px] text-muted-foreground">/ {pageCount || "?"} 页</span>
            </div>
          ) : null}
        </div>
        <button id="book-detail-start-ocr-btn" type="button" className={btn("outline")} disabled={Boolean(pending) || active} onClick={onOcr}>
          <ScanIcon />
          <span className="ml-1.5">{pending ? "提交中…" : active ? "OCR 进行中" : job ? "重新 OCR" : "开始 OCR"}</span>
        </button>
      </div>
    </section>
  );
}
