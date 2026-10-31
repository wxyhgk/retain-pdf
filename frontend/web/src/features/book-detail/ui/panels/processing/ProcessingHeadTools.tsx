// 「进度」页状态行右边的按钮：这一刻能做的事，只有「下一步」带字，其余是图标（悬停和读屏有名字）。
//
//   在跑（翻译）：实时译文 ｜ 详情 · 取消        —— BookTranslateProgressPanel（顺带负责轮询）
//   在跑（OCR）：  取消 OCR
//   失败 / 停下：  从断点继续 ｜ 日志 · 详情      —— 主按钮按续跑计划（stoppedTranslationAction）
//   OCR 失败：     重新 OCR
//   还没开始：     翻译整本 ｜ 只做 OCR · 指定页码
//   完成：         没有按钮，重做的动作在流水线各站的 ↻ 上
//
// 契约 id 照旧：book-detail-translate-btn、book-detail-start-ocr-btn、book-detail-cancel-ocr-btn、
// book-detail-retry-failed-btn、book-detail-resume-cancelled-btn、book-detail-status-section。

import { useContext } from "react";
import { FileText, Hash, Info, Languages, LoaderCircle, ScanText, Square } from "lucide-react";
import { Button, IconButton } from "@retainpdf/ui";

import { HomeStatusDetailContext } from "@/ui/context/home-services-context.js";
import { BookTranslateProgressPanel } from "../translate/TranslateProgress.jsx";
import { PrimaryActionButton, type JobFailurePrimaryAction } from "./stopped-translation.jsx";
import type { BookDetailOcrPanelProps, BookDetailTranslationPanelProps } from "../../tabs/processing-tab-types.js";

export type ProcessingHeadToolsProps = {
  ocr: BookDetailOcrPanelProps;
  translation: BookDetailTranslationPanelProps;
  bootstrapping: boolean;
  /** 重做的动作挂在流水线各站上（完成、停下）：状态行不再摆「只做 OCR」。 */
  stationMode: boolean;
  ocrActive: boolean;
  ocrCancelable: boolean;
  ocrJobId: string;
  translationStopped: boolean;
  translationCancelled: boolean;
  /** 停下的翻译任务的主按钮；单独的 OCR 失败时是「重新 OCR」。 */
  primary: JobFailurePrimaryAction | null;
  /** primary 是 OCR 的「重新 OCR」，不是翻译任务的续跑。 */
  primaryIsOcr?: boolean;
  /** 「翻译整本」悬停时的说明（复用已有 OCR / 执行 OCR、翻译并生成阅读产物）。 */
  translateHint?: string;
};

export function ProcessingHeadTools({
  ocr,
  translation,
  bootstrapping,
  stationMode,
  ocrActive,
  ocrCancelable,
  ocrJobId,
  translationStopped,
  translationCancelled,
  primary,
  primaryIsOcr = false,
  translateHint = "",
}: ProcessingHeadToolsProps) {
  // 日志、详情打开任务详情弹窗；取不到（单独挂载、测试）就不画，不因为缺一个可选入口崩掉。
  const statusDetail = useContext(HomeStatusDetailContext);
  const openDetail = statusDetail?.controller
    ? (tab: "overview" | "failure") => statusDetail.controller.openStatusDetailDialog(tab)
    : null;

  const translationActive = Boolean(translation?.isActive);
  const busy = translation?.busy || "";
  const submitting = busy === "translate" || Boolean(translation?.stageActionPending);
  const showStatus = translationActive || `${translation?.status?.tone || ""}` === "failed" || submitting;
  // 翻译在跑时不能单独发起 OCR（会并发一个竞争任务）：在跑时整组发起按钮都不出现。
  const launch = !stationMode && !translationStopped && !translationActive && !ocrActive;
  const canTranslate = launch && !bootstrapping && Boolean(translation?.canTranslate);
  const rangeOn = Boolean(translation?.rangeOn);

  const toggleRange = () => {
    const next = !rangeOn;
    translation?.onRangeOnChange?.(next);
    // 一个「指定页码」管两件事：点翻译就翻这些页，点只做 OCR 就识别这些页。
    ocr?.onRangeOnChange?.(next);
    if (next) ocr?.onPageSpecChange?.(translation?.pageSpec ?? "");
  };

  return (
    <>
      {showStatus ? (
        <div id="book-detail-status-section" className="book-detail-status-section" aria-label="任务进度">
          <BookTranslateProgressPanel
            item={translation?.item}
            active={translation?.tabActive ?? true}
            dialogOpen={translation?.dialogOpen ?? true}
            onOpenLiveReader={translationActive ? translation?.onOpenLiveReader : undefined}
            documentJobIds={translation?.documentJobIds}
          />
        </div>
      ) : null}

      {ocrActive && ocrCancelable ? (
        <IconButton
          id="book-detail-cancel-ocr-btn"
          className="book-detail-processing-stop"
          label={ocr?.cancelling ? "取消中…" : "取消 OCR"}
          disabled={Boolean(ocr?.cancelling)}
          onClick={() => ocr?.onCancel?.(ocrJobId)}
        >
          {ocr?.cancelling ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Square aria-hidden="true" />}
        </IconButton>
      ) : null}

      {primary ? (
        <PrimaryActionButton
          id={translationCancelled && !primaryIsOcr ? "book-detail-resume-cancelled-btn" : "book-detail-retry-failed-btn"}
          kind={translationCancelled && !primaryIsOcr ? "resume" : "retry"}
          action={primary}
        />
      ) : null}
      {translationStopped && openDetail ? (
        <>
          <IconButton label="查看日志" onClick={() => openDetail("failure")}><FileText aria-hidden="true" /></IconButton>
          <IconButton label="任务详情" onClick={() => openDetail("overview")}><Info aria-hidden="true" /></IconButton>
        </>
      ) : null}

      {canTranslate ? (
        <Button
          id="book-detail-translate-btn"
          variant="primary"
          title={translateHint || undefined}
          disabled={Boolean(busy)}
          onClick={translation?.onTranslate}
        >
          <Languages aria-hidden="true" />
          {busy === "translate"
            ? "提交中…"
            : rangeOn
              ? "翻译选定页码"
              : "翻译整本"}
        </Button>
      ) : null}
      {launch ? (
        <IconButton
          id="book-detail-start-ocr-btn"
          label={bootstrapping ? "读取中…" : ocr?.pending ? "提交中…" : ocr?.job ? "重新 OCR" : "只做 OCR"}
          disabled={bootstrapping || Boolean(ocr?.pending) || Boolean(busy)}
          onClick={ocr?.onOcr}
        >
          {ocr?.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ScanText aria-hidden="true" />}
        </IconButton>
      ) : null}
      {launch && !bootstrapping ? (
        <IconButton
          id="book-detail-page-range-toggle"
          label="指定页码"
          aria-pressed={rangeOn}
          onClick={toggleRange}
        >
          <Hash aria-hidden="true" />
        </IconButton>
      ) : null}
    </>
  );
}
