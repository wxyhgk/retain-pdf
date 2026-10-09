// 「进度」页顶部摘要用到的纯计算：一行状态、统一进度、语气、实时说明挂在哪一站。
// 只读传入的真实任务数据，不编数。从 BookDetailProcessingTab 拆出（那个文件要控制在 380 行内）。

import { documentJobPresentation, isDocumentJobActive } from "../use-document-jobs.js";
import {
  countFromProgress,
  percentFromProgress,
  unitLabelFromProgress,
} from "../../domain/progress-value.js";
import type { ProcessingSummaryTone } from "../panels/processing/ProcessingSummary.jsx";
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

export function progressTextOf(source: ProgressSource): string | null {
  const { current, total, percent, unit } = progressOf(source);
  const parts: string[] = [];
  if (current !== undefined && total !== undefined) parts.push(unit ? `${current}/${total} ${unit}` : `${current}/${total}`);
  if (percent !== null) parts.push(`${Math.round(percent)}%`);
  return parts.length ? parts.join(" · ") : null;
}

/** 顶部一行状态：只读传入的真实任务数据，不编假数；OCR 活跃优先，否则跟翻译。 */
export function unifiedHeadline(ocr: BookDetailOcrPanelProps, translation: BookDetailTranslationPanelProps): string {
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

/** 统一进度条：只在进行中出现；OCR 活跃跟 OCR，否则跟翻译；无真实数字时不渲染。
 *  完成后不再画一条满格的进度条 —— 它占一大块却什么也没说。 */
export function unifiedPercentOf(ocr: BookDetailOcrPanelProps, translation: BookDetailTranslationPanelProps): number | null {
  if (ocr && isDocumentJobActive(ocr.job)) return progressOf(ocr.job).percent;
  if (translation?.isActive) return progressOf(translation?.item).percent;
  return null;
}

export function summaryToneOf(ocr: BookDetailOcrPanelProps, translation: BookDetailTranslationPanelProps, ocrTone: string, keptOriginBlocks: number): ProcessingSummaryTone {
  if ((ocr && isDocumentJobActive(ocr.job)) || translation?.isActive) return "active";
  const tone = `${translation?.status?.tone || ""}`;
  if (tone === "failed" || (ocrTone === "failed" && tone !== "done")) return "failed";
  if (tone === "done") return keptOriginBlocks > 0 ? "warn" : "done";
  return "idle";
}

/** 翻译任务现在跑到哪一站（OCR / 翻译 / 渲染），给实时说明找位置。认不出就算翻译站。 */
export function liveStageKey(item: ProgressSource): "ocr" | "translate" | "render" {
  const stage = `${item?.stage_snapshot?.display_stage || item?.stage_snapshot?.stage || item?.stage || ""}`.toLowerCase();
  if (stage.startsWith("ocr")) return "ocr";
  if (stage.startsWith("render")) return "render";
  return "translate";
}
