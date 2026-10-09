// 详情封面/可读性派生：下沉 BookDetailDialog:56-66 的 coverProcessing 双源计算。
// 入参 item/statusCardState（可选 isActive 透传），出 coverProcessing/readerAvailable/canTranslate + isActive/status。

import { useMemo } from "react";
import { isLibraryCardProcessing } from "@/features/library/domain.js";
import {
  isOcrOnlyItem,
  resolveLibraryReadPresentation,
} from "@/features/library/domain.js";
import {
  isLibraryOnlyItem,
  isRecentJobActive,
  recentJobStageLabel,
  recentJobStatusLabel,
} from "@/features/library/domain.js";
import { isActiveJobStatus } from "@retainpdf/domain/job";

function statusOf(item: any) {
  if (isLibraryOnlyItem(item)) return { label: "未翻译", tone: "muted" };
  if (isRecentJobActive(item)) return { label: recentJobStageLabel(item), tone: "active" };
  const status = `${item.status || ""}`.trim();
  if (status === "succeeded") {
    return isOcrOnlyItem(item)
      ? { label: "OCR 完成", tone: "done" }
      : { label: "已完成", tone: "done" };
  }
  if (status === "failed") return { label: "失败", tone: "failed" };
  return { label: recentJobStatusLabel(status), tone: "muted" };
}

export type UseBookDetailCoverOptions = {
  item?: any;
  statusCardState?: any;
  /** 可选透传：若调用方已算好 isActive 则复用，否则内部重算 */
  isActive?: boolean;
  /** 这本书有没有可读的译文（见 bookDetailHasTranslation）；缺省只看 item.has_translation。 */
  hasTranslation?: boolean;
};

/**
 * 详情页判断「能不能对照阅读」：有过任何成功的带译文任务。
 *
 * 两个来源，任一成立即可：书库列表带来的 `has_translation`，以及详情已经拉到的
 * translation-coverage（translated_pages > 0，和阅读器同一套「全部成功任务」的规则）。
 * 不看当前任务的状态 —— 重新翻译 / 重新渲染在跑或失败时，旧译文照样能读。
 */
export function bookDetailHasTranslation({
  item = {},
  coverage = null,
}: {
  item?: any;
  coverage?: { translated_pages?: number } | null;
} = {}): boolean {
  return item?.has_translation === true || Number(coverage?.translated_pages || 0) > 0;
}

/**
 * 详情左栏和处理 Tab 共用的纯派生状态。
 *
 * 成功只表示一次 job 已结束，不能直接等同于“已翻译”：OCR-only 仍可继续
 * 翻译，主阅读动作则保留 OCR job 上下文。
 */
export function deriveBookDetailCoverState({
  item = {},
  statusCardState = null,
  isActive: isActiveProp,
  hasTranslation: hasTranslationProp,
}: UseBookDetailCoverOptions = {}) {
  const snapshot = statusCardState?.snapshot ?? statusCardState ?? {};
  const cardStatus = `${snapshot?.status ?? statusCardState?.status ?? ""}`.trim().toLowerCase();
  const cardJobId = `${snapshot?.jobId ?? snapshot?.job_id ?? statusCardState?.jobId ?? ""}`.trim();
  const itemJobId = `${item.job_id || item.active_job_id || ""}`.trim();
  const cardMatchesItem = Boolean(cardJobId && itemJobId && cardJobId === itemJobId);

  const status = statusOf(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();
  const hasTranslation = Boolean(hasTranslationProp) || bookDetailHasTranslation({ item });
  // 有译文：和书卡同一条规则（resolveLibraryReadPresentation 按 has_translation 给对照阅读），
  // coverage 来源的再显式并进去。
  const readPresentation = resolveLibraryReadPresentation(
    hasTranslation ? { ...item, has_translation: true } : item,
  );
  // 当前任务在跑时藏掉阅读入口，只适用于「还没有任何译文」：有旧译文就照样能读。
  const readerAvailable =
    readPresentation.target === "job" &&
    (hasTranslation || !(cardMatchesItem && isActiveJobStatus(cardStatus)));
  const canTranslate =
    Boolean(libraryOnly) ||
    itemStatus === "failed" ||
    (isOcrOnlyItem(item) && itemStatus === "succeeded");
  const isActive =
    typeof isActiveProp === "boolean"
      ? isActiveProp
      : isRecentJobActive(item)
        || (cardMatchesItem && isActiveJobStatus(cardStatus));
  // 封面转圈：书架 live 行 + statusCard 正在跑（重试后 payload 可能仍是旧 succeeded）
  const coverProcessing =
    isActive ||
    isLibraryCardProcessing(item) ||
    (cardMatchesItem && isActiveJobStatus(cardStatus));

  return {
    status,
    hasTranslation,
    libraryOnly,
    cardStatus,
    cardJobId,
    readPresentation,
    readerAvailable,
    canTranslate,
    isActive,
    coverProcessing,
  };
}

// 终态里只有「成功」不可再翻；其余（失败/取消/超时/无任务）都应允许重新发起。
const RETRYABLE_TRANSLATION_STATUSES = new Set([
  "",
  "failed",
  "cancelled",
  "canceled",
  "timeout",
  "dead",
]);

/**
 * 翻译按钮是否可发起：不能被正在运行的任务挡（translationActive），且当前不是
 * 已成功的翻译。有 latestTranslation（如被取消/失败）本身就证明该文档可翻译，
 * 不再依赖 cover 的 libraryOnly/ocrOnly 门禁。
 */
export function canStartTranslation({
  latestTranslation,
  translationActive,
  baseCanTranslate,
}: {
  latestTranslation?: { status?: string } | null;
  translationActive?: boolean;
  baseCanTranslate?: boolean;
} = {}): boolean {
  if (translationActive) return false;
  const status = `${latestTranslation?.status || ""}`.trim().toLowerCase();
  const retryable = !latestTranslation || RETRYABLE_TRANSLATION_STATUSES.has(status);
  return Boolean(retryable && (baseCanTranslate || Boolean(latestTranslation)));
}

export function useBookDetailCover({
  item = {},
  statusCardState = null,
  isActive: isActiveProp,
  hasTranslation,
}: UseBookDetailCoverOptions = {}) {
  return useMemo(
    () => deriveBookDetailCoverState({
      item,
      statusCardState,
      isActive: isActiveProp,
      hasTranslation,
    }),
    [item, statusCardState, isActiveProp, hasTranslation],
  );
}
