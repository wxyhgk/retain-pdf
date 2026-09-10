// 文档处理 Tab：一张「处理」卡，内含 OCR / 翻译两个卡内分段。
// OcrActionCard.tsx 保留（别处可能引用），此处将其内容内联为卡内分段，
// 避免 section.book-detail-processing-card 嵌套造成视觉上的两张卡。
// 所有 id、disabled 语义、onX 回调原样透传；数字只读传入的 ocr/translation。

import { BookTranslationWorkflowPanel } from "../panels/translate/WorkflowPanel.jsx";
import { ProcessingCapabilityHeader } from "../panels/processing/ProcessingCapabilityHeader.jsx";
import { ProcessingJobSummary } from "../panels/processing/ProcessingJobSummary.jsx";
import { btn } from "../panels/ui.jsx";
import { documentJobPresentation, isDocumentJobActive } from "../use-document-jobs.js";
import { Languages } from "lucide-react";

function progressOf(source: any): { current?: number; total?: number; percent: number | null } {
  const progress: any = source?.stage_snapshot?.progress || source?.progress || {};
  const current = Number(progress.current);
  const total = Number(progress.total);
  const percent = Number(progress.percent);
  if (Number.isFinite(percent)) return { percent: Math.max(0, Math.min(100, percent)) };
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return { current, total, percent: Math.max(0, Math.min(100, (current / total) * 100)) };
  }
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) return { current, total, percent: null };
  return { percent: null };
}

function progressTextOf(source: any): string | null {
  const { current, total, percent } = progressOf(source);
  const parts: string[] = [];
  if (current !== undefined && total !== undefined) parts.push(`${current}/${total}`);
  if (percent !== null) parts.push(`${Math.round(percent)}%`);
  return parts.length ? parts.join(" · ") : null;
}

/** 顶部一行状态：只读传入的真实任务数据，不编假数；OCR 活跃优先，否则跟翻译。 */
function unifiedHeadline(ocr: any, translation: any): string {
  if (ocr && isDocumentJobActive(ocr.job)) {
    const presentation = documentJobPresentation(ocr.job, "OCR 处理中");
    const progress = progressTextOf(ocr.job);
    return progress ? `OCR 处理中 · ${progress}` : `${presentation.label || "OCR 处理中"}`;
  }
  if (translation?.isActive) {
    const progress = progressTextOf(translation.item);
    return progress ? `翻译中 · ${progress}` : "翻译中";
  }
  return `${translation?.status?.label || "未翻译"}`;
}

/** 统一进度条：OCR 活跃跟 OCR，否则跟翻译；无真实数字时不渲染。 */
function unifiedPercentOf(ocr: any, translation: any): number | null {
  if (ocr && isDocumentJobActive(ocr.job)) return progressOf(ocr.job).percent;
  return progressOf(translation?.item).percent;
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8M8 15h6" />
    </svg>
  );
}

export function BookDetailProcessingTab({ ocr, translation, loading = false, error = "" }: any) {
  const ocrJob = ocr?.job ?? null;
  const ocrActive = isDocumentJobActive(ocrJob);
  const ocrStatus = documentJobPresentation(ocrJob, "尚未执行");
  const ocrShowDetail = ocrActive || ocrStatus.tone === "failed";
  const unifiedPercent = unifiedPercentOf(ocr, translation);

  return (
    <div
      className="book-detail-tab-processing"
      data-book-detail-tab="processing"
    >
      {error ? <p className="rounded-lg border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{error}</p> : null}
      {loading ? <p className="text-xs text-muted-foreground">正在读取文档任务…</p> : null}
      {/* 全卡唯一 .book-detail-processing-card：OCR / 翻译只是卡内分段（div），不再是两张卡。 */}
      <section className="book-detail-processing-card" data-processing-capability="processing" aria-label="处理">
        <p className="book-detail-processing-unified-status text-sm font-medium text-foreground" data-processing-unified-status="true">
          {unifiedHeadline(ocr, translation)}
        </p>
        {unifiedPercent !== null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${unifiedPercent}%` }} />
          </div>
        ) : null}

        {/* OCR 分段：与 OcrActionCard 同文案/id/disabled，仅页码范围收进下方统一 <details> 选项。 */}
        <div className="book-detail-processing-segment grid gap-3" data-processing-capability="ocr">
          <ProcessingCapabilityHeader
            icon={<ScanIcon />}
            title="OCR 识别"
            description="提取文字、表格和公式，不生成译文"
            status={{
              ...ocrStatus,
              label: ocrStatus.tone === "active"
                ? "处理中"
                : ocrStatus.tone === "done"
                  ? "已完成"
                  : ocrStatus.tone === "failed"
                    ? "失败"
                    : "未执行",
            }}
          />
          {ocrShowDetail ? (
            <ProcessingJobSummary
              job={ocrJob}
              idleText="尚未执行 OCR"
              id="book-detail-ocr-progress"
              labels={{ active: "OCR 处理中", done: "OCR 完成", failed: "OCR 失败" }}
              subject="OCR"
            />
          ) : (
            <span id="book-detail-ocr-progress" className="sr-only" data-job-status={ocrJob?.status || "idle"} aria-hidden="true" />
          )}
          {ocr?.error ? <p className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{ocr.error}</p> : null}
          <div className="book-detail-processing-actions flex flex-wrap items-center justify-end gap-2">
            <button id="book-detail-start-ocr-btn" type="button" className={btn("outline")} disabled={Boolean(ocr?.pending) || ocrActive} onClick={ocr?.onOcr}>
              <ScanIcon />
              <span className="ml-1.5">{ocr?.pending ? "提交中…" : ocrActive ? "OCR 进行中" : ocrJob ? "重新 OCR" : "开始 OCR"}</span>
            </button>
          </div>
        </div>

        {/* 翻译分段：阶段路标/进度/重试/主按钮由 WorkflowPanel 原样承载；OCR 页码范围透传进统一选项。 */}
        <div className="book-detail-processing-segment grid gap-3 border-t border-border/60 pt-3" data-processing-capability="translation">
          <ProcessingCapabilityHeader
            icon={<Languages aria-hidden="true" />}
            title="翻译"
            description={translation.ocrReuse
              ? "复用已有 OCR，直接翻译并生成阅读产物"
              : "执行 OCR、翻译并生成阅读产物"}
            status={translation.status}
          />
          <BookTranslationWorkflowPanel
            {...translation}
            ocrRangeOn={ocr?.rangeOn}
            ocrStartPage={ocr?.startPage}
            ocrEndPage={ocr?.endPage}
            ocrPageCount={ocr?.pageCount}
            onOcrRangeOnChange={ocr?.onRangeOnChange}
            onOcrStartPageChange={ocr?.onStartPageChange}
            onOcrEndPageChange={ocr?.onEndPageChange}
          />
        </div>
      </section>
    </div>
  );
}
