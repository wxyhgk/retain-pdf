// OCR 和翻译并行时翻译这一站的全书进度：记住最近一条 ocr_stream 的「已能翻的页 / 全书页数」。
// 翻译任务的实时快照每轮按 continuation_review → page_policies → ocr_stream → translation_batches 换着来，
// 不在 ocr_stream 的时候快照里的数是这一轮的批次（每轮从 0 数），不能当全书进度——所以要记住上一条。
import { useRef } from "react";

import type { LibraryCardItem } from "@/features/library/domain.js";
import { streamProgressOf } from "../domain/assembly-line-model.js";

export function useStreamProgress(item: LibraryCardItem | null | undefined, jobId: string): { current: number; total: number } | null {
  const last = useRef<{ jobId: string; value: { current: number; total: number } } | null>(null);
  const now = streamProgressOf(item);
  if (now && jobId) last.current = { jobId, value: now };
  return last.current && last.current.jobId === jobId ? last.current.value : null;
}
