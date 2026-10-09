import { useMemo } from "react";
import {
  countLibraryStatusFilters,
  matchesLibraryFilter,
} from "./LibraryFilterMenu.jsx";
import {
  isRecentJobActive,
} from "../../domain/card/recent-job-card-presenter.js";
import {
  isLibraryOnlyItem,
} from "../../domain/documents/document-card-item.js";
import { deriveLibraryTags, sortItems } from "./recent-jobs-library-helpers.js";
import type { LibraryCardItem } from "../../domain/types.js";

type RecentJobsListDerivationOptions = {
  items: LibraryCardItem[];
  statusFilter: string;
  tagFilter: string;
  sortMode: string;
};

// 图书馆列表派生:标签/状态计数 + 过滤/排序后的可见项。
// 从 RecentJobsLibrary 抽出,逻辑与 memo 依赖保持不变。
export function useRecentJobsListDerivation({ items, statusFilter, tagFilter, sortMode }: RecentJobsListDerivationOptions) {
  // 标签列表 + 各状态计数(供筛选面板显示,基于已加载项)。
  const { tags, statusCounts } = useMemo(() => ({
    tags: deriveLibraryTags(items),
    statusCounts: countLibraryStatusFilters(items, {
      isLibraryOnly: isLibraryOnlyItem,
      isActive: isRecentJobActive,
    }),
  }), [items]);

  const visibleItems = useMemo(() => {
    const filtered = (statusFilter === "all" && !tagFilter)
      ? items
      : items.filter((item) => matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly: isLibraryOnlyItem, isActive: isRecentJobActive }));
    return sortItems(filtered, sortMode);
  }, [items, statusFilter, tagFilter, sortMode]);

  return { tags, statusCounts, visibleItems };
}
