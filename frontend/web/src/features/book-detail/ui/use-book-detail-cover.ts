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
};

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
}: UseBookDetailCoverOptions = {}) {
  const snapshot = statusCardState?.snapshot ?? statusCardState ?? {};
  const cardStatus = `${snapshot?.status ?? statusCardState?.status ?? ""}`.trim().toLowerCase();
  const cardJobId = `${snapshot?.jobId ?? snapshot?.job_id ?? statusCardState?.jobId ?? ""}`.trim();
  const itemJobId = `${item.job_id || item.active_job_id || ""}`.trim();
  const cardMatchesItem = Boolean(cardJobId && itemJobId && cardJobId === itemJobId);

  const status = statusOf(item);
  const libraryOnly = isLibraryOnlyItem(item);
  const itemStatus = `${item.status || ""}`.trim().toLowerCase();
  const readPresentation = resolveLibraryReadPresentation(item);
  const readerAvailable =
    readPresentation.target === "job" &&
    !(cardMatchesItem && ["running", "queued", "pending"].includes(cardStatus));
  const canTranslate =
    Boolean(libraryOnly) ||
    itemStatus === "failed" ||
    (isOcrOnlyItem(item) && itemStatus === "succeeded");
  const isActive =
    typeof isActiveProp === "boolean"
      ? isActiveProp
      : isRecentJobActive(item)
        || (cardMatchesItem && ["running", "queued", "pending"].includes(cardStatus));
  // 封面转圈：书架 live 行 + statusCard 正在跑（重试后 payload 可能仍是旧 succeeded）
  const coverProcessing =
    isActive ||
    isLibraryCardProcessing(item) ||
    (cardMatchesItem && ["running", "queued", "pending"].includes(cardStatus));

  return {
    status,
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

export function useBookDetailCover({
  item = {},
  statusCardState = null,
  isActive: isActiveProp,
}: UseBookDetailCoverOptions) {
  return useMemo(
    () => deriveBookDetailCoverState({
      item,
      statusCardState,
      isActive: isActiveProp,
    }),
    [item, statusCardState, isActiveProp],
  );
}
