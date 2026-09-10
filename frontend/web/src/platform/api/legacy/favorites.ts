import { buildApiHeaders, isMockMode } from "@/platform/config/runtime.js";
import { unwrapEnvelope } from "@retainpdf/domain/job";
import {
  createMockFavorite,
  deleteMockFavorite,
  getMockFavorites,
} from "@/platform/mock/documents.js";
import { buildApiEndpoint } from "./http.js";

// 必填:document_id、page_idx、block_id、quote_text(引文快照)。
// job_id 不传时后端锚定文档的 active_job_id——阅读器里收藏推荐不传。
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
    throw new Error(`${envelope?.message || "创建收藏失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

// 传 documentId 时按页码排序;不传 = 全部收藏,按时间倒序
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
    throw new Error(`读取收藏失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteFavorite(apiPrefix, favoriteId) {
  const normalized = `${favoriteId || ""}`.trim();
  if (!normalized) {
    throw new Error("缺少 favorite_id。");
  }
  if (isMockMode()) {
    return deleteMockFavorite(normalized);
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `favorites/${encodeURIComponent(normalized)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`删除收藏失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}
