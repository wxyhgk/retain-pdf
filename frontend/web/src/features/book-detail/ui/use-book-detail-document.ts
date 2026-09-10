// 详情门面：组合 useDocumentMeta + useDocumentCollections，保持 BookDetailDialog 调用不变。
// 原 231 行单 hook 已拆分，门面仅做转发与合并以兼容旧 API。

import { useDocumentMeta } from "./useDocumentMeta.js";
import { useDocumentCollections } from "./useDocumentCollections.js";

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
}: any) {
  const meta = useDocumentMeta({ open, documentId, item, actions, onClose });
  const col = useDocumentCollections({
    open,
    documentId,
    collectionsCtl,
    collectionsReload,
    setError: meta.setError,
  });

  return {
    // meta 域
    doc: meta.doc,
    setDoc: meta.setDoc,
    authors: meta.authors,
    pageCount: meta.pageCount,
    readingStatus: meta.readingStatus,
    busy: meta.busy,
    setBusy: meta.setBusy,
    error: meta.error,
    setError: meta.setError,
    withBusy: meta.withBusy,
    confirmingDelete: meta.confirmingDelete,
    editing: meta.editing,
    setEditing: meta.setEditing,
    titleText: meta.titleText,
    tagsText: meta.tagsText,
    tags: meta.tags,
    setTitleText: meta.setTitleText,
    setTagsText: meta.setTagsText,
    refreshDocument: meta.refresh,
    startEdit: meta.startEdit,
    handleSaveEdit: meta.handleSaveEdit,
    handleReadingStatus: meta.handleReadingStatus,
    handleDelete: meta.handleDelete,
    // collections 域
    collections: col.collections,
    collectionsBusy: col.collectionsBusy,
    memberCollections: col.memberCollections,
    toggleCollection: col.toggleCollection,
  };
}

// 兼容命名 re-export（若有直接 import 子 hook 的场景）
export { useDocumentMeta } from "./useDocumentMeta.js";
export { useDocumentCollections } from "./useDocumentCollections.js";
