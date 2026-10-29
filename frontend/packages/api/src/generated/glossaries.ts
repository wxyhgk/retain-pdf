// 生成文件，不要手改。来源：contracts/glossaries.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  GlossaryCsvParseInput,
  GlossaryCsvParseView,
  GlossaryDetailView,
  GlossaryListView,
  GlossaryUpsertInput,
  ListGlossariesQuery,
} from "@retainpdf/contracts/glossaries";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/glossaries */
export function listGlossaries(
  apiPrefix: string | undefined,
  args: { query?: ListGlossariesQuery } = {},
  options?: RequestOptions,
): Promise<GlossaryListView> {
  return request<GlossaryListView>({ apiPrefix, method: "GET", path: `glossaries`, query: args.query, options });
}

/** POST /api/v1/glossaries */
export function createGlossary(
  apiPrefix: string | undefined,
  args: { body: GlossaryUpsertInput },
  options?: RequestOptions,
): Promise<GlossaryDetailView> {
  return request<GlossaryDetailView>({ apiPrefix, method: "POST", path: `glossaries`, body: args.body, options });
}

/** GET /api/v1/glossaries/:glossary_id */
export function getGlossary(
  apiPrefix: string | undefined,
  args: { glossary_id: string },
  options?: RequestOptions,
): Promise<GlossaryDetailView> {
  return request<GlossaryDetailView>({ apiPrefix, method: "GET", path: `glossaries/${encodePathParam(args.glossary_id)}`, options });
}

/** PUT /api/v1/glossaries/:glossary_id */
export function updateGlossary(
  apiPrefix: string | undefined,
  args: { glossary_id: string; body: GlossaryUpsertInput },
  options?: RequestOptions,
): Promise<GlossaryDetailView> {
  return request<GlossaryDetailView>({ apiPrefix, method: "PUT", path: `glossaries/${encodePathParam(args.glossary_id)}`, body: args.body, options });
}

/** DELETE /api/v1/glossaries/:glossary_id */
export function deleteGlossary(
  apiPrefix: string | undefined,
  args: { glossary_id: string },
  options?: RequestOptions,
): Promise<GlossaryDetailView> {
  return request<GlossaryDetailView>({ apiPrefix, method: "DELETE", path: `glossaries/${encodePathParam(args.glossary_id)}`, options });
}

/** POST /api/v1/glossaries/parse-csv */
export function parseGlossaryCsv(
  apiPrefix: string | undefined,
  args: { body: GlossaryCsvParseInput },
  options?: RequestOptions,
): Promise<GlossaryCsvParseView> {
  return request<GlossaryCsvParseView>({ apiPrefix, method: "POST", path: `glossaries/parse-csv`, body: args.body, options });
}
