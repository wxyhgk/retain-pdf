// glossaries — 走生成的请求函数（契约 glossaries.v1），这里只管参数整理和给用户看的报错。
// 导出 CSV 是二进制出口（transport binary），生成器不管，照旧手写，返回 Response 给下载流程。
import * as generated from "./generated/glossaries.js";
import { apiFetch, buildApiHeaders } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
import { failWith, submitFailure, type RequestOptions } from "./request.js";
import type {
  GlossaryCsvParseView,
  GlossaryDetailView,
  GlossaryListView,
  GlossaryUpsertInput,
} from "@retainpdf/contracts/glossaries";

export type { GlossaryCsvParseView, GlossaryDetailView, GlossaryListView, GlossaryUpsertInput };

function requireGlossaryId(glossaryId: string, action: string): string {
  const normalized = `${glossaryId || ""}`.trim();
  if (!normalized) throw new Error(`${action}失败: 缺少 glossary_id`);
  return normalized;
}

/** 「保存术语表失败: 400 后端 message」：和以前一样带状态码和后端的原话（校验不过时用户要看到哪条不对）。 */
function failWithStatusAndServerMessage(action: string): NonNullable<RequestOptions["onError"]> {
  return (status, payload) => {
    const detail = payload ? ` ${payload.message || JSON.stringify(payload)}` : "";
    return Object.assign(new Error(`${action}失败: ${status}${detail}`), { status });
  };
}

export async function fetchGlossaries(apiPrefix: string): Promise<GlossaryListView> {
  return generated.listGlossaries(apiPrefix, {}, { onError: failWith("读取术语表失败，请稍后重试。") });
}

export async function fetchGlossary(glossaryId: string, apiPrefix?: string): Promise<GlossaryDetailView> {
  return generated.getGlossary(
    apiPrefix,
    { glossary_id: requireGlossaryId(glossaryId, "读取术语表") },
    { onError: failWith("读取术语表详情失败，请稍后重试。") },
  );
}

export async function createGlossary(apiPrefix: string, payload: unknown): Promise<GlossaryDetailView> {
  return generated.createGlossary(apiPrefix, { body: payload as GlossaryUpsertInput }, { onError: submitFailure() });
}

export async function updateGlossary(apiPrefix: string, glossaryId: string, payload: unknown): Promise<GlossaryDetailView> {
  return generated.updateGlossary(
    apiPrefix,
    { glossary_id: requireGlossaryId(glossaryId, "保存术语表"), body: payload as GlossaryUpsertInput },
    { onError: failWithStatusAndServerMessage("保存术语表") },
  );
}

export async function deleteGlossary(apiPrefix: string, glossaryId: string): Promise<GlossaryDetailView> {
  return generated.deleteGlossary(
    apiPrefix,
    { glossary_id: requireGlossaryId(glossaryId, "删除术语表") },
    { onError: failWithStatusAndServerMessage("删除术语表") },
  );
}

export async function exportGlossaryCsv(apiPrefix: string, glossaryId: string): Promise<Response> {
  const normalizedGlossaryId = requireGlossaryId(glossaryId, "导出术语表");
  const resp = await apiFetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}/export.csv`), { headers: buildApiHeaders() });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`导出术语表失败: ${resp.status} ${text || "unknown error"}`);
  }
  return resp;
}

export async function parseGlossaryCsv(apiPrefix: string, csvText: string): Promise<GlossaryCsvParseView> {
  return generated.parseGlossaryCsv(apiPrefix, { body: { csv_text: `${csvText || ""}` } }, { onError: submitFailure() });
}
