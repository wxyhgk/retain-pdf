import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import {
  createMockFavorite,
  deleteMockFavorite,
  getMockFavorites,
} from "../mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// Bắt buộc: document_id, page_idx, block_id, quote_text (ảnh chụp trích dẫn).
// Khi không truyền job_id, backend sẽ neo vào active_job_id của tài liệu — trong trình đọc, thu thập đề xuất không truyền.
export async function createFavorite(apiPrefix, payload = {}) {
  if (isMockMode()) {
    return createMockFavorite(payload);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "favorites"), {
    method: "POST",
    headers: {
      ...buildApiHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "Tạo yêu thích thất bại, vui lòng thử lại sau."}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

// Khi truyền documentId, sắp xếp theo trang; không truyền = tất cả yêu thích, sắp xếp theo thời gian giảm dần
export async function fetchFavorites(apiPrefix, { documentId = "" } = {}) {
  if (isMockMode()) {
    return getMockFavorites({ documentId });
  }
  const params = new URLSearchParams();
  if (`${documentId || ""}`.trim()) {
    params.set("document_id", `${documentId}`.trim());
  }
  const query = params.toString();
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "favorites")}${query ? `?${query}` : ""}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Đọc yêu thích thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteFavorite(apiPrefix, favoriteId) {
  const normalized = `${favoriteId || ""}`.trim();
  if (!normalized) {
    throw new Error("Thiếu favorite_id.");
  }
  if (isMockMode()) {
    return deleteMockFavorite(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `favorites/${encodeURIComponent(normalized)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Xóa yêu thích thất bại, vui lòng thử lại sau. (${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
