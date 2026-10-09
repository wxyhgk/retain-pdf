import { getMockSearchHits } from "@/platform/mock/documents.js";

// 全文检索(中英文)。命中词在 snippet 里用 [ ] 包裹,由展示层替换为高亮标签。
// 任意长度的 q 都可查(≥3 字符走全文索引,更短由后端自动回退模糊匹配)。
// mock-only 适配器:index.ts 的 mockable() 只在 mock 模式调用本实现。
export async function searchLibrary(apiPrefix: string, q: string, { limit = 20 }: { limit?: number } = {}) {
  void apiPrefix;
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  return getMockSearchHits(query, { limit });
}
