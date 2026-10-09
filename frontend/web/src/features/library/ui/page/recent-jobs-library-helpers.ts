// RecentJobsLibrary 的纯派生 helper(从组件抽出,行为不变)。

export const VIEW_TEXT = Object.freeze({
  loadMore: "更多",
  loadMoreLoading: "加载中…",
});

// 客户端排序(只排已加载的这几页;/documents 无 sort 参数,和参考项目一样在前端排)。
export function sortItems(items, sortMode) {
  const arr = [...items];
  const desc = (key) => (a, b) => `${b?.[key] || ""}`.localeCompare(`${a?.[key] || ""}`);
  switch (sortMode) {
    case "created": return arr.sort(desc("added_at"));
    case "opened": return arr.sort(desc("last_opened_at"));
    case "title":
      return arr.sort((a, b) => `${a?.title || a?.display_name || ""}`.localeCompare(`${b?.title || b?.display_name || ""}`, "zh-CN"));
    case "updated":
    default:
      return arr.sort(desc("updated_at"));
  }
}

// 批量选择/选中态统一用的 document_id key(和网格主键一致)。
export function libraryItemDocumentId(item) {
  return `${item.document_id || ""}`.trim();
}

// 标签列表(供筛选面板显示,基于已加载项)。
export function deriveLibraryTags(items) {
  const tagSet = new Set<string>();
  for (const item of items) {
    (Array.isArray(item.tags) ? item.tags : []).forEach((t: unknown) => t && tagSet.add(`${t}`));
  }
  return [...tagSet].sort((a: string, b: string) => a.localeCompare(b, "zh-CN"));
}
