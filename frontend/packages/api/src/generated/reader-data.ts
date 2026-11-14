// 生成文件，不要手改。来源：contracts/reader-data.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  JobFilesView,
  LiveTranslationLayout,
  LiveTranslationPageSnapshot,
  MarkdownDocumentView,
  ReaderMetadataView,
  ReaderRegionsView,
} from "@retainpdf/contracts/reader-data";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/jobs/:job_id/files */
export function listJobFiles(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<JobFilesView> {
  return request<JobFilesView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/files`, options });
}

/** GET /api/v1/jobs/:job_id/reader/markdown */
export function getReaderMarkdown(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<MarkdownDocumentView> {
  return request<MarkdownDocumentView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/markdown`, options });
}

/** GET /api/v1/jobs/:job_id/reader/regions */
export function getReaderRegions(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<ReaderRegionsView> {
  return request<ReaderRegionsView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/regions`, options });
}

/** GET /api/v1/jobs/:job_id/reader/metadata */
export function getReaderMetadata(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<ReaderMetadataView> {
  return request<ReaderMetadataView>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/reader/metadata`, options });
}

/** GET /api/v1/jobs/:job_id/progress/layout */
export function getLiveLayout(
  apiPrefix: string | undefined,
  args: { job_id: string },
  options?: RequestOptions,
): Promise<LiveTranslationLayout> {
  return request<LiveTranslationLayout>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/layout`, options });
}

/** GET /api/v1/jobs/:job_id/progress/pages/:page */
export function getLivePage(
  apiPrefix: string | undefined,
  args: { job_id: string; page: string },
  options?: RequestOptions,
): Promise<LiveTranslationPageSnapshot> {
  return request<LiveTranslationPageSnapshot>({ apiPrefix, method: "GET", path: `jobs/${encodePathParam(args.job_id)}/progress/pages/${encodePathParam(args.page)}`, options });
}
