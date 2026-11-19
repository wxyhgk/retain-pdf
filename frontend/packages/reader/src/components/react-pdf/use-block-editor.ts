// 「改译文」面板里正在改的那一块：读原文和当前译文（块号对到译文条目号）、草稿、保存、修订历史。
// 草稿按块记着：改到一半换到别的块再回来，草稿还在；存过以后丢掉。
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderTranslationEditPort } from "../../contracts/session.js";
import {
  editableTranslation,
  revisionHistory,
  revisionIssueTexts,
  translationItemIdCandidates,
  type RevisionEntry,
} from "../../shared/data/block-edit.js";

export type BlockEditorStatus = { tone: "pending" | "ok" | "error"; message: string } | null;

type Loaded = { readerItemId: string; itemId: string; source: string; current: string };

async function loadFirstMatch(port: ReaderTranslationEditPort, jobId: string, readerItemId: string) {
  let lastError: unknown = null;
  for (const candidate of translationItemIdCandidates(readerItemId)) {
    try {
      const view = await port.loadItem(jobId, candidate);
      if (view?.item) return { itemId: candidate, item: view.item };
    } catch (cause) {
      lastError = cause;
      // 只有「这个写法不存在」才换下一种；还没翻译完（not_ready）、网络错误直接报。
      const error = cause as { status?: number; reason?: string };
      if (error?.status !== 404 || error?.reason) throw cause;
    }
  }
  if (lastError) throw lastError;
  throw new Error("找不到这一段的译文。");
}

export function useBlockEditor({
  port,
  jobId,
  readerItemId,
  onSaved,
}: {
  port: ReaderTranslationEditPort | null;
  /** 持有译文的任务；空串 = 还没问到，先不读。 */
  jobId: string;
  readerItemId: string;
  onSaved: (readerItemId: string, text: string) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RevisionEntry[]>([]);
  const [draft, setDraftState] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BlockEditorStatus>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const drafts = useRef(new Map<string, string>());
  const generation = useRef<number | null>(null);

  const loadHistory = useCallback(async (owner: string, blockId: string) => {
    if (!port) return;
    try {
      setHistory(revisionHistory(await port.fetchRevisions(owner, blockId)));
    } catch {
      setHistory([]);
    }
  }, [port]);

  useEffect(() => {
    setLoaded(null);
    setHistory([]);
    setStatus(null);
    setIssues([]);
    setReason("");
    if (!port || !jobId || !readerItemId) return undefined;
    let disposed = false;
    setLoading(true);
    loadFirstMatch(port, jobId, readerItemId)
      .then(({ itemId, item }) => {
        if (disposed) return;
        const { source, translated } = editableTranslation(item);
        setLoaded({ readerItemId, itemId, source, current: translated });
        setDraftState(drafts.current.get(readerItemId) ?? translated);
      })
      .catch((cause: unknown) => {
        if (!disposed) setStatus({ tone: "error", message: (cause as Error)?.message || "读取这段译文失败。" });
      })
      .finally(() => { if (!disposed) setLoading(false); });
    void loadHistory(jobId, readerItemId);
    return () => { disposed = true; };
  }, [port, jobId, readerItemId, loadHistory]);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    if (readerItemId) drafts.current.set(readerItemId, value);
  }, [readerItemId]);

  /** 存一版：默认存草稿；「用这版」传历史里的那段文字。 */
  const save = useCallback(async (text?: string, why?: string) => {
    if (!port || !loaded || saving) return false;
    const next = text ?? draft;
    if (!next.trim()) return false;
    setSaving(true);
    setStatus(null);
    setIssues([]);
    try {
      const result = await port.revise(jobId, loaded.itemId, {
        translated_text: next,
        source: "user",
        reason: (why ?? reason).trim() || "在阅读页手动修改",
        ...(generation.current != null ? { expected_generation: generation.current } : {}),
      });
      const nextGeneration = Number(result?.generation);
      if (Number.isFinite(nextGeneration)) generation.current = nextGeneration;
      drafts.current.delete(loaded.readerItemId);
      setLoaded({ ...loaded, current: next });
      setDraftState(next);
      setReason("");
      if (result?.changed === false) {
        setStatus({ tone: "ok", message: "和原来一样，没有改动。" });
      } else {
        onSaved(loaded.readerItemId, next);
        setStatus({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" });
      }
      void loadHistory(jobId, loaded.readerItemId);
      return true;
    } catch (cause) {
      const error = cause as Error & { issues?: unknown; reason?: string };
      if (error?.reason === "generation_mismatch") generation.current = null;
      setStatus({ tone: "error", message: error?.message || "保存失败，请稍后再试。" });
      setIssues(revisionIssueTexts(error?.issues));
      return false;
    } finally {
      setSaving(false);
    }
  }, [port, loaded, saving, draft, reason, jobId, onSaved, loadHistory]);

  const resetDraft = useCallback(() => {
    if (!loaded) return;
    drafts.current.delete(loaded.readerItemId);
    setDraftState(loaded.current);
  }, [loaded]);

  return {
    loading,
    loaded: loaded?.readerItemId === readerItemId ? loaded : null,
    history,
    draft,
    setDraft,
    reason,
    setReason,
    saving,
    status,
    issues,
    save,
    resetDraft,
  };
}
