// 阅读页「改译文」的会话状态：改的是哪一块、哪些改动还没排进 PDF、重新排版到哪一步了。
//
// 改一块是 PATCH 写回译文（source=user），不排版：PDF 上先盖一层新译文（pendingEdits），连着改几处，
// 用户点一次「重新排版」（retry-stage render，原地）才整本重排。排版期间任务是运行中，不能再改；
// 回到 succeeded 时 session 会重新加载译文 PDF（job-status 的终态刷新），完成时间一变，待排版的改动就清空了。
// 待排版的改动按修订记录现算（PDF 排好以后才写回的），关掉阅读页再开也接得上。
import { useCallback, useEffect, useMemo, useState } from "react";
import { isFinishedJobStatus } from "@retainpdf/domain/job";
import { readerSessionDataPort } from "../external.js";
import {
  isMergedReadingJob,
  jobRenderedAt,
  pageOfReaderItem,
  pendingEditsFromRevisions,
} from "../shared/data/block-edit.js";
import type { ReaderTranslationEditPort } from "../contracts/session.js";

export type BlockEditTarget = { itemId: string; page: number };

export type RerenderState =
  | { phase: "idle" }
  | { phase: "submitting" }
  /** seenActive：已经看到任务进了排队/运行（提交后第一次问状态之前，旧的 succeeded 还在）。 */
  | { phase: "running"; seenActive: boolean }
  | { phase: "failed"; message: string };

export type ReaderBlockEdit = {
  /** 宿主给了改译文的能力、这本书有译文：画「改」按钮和面板。 */
  available: boolean;
  /** 现在不能改的原因（拼出来的书、正在处理）；能改是空串。 */
  blockedReason: string;
  port: ReaderTranslationEditPort | null;
  /** 译文在哪个任务上（重新排版出来的任务指回来源任务）；还没问到是空串。 */
  ownerJobId: string;
  target: BlockEditTarget | null;
  select: (itemId: string) => void;
  /** 阅读页块号 → 写回了、还没排进 PDF 的译文。 */
  pendingEdits: ReadonlyMap<string, string>;
  /** 这次打开以后又改过几次（叠到「改过 N 次」的标记上）。 */
  savedCounts: ReadonlyMap<string, number>;
  markSaved: (itemId: string, text: string) => void;
  rerender: RerenderState;
  startRerender: () => Promise<void>;
};

/** 宿主没装适配器（单测里直接渲染阅读器）时当作不能改，不抛错。 */
function translationEditPort(): ReaderTranslationEditPort | null {
  try {
    return readerSessionDataPort().translationEdit ?? null;
  } catch {
    return null;
  }
}

const RUNNING_REASON = "这本书正在处理（翻译或排版），处理完才能改。";
const MERGED_REASON = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";

