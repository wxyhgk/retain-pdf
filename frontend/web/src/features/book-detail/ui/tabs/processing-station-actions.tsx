// 流水线各站 ↻ 点开后列出的事：OCR 站「重新 OCR」（带 OCR 指定页码）、翻译站「精修 / 重新翻译」、
// 版面站「重新渲染」，任务停下时文档准备站「从头翻译整本」。从 BookDetailProcessingTab 拆出（那个文件要控制在 380 行内）。
//
// 书已经翻译完（或任务停下）、此刻没有任务在跑时才给：「再来一次」的动作挂在流水线各站上，点哪站列哪站的。
// 以前动作收在卡片头的「重新处理」里，流水线收起。

import type { ReactNode } from "react";
import { Button, Checkbox } from "@retainpdf/ui";
import { ScanText } from "lucide-react";

import type { JobRetryStage } from "@/platform/api/index.js";
import { PageSpecInput } from "../panels/PageSpecInput.js";
import { TranslationStageActions } from "../panels/translate/TranslationStageActions.jsx";
import type { StationAction } from "../panels/processing/ProcessingPipelineRail.jsx";
import type { StationKey } from "../../domain/assembly-line-model.js";
import type { BookDetailOcrPanelProps, BookDetailTranslationPanelProps } from "./processing-tab-types.js";

export function stationActionsOf({
  ocr,
  translation,
  translationStopped,
}: {
  ocr: BookDetailOcrPanelProps;
  translation: BookDetailTranslationPanelProps;
  translationStopped: boolean;
}): Partial<Record<StationKey, StationAction>> {
  // OCR 指定页码挨着「重新 OCR」。
  const ocrOptions = (
    <div className="book-detail-ocr-range">
      <Checkbox
        className="book-detail-ocr-range-toggle"
        label="OCR 指定页码"
        checked={Boolean(ocr?.rangeOn)}
        onChange={(event) => ocr?.onRangeOnChange?.(event.target.checked)}
      />
      {ocr?.rangeOn ? (
        <div className="book-detail-ocr-range-inputs">
          <PageSpecInput
            id="book-detail-ocr-pages"
            label="要 OCR 的页码"
            value={ocr?.pageSpec ?? ""}
            pageCount={ocr?.pageCount}
            onChange={(value) => ocr?.onPageSpecChange?.(value)}
          />
        </div>
      ) : null}
    </div>
  );
  const ocrRow = (
    <li className="book-detail-reprocess-row" data-reprocess-stage="ocr">
      <div className="book-detail-reprocess-copy">
        <strong>重新 OCR</strong>
        <span>重新识别版面和文字。之后要重新翻译，新结果才会用上。</span>
        {ocrOptions}
      </div>
      <div className="book-detail-reprocess-controls">
        <Button
          id="book-detail-start-ocr-btn"
          variant="secondary"
          disabled={Boolean(ocr?.pending) || Boolean(translation?.busy)}
          onClick={ocr?.onOcr}
        >
          <ScanText aria-hidden="true" />
          <span>{ocr?.pending ? "提交中…" : "开始"}</span>
        </Button>
      </div>
    </li>
  );
  // 停下的任务多一行「从头再来」：OCR 都没成功时，阶段动作全不可用，只剩这条路。
  const restartRow = translationStopped ? (
    <li className="book-detail-reprocess-row" data-reprocess-stage="restart">
      <div className="book-detail-reprocess-copy">
        <strong>从头翻译整本</strong>
        <span>重新执行 OCR、翻译和排版，费用重新计算。</span>
      </div>
      <div className="book-detail-reprocess-controls">
        <Button
          id="book-detail-restart-translation-btn"
          variant="secondary"
          disabled={Boolean(translation?.busy) || Boolean(ocr?.pending)}
          onClick={translation?.onTranslate}
        >
          <span>{translation?.busy === "translate" ? "提交中…" : "开始"}</span>
        </Button>
      </div>
    </li>
  ) : null;
  const stageSheet = (stages: JobRetryStage[], extraRows: ReactNode = null) => (
    <TranslationStageActions
      variant="sheet"
      stages={stages}
      actions={translation?.stageActions}
      loading={translation?.stageActionsLoading}
      pendingStage={translation?.stageActionPending}
      error={translation?.stageActionError}
      onRetry={translation?.onRetryStage}
      extraRows={extraRows}
    />
  );
  return {
    ocr: { label: "重新 OCR", content: stageSheet([], ocrRow) },
    translate: { label: "重译 / 精修", content: stageSheet(["translation", "refine"]) },
    render: { label: "重新渲染", content: stageSheet(["render"]) },
    ...(restartRow ? { prepare: { label: "从头翻译", content: stageSheet([], restartRow) } } : {}),
  };
}
