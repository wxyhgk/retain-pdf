// Chi tiết: lấy toàn bộ document, chỉnh sửa tiêu đề/thẻ, trạng thái đọc, bộ sưu tập, xóa.

import { useEffect, useMemo, useState } from "react";
import {
  fetchDocument,
  API_PREFIX,
} from "../../../composition/external.js";

function parseAuthors(authorsJson) {
  try {
    const parsed = JSON.parse(`${authorsJson || "[]"}`);
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
 * @param {object} [options.collectionsCtl]
 * @param {object} [options.collectionsReload]
 * @param {() => void} options.onClose
 */
export function useBookDetailDocument({
  open,
  documentId,
  item,
  actions,
  collectionsCtl,
  collectionsReload,
  onClose,
}) {
  const [doc, setDoc] = useState(null);
  const [readingStatus, setReadingStatus] = useState("unread");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleText, setTitleText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [tags, setTags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionsBusy, setCollectionsBusy] = useState("");

  useEffect(() => {
    if (!open || !documentId) {
      setDoc(null);
      setError("");
      setConfirmingDelete(false);
      setEditing(false);
      setBusy("");
      setCollections([]);
      return undefined;
    }
    let cancelled = false;
    const initialTags = Array.isArray(item.tags) ? item.tags : [];
    setReadingStatus(item.reading_status || "unread");
    setTitleText(item.title || item.display_name || "");
    setTags(initialTags);
    setTagsText(initialTags.join("、"));
    fetchDocument(API_PREFIX, documentId)
      .then((full) => {
        if (cancelled) return;
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
      })
      .catch(() => {});
    if (collectionsCtl) {
      collectionsCtl
        .listCollections()
        .then(async (list) => {
          const rows = Array.isArray(list?.collections)
            ? list.collections
            : Array.isArray(list)
              ? list
              : [];
          const withMembership = await Promise.all(
            rows.map(async (col) => {
              let member = false;
              try {
                member = (
                  await collectionsCtl.listCollectionDocumentIds(col.collection_id)
                ).includes(documentId);
              } catch {
                member = false;
              }
              return { collection_id: col.collection_id, name: col.name, member };
            }),
          );
          if (!cancelled) setCollections(withMembership);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  const authors = useMemo(() => parseAuthors(doc?.authors_json), [doc?.authors_json]);
  const pageCount = doc?.page_count || item.page_count || 0;
  const memberCollections = collections.filter((c) => c.member).map((c) => c.name);

  async function withBusy(key, fn, failMessage) {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err?.message || failMessage);
    } finally {
      setBusy("");
    }
  }

  async function handleReadingStatus(value) {
    if (value === readingStatus || busy) return;
    const previous = readingStatus;
    setReadingStatus(value);
    await withBusy(
      "reading",
      () => actions.updateDocument(documentId, { reading_status: value }),
      "Cập nhật trạng thái đọc thất bại",
    ).catch(() => setReadingStatus(previous));
  }

  function startEdit() {
    setTitleText(doc?.title || item.title || item.display_name || "");
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
      "Lưu thất bại",
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
      "Xóa thất bại",
    );
  }

  async function toggleCollection(collectionId, nextMember) {
    if (!collectionsCtl || collectionsBusy) return;
    setCollectionsBusy(collectionId);
    setError("");
    try {
      if (nextMember) await collectionsCtl.addDocuments(collectionId, [documentId]);
      else await collectionsCtl.removeDocument(collectionId, documentId);
      setCollections((prev) =>
        prev.map((c) =>
          c.collection_id === collectionId ? { ...c, member: nextMember } : c,
        ),
      );
      collectionsReload?.actions.bump();
    } catch (err) {
      setError(err?.message || "Cập nhật bộ sưu tập thất bại");
    } finally {
      setCollectionsBusy("");
    }
  }

  return {
    doc,
    setDoc,
    authors,
    pageCount,
    readingStatus,
    busy,
    setBusy,
    error,
    setError,
    withBusy,
    confirmingDelete,
    editing,
    titleText,
    tagsText,
    tags,
    setTitleText,
    setTagsText,
    collections,
    collectionsBusy,
    memberCollections,
    startEdit,
    handleSaveEdit,
    handleReadingStatus,
    handleDelete,
    toggleCollection,
    setEditing,
  };
}
