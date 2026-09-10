// 从 frontend/web/src/pages/reader/legacy/ai/answer-view.ts 迁移的纯函数
export const TOOL_EVENT_LABELS: Record<string, string> = {
  search_markdown: "检索 Markdown",
  read_markdown_chunk: "阅读 Markdown 片段",
  list_documents: "确认文档信息",
  read_blocks: "阅读相关段落",
  search_favorites: "查找收藏",
  search_fulltext: "检索文档内容",
};
export function describeToolEvent(event: { tool?: string; event?: string; type?: string } | string): string {
  const key = typeof event === "string" ? event : (event.tool || event.event || event.type || "");
  return TOOL_EVENT_LABELS[key] || (key ? `执行 ${key}` : "处理中");
}
