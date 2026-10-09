// 详情 meta 子域：doc 全量、authors/pageCount、阅读状态、标题/标签编辑、删除。
// 由 useBookDetailDocument 门面组合，保持 BookDetailDialog 调用不变。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibraryController, LibraryCardItem } from "@/features/library/index.js";
import { fetchDocument } from "@/platform/api/index.js";
import type { DocumentRecord } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

export type DocumentMetaOptions = {
  open: boolean;
  documentId: string;
  item?: LibraryCardItem | null;
  actions: Pick<LibraryController, "updateDocument" | "deleteDocument">;
  onClose?: () => void;
};

function parseAuthors(authorsJson: unknown): string[] {
  try {
    const parsed = JSON.parse(`${(authorsJson as string) || "[]"}`);
    return Array.isArray(parsed) ? parsed.map((a) => `${a}`).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * @param {object} options
 * @param {boolean} options.open
 * @param {string} options.documentId
 * @param {object} options.item live item
 * @param {object} options.actions library.actions
 * @param {() => void} options.onClose
 */
export function useDocumentMeta({
  open,
  documentId,
  item,
  actions,
  onClose,
}: DocumentMetaOptions) {
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [readingStatus, setReadingStatus] = useState("unread");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [titleText, setTitleText] = useState("");
  const requestGenerationRef = useRef(0);
  const scopeRef = useRef({ open, documentId });
  scopeRef.current = { open, documentId };
  // live item 会随轮询换引用；只在开合/换文档时才拿它做初始同步，
  // 否则轮询期间会把用户正在编辑的标题/标签重置掉。
  const itemRef = useRef(item);
  itemRef.current = item;

  const refresh = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope.open || !scope.documentId) return null;

    const generation = ++requestGenerationRef.current;
    try {
      const full = await fetchDocument(API_PREFIX, scope.documentId);
      const currentScope = scopeRef.current;
      if (
        generation !== requestGenerationRef.current
        || !currentScope.open
        || currentScope.documentId !== scope.documentId
      ) {
        return null;
      }
      const detail = full as {
        reading_status?: string;
        title?: string;
        source_filename?: string;
      };
      setDoc(full);
      setReadingStatus(detail.reading_status || "unread");
      setTitleText(detail.title || detail.source_filename || "");
      return full;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open || !documentId) {
      requestGenerationRef.current += 1;
      setDoc(null);
      setError("");
      setEditing(false);
      setBusy("");
      return undefined;
    }
    // 只在打开/换文档时做初始同步；刻意不依赖 item（轮询会换引用），
    const liveItem = itemRef.current;
    setReadingStatus(liveItem?.reading_status || "unread");
    setTitleText(liveItem?.title || liveItem?.display_name || "");
    void refresh();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [open, documentId, refresh]);

  const authors = useMemo(() => parseAuthors(doc?.authors_json), [doc?.authors_json]);
  const pageCount: number = doc?.page_count || item?.page_count || 0;

  async function withBusy(key: string, fn: () => Promise<unknown>, failMessage: string) {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as { message?: string } | null)?.message || failMessage);
      throw err;
    } finally {
      setBusy("");
    }
  }

  async function handleReadingStatus(value: string) {
    if (value === readingStatus || busy) return;
    const previous = readingStatus;
    setReadingStatus(value);
    try {
      await withBusy(
        "reading",
        () => actions.updateDocument(documentId, { reading_status: value }),
        "更新阅读状态失败",
      );
    } catch {
      setReadingStatus(previous);
    }
  }

  function startEdit() {
    setTitleText(doc?.title || item?.title || item?.display_name || "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    const nextTitle = titleText.trim();
    try {
      await withBusy(
        "meta",
        async () => {
          const updated = await actions.updateDocument(documentId, {
            title: nextTitle || undefined,
          });
          if (updated) setDoc(updated as DocumentRecord);
          setEditing(false);
        },
        "保存失败",
      );
    } catch {
      // 失败原因已由 withBusy -> setError 展示；这里吞掉避免事件回调产生未处理拒绝。
    }
  }

  async function handleDelete() {
    setBusy("delete");
    setError("");
    try {
      await actions.deleteDocument(documentId);
      onClose?.();
    } catch (err) {
      setError((err as { message?: string } | null)?.message || "删除失败");
    } finally {
      setBusy("");
    }
  }



  return {
    doc,
    setDoc,
    authors,
    pageCount,
    readingStatus,
    setReadingStatus,
    busy,
    setBusy,
    error,
    setError,
    withBusy,
    editing,
    setEditing,
    titleText,
    setTitleText,
    refresh,
    startEdit,
    handleSaveEdit,
    handleReadingStatus,
    handleDelete,
  };
}
