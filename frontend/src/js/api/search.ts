import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockSearchHits } from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Tìm kiếm toàn văn (Tiếng Trung/Tiếng Anh). Từ khớp được bọc trong [ ] trong snippet, được thay thế bởi lớp hiển thị thành thẻ nổi bật.
// Bất kỳ độ dài q nào cũng có thể tìm kiếm (≥3 ký tự sử dụng chỉ mục toàn văn, ngắn hơn sẽ tự động quay lại khớp mờ từ backend).
export async function searchLibrary(apiPrefix, q, { limit = 20 } = {}) {
  const query = `${q || ""}`.trim();
  if (!query) {
    return { hits: [] };
  }
  if (isMockMode()) {
    return getMockSearchHits(query, { limit });
  }
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", `${limit}`);
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "search")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Tìm kiếm thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
