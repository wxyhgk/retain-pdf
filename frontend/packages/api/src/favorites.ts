// favorites — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export async function createFavorite(apiPrefix: string, payload: Record<string, unknown> = {}): Promise<any> {
  const resp = await fetch(buildApiEndpoint(apiPrefix, "favorites"), {
    method: "POST",
    headers: { ...buildApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const envelope: any = await resp.json().catch(() => null);
    throw new Error(`${envelope?.message || "创建收藏失败，请稍后重试。"}(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchFavorites(apiPrefix: string, { documentId = "" }: { documentId?: string } = {}): Promise<any> {
  const params = new URLSearchParams();
  if (`${documentId || ""}`.trim()) params.set("document_id", `${documentId}`.trim());
  const query = params.toString();
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "favorites")}${query ? `?${query}` : ""}`, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取收藏失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope(await resp.json());
}

export async function deleteFavorite(apiPrefix: string, favoriteId: string): Promise<any> {
  const normalized = `${favoriteId || ""}`.trim();
  if (!normalized) throw new Error("缺少 favorite_id。");
  const resp = await fetch(buildApiEndpoint(apiPrefix, `favorites/${encodeURIComponent(normalized)}`), { method: "DELETE", headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`删除收藏失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope(await resp.json());
}
