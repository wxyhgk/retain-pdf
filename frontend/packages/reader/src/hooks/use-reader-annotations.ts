// 新阅读器批注状态：本地列表 + CRUD，不依赖旧抽屉/favorites 链路。

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildNotesMarkdown,
  createNoteId,
  groupNotesByPage,
  sortNotes,
  type ReaderNote,
  type ReaderNotePane,
  type ReaderNotesDocKey,
} from "../annotations/types.js";
import { loadNotes, saveNotes } from "../annotations/storage.js";

export type ReaderAnnotationsApi = {
  notes: ReaderNote[];
  groups: Array<{ page: number; items: ReaderNote[] }>;
  addFromQuote: (input: {
    page: number;
    pane: ReaderNotePane;
    quote: string;
    note?: string;
  }) => ReaderNote | null;
  updateNote: (id: string, note: string) => void;
  remove: (id: string) => void;
  exportMarkdown: (title?: string) => Promise<boolean>;
  count: number;
};

export function useReaderAnnotations(
  doc: ReaderNotesDocKey,
  options: { onAfterAdd?: () => void } = {},
): ReaderAnnotationsApi {
  const docKey = useMemo(
    () => ({
      jobId: `${doc.jobId || ""}`.trim(),
      documentId: `${doc.documentId || ""}`.trim(),
    }),
    [doc.jobId, doc.documentId],
  );

  const [notes, setNotes] = useState<ReaderNote[]>(() => loadNotes(docKey));
  const onAfterAdd = options.onAfterAdd;

  // 文档切换时重载
  useEffect(() => {
    setNotes(loadNotes(docKey));
  }, [docKey.jobId, docKey.documentId]);

  useEffect(() => {
    saveNotes(docKey, notes);
  }, [docKey, notes]);

  const addFromQuote = useCallback((input: {
    page: number;
    pane: ReaderNotePane;
    quote: string;
    note?: string;
  }) => {
    const quote = `${input.quote || ""}`.trim();
    if (!quote) {
      return null;
    }
    const item: ReaderNote = {
      id: createNoteId(),
      page: Math.max(1, Math.floor(Number(input.page) || 1)),
      pane: input.pane === "translated" ? "translated" : "source",
      quote,
      note: `${input.note || ""}`.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => sortNotes([item, ...prev]));
    onAfterAdd?.();
    return item;
  }, [onAfterAdd]);

  const updateNote = useCallback((id: string, note: string) => {
    const next = `${note || ""}`.trim();
    setNotes((prev) => prev.map((item) => (
      item.id === id ? { ...item, note: next } : item
    )));
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const exportMarkdown = useCallback(async (title = "") => {
    const md = buildNotesMarkdown(title, notes);
    try {
      await navigator.clipboard?.writeText?.(md);
      return true;
    } catch (error) {
      console.error("[reader-notes] copy failed", error);
      return false;
    }
  }, [notes]);

  const groups = useMemo(() => groupNotesByPage(notes), [notes]);

  return {
    notes,
    groups,
    addFromQuote,
    updateNote,
    remove,
    exportMarkdown,
    count: notes.length,
  };
}
