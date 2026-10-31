// 详情「翻译」Tab：发起 / 重新翻译表单。
// 从原 TranslateWorkspacePanel 抽出；书已在馆，无需 WorkflowPanel 上传瓦片。

import { Button, Checkbox } from "@retainpdf/ui";
import { PageSpecInput } from "../PageSpecInput.js";
import type { ReactNode } from "react";
import { Check, Languages } from "lucide-react";

export type BookTranslateLaunchFormProps = {
  canTranslate: boolean;
  /** 以前用来显示「左侧可直接对照阅读」，那句已去掉；保留字段免得调用方改动。 */
  readerAvailable?: boolean;
  isActive?: boolean;
  statusTone?: string;
  rangeOn: boolean;
  pageSpec: string;
  pageCount?: number;
  busy?: string;
  error?: string;
  ocrReuse?: { jobId: string } | null;
  /** 与「翻译整本」同排的附加动作（例如「仅 OCR」按钮），统一成一行。 */
  extraActions?: ReactNode;
  /** 排在按钮行最前面的动作（重新翻译 / 重新渲染）。 */
  leadingActions?: ReactNode;
  /** 选项行里的附加选项（「OCR 指定页码」）。 */
  extraOptions?: ReactNode;
  onRangeOnChange: (value: boolean) => void;
  onPageSpecChange: (value: string) => void;
  onTranslate: () => void;
};

export function BookTranslateLaunchForm({
  canTranslate,
  statusTone = "",
  rangeOn,
  pageSpec,
  pageCount,
  busy = "",
  error = "",
  ocrReuse = null,
  extraActions = null,
  leadingActions = null,
  extraOptions = null,
  onRangeOnChange,
  onPageSpecChange,
  onTranslate,
}: BookTranslateLaunchFormProps) {
  return (
    <div className="book-translate-launch-form">
      {error ? (
        <p
          id="book-detail-translate-error"
          className="rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {canTranslate || extraOptions ? (
        <div className="book-detail-processing-options">
          {canTranslate && ocrReuse ? (
            <span
              className="book-detail-processing-option-chip"
              data-ocr-reuse="true"
              title={`复用 OCR 任务 ${ocrReuse.jobId}`}
            >
              <Check className="size-3" aria-hidden="true" />
              复用已有 OCR
            </span>
          ) : null}
          {canTranslate ? (
            <div className="book-detail-translate-range">
              <Checkbox
                className="book-detail-translate-range-toggle"
                label="指定页码"
                checked={rangeOn}
                onChange={(e) => onRangeOnChange(e.target.checked)}
              />
              {rangeOn ? (
                <PageSpecInput
                  id="book-detail-translate-pages"
                  label="要翻译的页码"
                  value={pageSpec}
                  pageCount={pageCount}
                  onChange={onPageSpecChange}
                />
              ) : null}
            </div>
          ) : null}
          {extraOptions}
        </div>
      ) : null}

      {canTranslate || leadingActions || extraActions ? (
        <div className="book-detail-processing-actions" data-processing-actions="true">
          {leadingActions}
          {extraActions}
          {canTranslate ? (
            <Button
              id="book-detail-translate-btn"
              variant="primary" size="sm"
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
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
