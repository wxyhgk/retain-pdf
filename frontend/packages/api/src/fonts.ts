// frontend/packages/api/src/fonts.ts — font discovery + upload (GET /api/v1/fonts)
import { API_PREFIX, buildApiHeaders, buildApiUrl, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export type FontInfo = {
  family: string;
  files: string[];
  available: boolean;
};

export async function listFonts(apiPrefix: string = API_PREFIX): Promise<FontInfo[]> {
  const endpoint = buildApiEndpoint(apiPrefix, "fonts");
  const resp = await fetch(endpoint, { headers: buildApiHeaders() });
  if (!resp.ok) throw new Error(`读取字体列表失败，请稍后重试。(${resp.status})`);
  const data = unwrapEnvelope<any>(await resp.json());
  if (Array.isArray(data)) return data as FontInfo[];
  if (data && Array.isArray((data as any).fonts)) return (data as any).fonts as FontInfo[];
  return [];
}

export async function uploadFont(apiPrefix: string = API_PREFIX, file: File | Blob, fileName?: string): Promise<FontInfo> {
  const endpoint = buildApiEndpoint(apiPrefix, "fonts/upload");
  const form = new FormData();
  const name = fileName || (file as File).name || "upload.otf";
  form.append("file", file, name);
  // For multipart we must NOT set Content-Type; fetch will set boundary automatically.
  // buildApiHeaders adds Content-Type: application/json by default, so strip it.
  const headers = buildApiHeaders() as Record<string, string>;
  delete headers["Content-Type"];
  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = (parsed as any)?.message || text;
    } catch {}
    throw new Error(`上传字体失败: ${resp.status} ${message}`);
  }
  const json = await resp.json();
  return unwrapEnvelope<FontInfo>(json);
}

// Convenience overload: uploadFont(file) without prefix
export async function uploadFontFile(file: File | Blob, fileName?: string): Promise<FontInfo> {
  return uploadFont(API_PREFIX, file, fileName);
}
