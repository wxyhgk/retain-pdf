import { searchLibrary as searchApiLibrary } from "@retainpdf/api/search";
import { isMockMode } from "@/platform/config/runtime.js";
import { getMockSearchHits } from "@/platform/mock/documents.js";

// 全文检索(中英文)。命中词在 snippet 里用 [ ] 包裹,由展示层替换为高亮标签。
// 任意长度的 q 都可查(≥3 字符走全文索引,更短由后端自动回退模糊匹配)。
export async function searchLibrary(apiPrefix, q, { limit = 20 } = {}) {
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  if (isMockMode()) {
    return getMockSearchHits(query, { limit });
  }
  return searchApiLibrary(apiPrefix, query, { limit });
}