export function useReaderBlockEdit({
  jobId,
  jobStatus,
  jobPayload,
  hasTranslation,
  refreshJobStatus,
}: {
  jobId: string;
  jobStatus: string;
  jobPayload: unknown;
  /** 这次打开有译文 PDF（不是原文直开）。 */
  hasTranslation: boolean;
  refreshJobStatus: () => Promise<void>;
}): ReaderBlockEdit {
  const port = translationEditPort();
  const id = `${jobId || ""}`.trim();
  const available = Boolean(port && id && hasTranslation);
  const merged = isMergedReadingJob(id);
  const finished = !jobStatus || isFinishedJobStatus(jobStatus);
  const renderedAt = jobRenderedAt(jobPayload);

  const [ownerJobId, setOwnerJobId] = useState("");
  const [target, setTarget] = useState<BlockEditTarget | null>(null);
  const [pendingFromServer, setPendingFromServer] = useState<Map<string, string>>(() => new Map());
  const [savedLocally, setSavedLocally] = useState<{ renderedAt: string; edits: Map<string, string> }>(
    () => ({ renderedAt: "", edits: new Map() }),
  );
  const [savedCounts, setSavedCounts] = useState<Map<string, number>>(() => new Map());
  const [rerender, setRerender] = useState<RerenderState>({ phase: "idle" });

  // 换书：清掉上一本的选择和计数。
  useEffect(() => {
    setTarget(null);
    setSavedCounts(new Map());
    setRerender({ phase: "idle" });
  }, [id]);

  useEffect(() => {
    setOwnerJobId("");
    if (!available || merged || !port) return undefined;
    let disposed = false;
    port.resolveOwnerJobId(id)
      .then((owner) => { if (!disposed) setOwnerJobId(`${owner || id}`.trim() || id); })
      .catch(() => { if (!disposed) setOwnerJobId(id); });
    return () => { disposed = true; };
  }, [available, merged, port, id]);

  // PDF 排好以后才写回的修订 = 还没排进 PDF。排完一次（完成时间变了）重算，自然就清空了。
  useEffect(() => {
    setPendingFromServer(new Map());
    if (!port || !ownerJobId || !renderedAt || !finished) return undefined;
    let disposed = false;
    port.fetchRevisions(ownerJobId)
      .then((payload) => { if (!disposed) setPendingFromServer(pendingEditsFromRevisions(payload, renderedAt)); })
      .catch(() => {});
    return () => { disposed = true; };
  }, [port, ownerJobId, renderedAt, finished]);

  // 排版跑完：成功就回到空闲（PDF 由 session 重新加载）；失败、取消说一声，改动还在。
  const seenActive = rerender.phase === "running" && rerender.seenActive;
  useEffect(() => {
    if (rerender.phase !== "running") return;
    if (!finished) {
      if (!seenActive) setRerender({ phase: "running", seenActive: true });
      return;
    }
    if (!seenActive) return;
    if (jobStatus === "succeeded") setRerender({ phase: "idle" });
    else setRerender({ phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
  }, [rerender.phase, seenActive, finished, jobStatus]);

  const pendingEdits = useMemo(() => {
    const merged = new Map(pendingFromServer);
    if (savedLocally.renderedAt === renderedAt) {
      for (const [itemId, text] of savedLocally.edits) merged.set(itemId, text);
    }
    return merged;
  }, [pendingFromServer, savedLocally, renderedAt]);

  const select = useCallback((itemId: string) => {
    const value = `${itemId || ""}`.trim();
    if (!value) return;
    setTarget({ itemId: value, page: pageOfReaderItem(value) });
  }, []);

  const markSaved = useCallback((itemId: string, text: string) => {
    setSavedLocally((current) => {
      const edits = new Map(current.renderedAt === renderedAt ? current.edits : []);
      edits.set(itemId, text);
      return { renderedAt, edits };
    });
    setSavedCounts((current) => new Map(current).set(itemId, (current.get(itemId) || 0) + 1));
  }, [renderedAt]);

  const startRerender = useCallback(async () => {
    if (!port || !id || rerender.phase === "submitting" || rerender.phase === "running") return;
    setRerender({ phase: "submitting" });
    try {
      await port.rerender(id);
      setRerender({ phase: "running", seenActive: false });
      // 让 session 看到任务进了排队/运行，开始每秒问状态，排完重新加载 PDF。
      await refreshJobStatus();
    } catch (cause) {
      setRerender({ phase: "failed", message: (cause as Error)?.message || "提交重新排版失败，请稍后再试。" });
    }
  }, [port, id, rerender.phase, refreshJobStatus]);

  const blockedReason = merged
    ? MERGED_REASON
    : (!finished || rerender.phase === "running" || rerender.phase === "submitting") ? RUNNING_REASON : "";

  return {
    available,
    blockedReason,
    port,
    ownerJobId,
    target,
    select,
    pendingEdits,
    savedCounts,
    markSaved,
    rerender,
    startRerender,
  };
}

/** 鼠标停在一块上按 E：改这一块（打字时、按着修饰键时不管）。 */
export function useEditBlockShortcut(
  editBlock: ((itemId: string) => void) | null,
  regionHover: { get: () => { itemId: string | null } },
): void {
  useEffect(() => {
    if (!editBlock) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "e" && event.key !== "E") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const itemId = regionHover.get().itemId;
      if (!itemId) return;
      event.preventDefault();
      editBlock(itemId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editBlock, regionHover]);
}
