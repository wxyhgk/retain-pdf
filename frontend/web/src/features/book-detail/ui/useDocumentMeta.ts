// 详情 meta 子域：doc 全量、authors/pageCount、阅读状态、标题/标签编辑、删除。
// 由 useBookDetailDocument 门面组合，保持 BookDetailDialog 调用不变。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDocument } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

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
}: any) {
  const [doc, setDoc] = useState<any>(null);
  const [readingStatus, setReadingStatus] = useState("unread");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleText, setTitleText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const requestGenerationRef = useRef(0);
  const scopeRef = useRef({ open, documentId });
  scopeRef.current = { open, documentId };

  const refresh = useCallback(async () => {
    const scope = scopeRef.current;
    if (!scope.open || !scope.documentId) return null;

    const generation = ++requestGenerationRef.current;
    try {
      const full: any = await fetchDocument(API_PREFIX, scope.documentId);
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
        tags?: string[];
      };
      setDoc(full);
      setReadingStatus(detail.reading_status || "unread");
      setTitleText(detail.title || detail.source_filename || "");
      const fullTags = Array.isArray(detail.tags) ? detail.tags : [];
      setTags(fullTags);
      setTagsText(fullTags.join("、"));
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
      setConfirmingDelete(false);
      setEditing(false);
      setBusy("");
      return undefined;
    }
    // item 切但 documentId 不变时同步 readingStatus/title/tags，避免残留
    const initialTags: string[] = Array.isArray(item?.tags) ? item.tags : [];
    setReadingStatus(item?.reading_status || "unread");
    setTitleText(item?.title || item?.display_name || "");
    setTags(initialTags);
    setTagsText(initialTags.join("、"));
    void refresh();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [open, documentId, item, refresh]);

  const authors = useMemo(() => parseAuthors(doc?.authors_json), [doc?.authors_json]);
  const pageCount = doc?.page_count || item?.page_count || 0;

  async function withBusy(key: string, fn: () => Promise<void>, failMessage: string) {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || failMessage);
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
    setTagsText((tags || []).join("、"));
    setEditing(true);
  }

  async function handleSaveEdit() {
    const nextTags = tagsText
      .split(/[，,、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const nextTitle = titleText.trim();
    await withBusy(
      "meta",
      async () => {
        const updated = await actions.updateDocument(documentId, {
          title: nextTitle || undefined,
          tags: nextTags,
        });
        if (updated) setDoc(updated);
        setTags(nextTags);
        setEditing(false);
      },
      "保存失败",
    );
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await withBusy(
      "delete",
      async () => {
        await actions.deleteDocument(documentId);
        onClose?.();
      },
      "删除失败",
    );
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
    confirmingDelete,
    setConfirmingDelete,
    editing,
    setEditing,
    titleText,
    setTitleText,
    tagsText,
    setTagsText,
    tags,
    setTags,
    refresh,
    startEdit,
    handleSaveEdit,
    handleReadingStatus,
    handleDelete,
  };
}
