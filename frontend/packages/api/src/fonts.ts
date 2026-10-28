// frontend/packages/api/src/fonts.ts — font discovery (GET /api/v1/fonts)
import { apiFetch } from "./internal/runtime.js";
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export type FontInfo = {
  family: string;
  files: string[];
  available: boolean;
};

export async function listFonts(apiPrefix: string = API_PREFIX): Promise<FontInfo[]> {
  const endpoint = buildApiEndpoint(apiPrefix, "fonts");
  const resp = await apiFetch(endpoint, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取字体列表失败，请稍后重试。(${resp.status})`);
  const data = unwrapEnvelope<any>(await resp.json());
  if (Array.isArray(data)) return data as FontInfo[];
  if (data && Array.isArray((data as any).fonts)) return (data as any).fonts as FontInfo[];
  return [];
}

