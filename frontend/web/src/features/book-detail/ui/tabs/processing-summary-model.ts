// 「进度」页状态行用到的纯计算：标题、语气、进度、实时说明挂在哪一站。
// 只读传入的真实任务数据，不编数。从 BookDetailProcessingTab 拆出（那个文件要控制在 380 行内）。

import { documentJobPresentation, isDocumentJobActive } from "../use-document-jobs.js";
import {
  countFromProgress,
  percentFromProgress,
  unitLabelFromProgress,
} from "../../domain/progress-value.js";
import type { ProcessingHeaderTone } from "../panels/processing/ProcessingHeader.jsx";
import type {
  BookDetailOcrPanelProps,
  BookDetailTranslationPanelProps,
  ProgressSource,
} from "./processing-tab-types.js";

export function progressOf(source: ProgressSource): { current?: number; total?: number; percent: number | null; unit: string } {
  const progress = source?.stage_snapshot?.progress || source?.progress || {};
  const percent = percentFromProgress(progress);
  const count = countFromProgress(progress);
  const unit = unitLabelFromProgress(progress);
  return count ? { current: count.current, total: count.total, percent, unit } : { percent, unit };
}

/** 状态行的标题和语气。标题只说状态（「翻译中」「翻译失败」「已停止」），数字放在下面的小字和进度条里。
 *  OCR 活跃优先，其次是翻译任务（在跑、提交中、失败、取消），再次是单独的 OCR 失败，最后是翻译的状态字。 */
export function processingHeadOf(
  ocr: BookDetailOcrPanelProps,
  translation: BookDetailTranslationPanelProps,
  { ocrTone, keptOriginBlocks, translationStatus }: { ocrTone: string; keptOriginBlocks: number; translationStatus: string },
): { headline: string; tone: ProcessingHeaderTone } {
  // OCR 和翻译并行（翻译跟着 OCR 一片片翻）：两件事同时在做。
  if (ocr && isDocumentJobActive(ocr.job) && translation?.isActive) return { headline: "识别和翻译中", tone: "active" };
  if (ocr && isDocumentJobActive(ocr.job)) {
    return { headline: documentJobPresentation(ocr.job, "OCR 识别中").tone === "active" ? "OCR 识别中" : "OCR 排队中", tone: "active" };
  }
  if (translation?.isActive) return { headline: "翻译中", tone: "active" };
  if (translation?.busy === "translate") return { headline: "提交中…", tone: "active" };
  if (translationStatus === "failed") return { headline: "翻译失败", tone: "failed" };
  if (translationStatus === "canceled" || translationStatus === "cancelled") return { headline: "已停止", tone: "stopped" };
  const tone = `${translation?.status?.tone || ""}`;
  if (ocrTone === "failed" && tone !== "done") return { headline: "OCR 失败", tone: "failed" };
  if (tone === "done") return { headline: `${translation?.status?.label || "已完成"}`, tone: keptOriginBlocks > 0 ? "warn" : "done" };
  return { headline: `${translation?.status?.label || "未翻译"}`, tone: "idle" };
}

/** 在跑的任务的「第几批 / 共几批」，状态行小字用；没有真实数字就是 null。 */
export function liveCountOf(ocr: BookDetailOcrPanelProps, translation: BookDetailTranslationPanelProps): string | null {
  const source = ocr && isDocumentJobActive(ocr.job) ? ocr.job : translation?.isActive ? translation.item : null;
  if (!source) return null;
  const { current, total, unit } = progressOf(source);
  if (current === undefined || total === undefined) return null;
  return unit ? `${current} / ${total} ${unit}` : `${current} / ${total}`;
}

/** 统一进度条：只在进行中出现；OCR 活跃跟 OCR，否则跟翻译；无真实数字时不渲染。
 *  完成后不再画一条满格的进度条 —— 它占一大块却什么也没说。 */
export function unifiedPercentOf(ocr: BookDetailOcrPanelProps, translation: BookDetailTranslationPanelProps): number | null {
  if (ocr && isDocumentJobActive(ocr.job)) return progressOf(ocr.job).percent;
  if (translation?.isActive) return progressOf(translation?.item).percent;
  return null;
}

/** 翻译任务现在跑到哪一站（OCR / 翻译 / 渲染），给实时说明找位置。认不出就算翻译站。 */
export function liveStageKey(item: ProgressSource): "ocr" | "translate" | "render" {
  const stage = `${item?.stage_snapshot?.display_stage || item?.stage_snapshot?.stage || item?.stage || ""}`.toLowerCase();
  if (stage.startsWith("ocr")) return "ocr";
  if (stage.startsWith("render")) return "render";
  return "translate";
}
