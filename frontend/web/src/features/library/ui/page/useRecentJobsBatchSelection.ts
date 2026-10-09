import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CollectionRecord, CollectionsController } from "@/features/collections/index.js";
import type {
  DeleteBlockedDocument,
  LibraryActions,
  LibraryCardItem,
} from "../../domain/types.js";
import { libraryItemDocumentId } from "./recent-jobs-library-helpers.js";

// 「先清收藏再删除」是收藏功能（2026-09-26 已整体删除，ba3dffa7）的遗留：后端已不再返回
// DELETE_BLOCKED_BY_FAVORITES，这条分支走不到，LibraryActions 上也早没有 clearFavorites。
// 待连同确认弹窗、mock 和后端那个没人用的错误类型一起删掉；在那之前只保留原调用形态。
type ActionsWithClearFavorites = LibraryActions & {
  clearFavorites: (clearFavoritesPath: string) => Promise<unknown>;
};

type RecentJobsBatchSelectionOptions = {
  visibleItems: LibraryCardItem[];
  onBatchModeChange?: (active: boolean) => void;
  collectionsController: CollectionsController;
  actions: LibraryActions;
};

// 批量选择/删除状态机(#31)。从 RecentJobsLibrary 抽出,行为与回调和
// 上报通道(onBatchModeChange)保持不变。
export function useRecentJobsBatchSelection({
  visibleItems,
  onBatchModeChange,
  collectionsController,
  actions,
}: RecentJobsBatchSelectionOptions) {
  // 批量选择(#31):选中态用 document_id 做 key(和网格主键一致);批量模式
  // 开关经 onBatchModeChange 上报给 HomeApp,由它把底部栏(AppBottomBar)用
  // CSS 隐藏(batchMode 期间让位给这条批量工具栏——两者都固定在底部居中)。
  const [batchMode, setBatchModeState] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [batchBusy, setBatchBusy] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [pendingBlockedDelete, setPendingBlockedDelete] = useState<DeleteBlockedDocument[] | null>(null);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);

  function setBatchMode(next: boolean) {
    setBatchModeState(next);
    if (!next) setSelectedIds(new Set());
    onBatchModeChange?.(next);
  }
  // useCallback:稳定引用——传给每张卡片当 onToggleSelect,不然
  // areCardPropsEqual 里的 onToggleSelect 每次 render 都判不相等,
  // RecentJobsLibrary 一重渲就拖着所有卡片一起重渲(memo 白做)。
  const toggleSelect = useCallback((documentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!batchMode) return;
    collectionsController?.listCollections().then((list) => {
      const rows = Array.isArray(list?.collections) ? list.collections : (Array.isArray(list) ? list : []);
      setCollections(rows);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode]);

  // 批量选择只作用"可选中"的项(有 document_id 的);极少见的运行时插入
  // job-only 项(无 document_id)选不了,也不计入"全选已加载"的分母。
  const selectableIds = useMemo(
    () => visibleItems.map((item) => libraryItemDocumentId(item)).filter(Boolean),
    [visibleItems],
  );
  const selectableIdSet = useMemo(() => new Set(selectableIds), [selectableIds]);
  const effectiveSelectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIds) {
      if (selectableIdSet.has(id)) next.add(id);
    }
    return next;
  }, [selectedIds, selectableIdSet]);

  // 删除、整页刷新或筛选都会改变当前可操作集合。同步清掉已不可见的选择，
  // 避免工具栏计数和后续批量命令继续携带“幽灵” document_id。
  useEffect(() => {
    setSelectedIds((previous) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of previous) {
        if (selectableIdSet.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : previous;
    });
  }, [selectableIdSet]);

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => effectiveSelectedIds.has(id));

  function handleSelectAllToggle() {
    setSelectedIds(allSelected ? new Set<string>() : new Set(selectableIds));
  }

  function handleBatchDelete() {
    const ids = [...effectiveSelectedIds];
    if (!ids.length || batchBusy) return;
    setPendingDeleteIds(ids);
  }

  function reportBatchDeleteResult(confirmed: number, failed: number) {
    if (failed === 0) toast.success(`已删除 ${confirmed} 篇`);
    else if (confirmed > 0) toast.warning(`已删除 ${confirmed} 篇，${failed} 篇失败`);
    else toast.error("删除失败，请稍后重试");
  }

  async function confirmBatchDelete() {
    const ids = pendingDeleteIds || [];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      const result = await actions.deleteDocuments(ids);
      const confirmed = result?.confirmed || 0;
      const failed = result?.failed || 0;
      const blocked = result?.blocked || [];
      if (blocked.length > 0) {
        // 已删除的报告完，剩下的被收藏挡住：弹第二步让用户决定是否清空收藏。
        if (confirmed > 0) toast.success(`已删除 ${confirmed} 篇`);
        setPendingDeleteIds(null);
        setPendingBlockedDelete(blocked);
        return;
      }
      reportBatchDeleteResult(confirmed, failed);
      setBatchMode(false);
      setPendingDeleteIds(null);
    } catch (err) {
      toast.error((err as { message?: string } | null)?.message || "删除失败，请稍后重试");
      setPendingDeleteIds(null);
    } finally {
      setBatchBusy(false);
    }
  }

  // 第二步：清空被引用文档的收藏，再重试删除这些文档。
  async function confirmClearFavoritesBatchDelete() {
    const blocked = pendingBlockedDelete || [];
    if (!blocked.length || batchBusy) return;
    setBatchBusy(true);
    try {
      const clearedPaths = new Set<string>();
      for (const entry of blocked) {
        if (!entry.clearFavoritesPath || clearedPaths.has(entry.clearFavoritesPath)) continue;
        clearedPaths.add(entry.clearFavoritesPath);
        await (actions as ActionsWithClearFavorites).clearFavorites(entry.clearFavoritesPath);
      }
      const ids = blocked.map((entry) => entry.documentId);
      const result = await actions.deleteDocuments(ids);
      const confirmed = result?.confirmed || 0;
      const failed = result?.failed || 0;
      const stillBlocked = result?.blocked || [];
      if (stillBlocked.length > 0) {
        // 清空后又被并发收藏回来：保留确认态，更新计数让用户重试。
        if (confirmed > 0 || failed > 0) {
          reportBatchDeleteResult(confirmed, failed);
        }
        setPendingBlockedDelete(stillBlocked);
        return;
      }
      reportBatchDeleteResult(confirmed, failed);
      setPendingBlockedDelete(null);
      setBatchMode(false);
    } catch (err) {
      toast.error((err as { message?: string } | null)?.message || "删除失败，请稍后重试");
      setPendingBlockedDelete(null);
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleBatchAddToCollection(collectionId: CollectionRecord["collection_id"]) {
    const ids = [...effectiveSelectedIds];
    if (!ids.length || batchBusy) return;
    setBatchBusy(true);
    try {
      await collectionsController.addDocuments(collectionId, ids);
      toast.success(`已加入合集，共 ${ids.length} 篇`);
      setBatchMode(false);
    } catch (err) {
      toast.error((err as { message?: string } | null)?.message || "加入合集失败，请稍后重试");
    } finally {
      setBatchBusy(false);
    }
  }

  const blockedFavoriteTotal = (pendingBlockedDelete || [])
    .reduce((sum, entry) => sum + (Number(entry.favoriteCount) || 0), 0);

  return {
    batchMode,
    setBatchMode,
    effectiveSelectedIds,
    selectableIds,
    allSelected,
    batchBusy,
    pendingDeleteIds,
    setPendingDeleteIds,
    pendingBlockedDelete,
    setPendingBlockedDelete,
    collections,
    toggleSelect,
    handleSelectAllToggle,
    handleBatchDelete,
    confirmBatchDelete,
    confirmClearFavoritesBatchDelete,
    handleBatchAddToCollection,
    blockedFavoriteTotal,
  };
}
