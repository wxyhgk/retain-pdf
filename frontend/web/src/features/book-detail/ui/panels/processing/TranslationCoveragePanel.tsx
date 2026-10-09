// 「进度」分区：翻译覆盖条（只在没翻全时出现）+ 任务记录（默认收起）。纯展示，数据由 BookDetailDialog 取好传进来。

import type { TranslationCoverageView } from "@/platform/api/index.js";
import { coverageCells, coverageHeadline, jobRows } from "../../../domain/translation-coverage.js";

export function TranslationCoveragePanel({ coverage }: { coverage: TranslationCoverageView | null }) {
  if (!coverage || !coverage.page_count) return null;
  const cells = coverageCells(coverage);
  const translatedPercent = Math.round((coverage.translated_pages / coverage.page_count) * 100);
  return (
    <section className="book-detail-coverage" data-processing-region="coverage" aria-label="翻译覆盖">
      <div className="book-detail-processing-section-head">
        <span className="book-detail-processing-section-title">翻译覆盖</span>
        <span className="book-detail-processing-section-summary" data-coverage-headline="true">{coverageHeadline(coverage)}</span>
        {coverage.translated_pages > 0 ? (
          <span className="book-detail-coverage-percent">{translatedPercent}%</span>
        ) : null}
      </div>
      <div
        className="book-detail-coverage-strip"
        role="img"
        aria-label={`${coverageHeadline(coverage)}。每格一页，填色的页已翻译。`}
        data-dense={cells.length > 120 ? "true" : undefined}
      >
        {cells.map((cell) => (
          <span
            key={cell.page}
            className="book-detail-coverage-cell"
            data-shade={cell.shade}
            title={cell.title}
          />
        ))}
      </div>
    </section>
  );
}

export function JobHistoryPanel({ coverage }: { coverage: TranslationCoverageView | null }) {
  const rows = jobRows(coverage);
  if (!rows.length) return null;
  return (
    // 默认收起：任务记录是查账用的，平时不需要一直摊开占半页。
    <details className="book-detail-job-history" data-processing-region="history" aria-label="任务记录">
      <summary className="book-detail-processing-section-head">
        <span className="book-detail-processing-section-title">任务记录</span>
        <span className="book-detail-processing-section-summary">共 {rows.length} 次</span>
      </summary>
      <ol className="book-detail-job-history-list">
        {rows.map((row) => (
          <li key={row.jobId} className="book-detail-job-history-row" data-job-id={row.jobId} data-status-tone={row.statusTone}>
            <span className="book-detail-job-history-swatch" data-shade={row.shade} aria-hidden="true" />
            <div className="book-detail-job-history-copy">
              <div className="book-detail-job-history-line">
                <span className="book-detail-job-history-kind">{row.kind}</span>
                {row.pagesText ? <span className="book-detail-job-history-pages">{row.pagesText}</span> : null}
              </div>
              {row.meta ? (
                <div className="book-detail-job-history-meta">
                  {/* 每一项（时间、用时、模型、复用 OCR）内部不折行：模型名被拆成「deepseek-」和
                      「flash」两行很难读。放不下时整项换到下一行。 */}
                  {row.meta.split(" · ").map((part, index) => (
                    <span key={index} className="book-detail-job-history-meta-part">{part}</span>
                  ))}
                </div>
              ) : null}
              {row.suppliedText ? <div className="book-detail-job-history-supplied">{row.suppliedText}</div> : null}
              {row.warningText ? (
                <div className="book-detail-job-history-warning" data-job-warning="true">{row.warningText}</div>
              ) : null}
              {/* 失败原因直接写出来；原始错误（多半是英文和路径）收在展开里。 */}
              {row.failureText || row.errorDetail ? (
                <div className="book-detail-job-history-failure" data-job-failure="true">
                  {row.failureText ? <span>{row.failureText}</span> : null}
                  {row.errorDetail ? (
                    <details className="book-detail-job-history-error">
                      <summary>原始错误</summary>
                      <code>{row.errorDetail}</code>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="book-detail-job-history-status" data-status-tone={row.statusTone}>{row.statusLabel}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
