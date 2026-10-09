/** RetainPDF API and artifact bindings for the package-owned Reader data runtime. */
import { fetchProtected as fetchApiProtected } from "@retainpdf/api/http";
import {
  fetchJobArtifactsManifest as fetchApiJobArtifactsManifest,
  fetchJobMarkdown as fetchApiJobMarkdown,
} from "@retainpdf/api/jobs-artifacts";
import { fetchJobPayload as fetchApiJobPayload } from "@retainpdf/api/jobs";
import { fetchDocumentByJobId } from "@/platform/api/index.js";
import {
  fetchReaderMetadata as fetchApiReaderMetadata,
  fetchReaderRegions as fetchApiReaderRegions,
} from "@retainpdf/api/reader";
import {
  fetchLiveTranslationLayout,
  fetchLiveTranslationPage,
  streamLiveTranslationEvents,
} from "@retainpdf/api/live-translation";
import {
  findReadyManifestArtifact,
  resolveJobActions,
  resolveJobMarkdownContract,
  resolveManifestArtifactUrl,
  resolveResourceUrl,
} from "@retainpdf/domain/job";
import type { JobLike } from "@retainpdf/domain/job";
import * as readerData from "@retainpdf/reader/runtime/data";
import type { ReaderLiveTranslationPort, ReaderPdfPort, ReaderSessionDataPort, ReaderSessionSnapshot } from "@retainpdf/reader/contracts";
import { normalizeReaderMetadata, normalizeReaderRegions } from "@retainpdf/reader/runtime/data";
import type {
  MarkdownRangeResult,
  MarkdownSourceDescriptor,
} from "@retainpdf/reader/runtime/data";
import {
  fetchMockProtected,
  getMockJobArtifactsManifest,
  getMockJobPayload,
  getMockJobMarkdown,
} from "@/platform/mock/index.js";
import { getMockReaderRegions } from "@/platform/mock/documents.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { isMockMode } from "@/platform/config/runtime.js";
import { resolvePdfjsVendorUrl } from "@/platform/runtime/vendor-url.js";
import { defaultReaderPdfDocumentConfigPort } from "./config.js";

async function fetchJobPayload(jobId: string, apiPrefix?: string) {
  if (isMockMode()) {
    void apiPrefix;
    return getMockJobPayload(jobId);
  }
  return fetchApiJobPayload(jobId, apiPrefix ? { apiPrefix } : undefined);
}

async function fetchJobArtifactsManifest(jobId: string, apiPrefix?: string) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobArtifactsManifest();
  }
  return fetchApiJobArtifactsManifest(jobId, apiPrefix);
}

async function fetchJobMarkdown(jobId: string, apiPrefix?: string) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobMarkdown();
  }
  return fetchApiJobMarkdown(jobId, apiPrefix);
}

// Markdown 原文来源：job detail 的 artifacts.markdown 已提供 raw_url /
// images_base_url / size_bytes，无需额外的 metadata 端点。mock 也走同一分段路径
// （把 mock 正文当成本地文件切片），保证开发/测试与生产行为一致。
async function fetchJobMarkdownSource(
  jobId: string,
  apiPrefix?: string,
): Promise<MarkdownSourceDescriptor | null> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const mock = getMockJobMarkdown();
    const content = `${mock?.content || ""}`;
    if (!content) return null;
    return {
      rawUrl: `${mock?.raw_url || "mock://markdown.raw"}`,
      totalBytes: new TextEncoder().encode(content).byteLength,
      imagesBaseUrl: `${mock?.images_base_url || ""}`,
    };
  }
  const job = await fetchApiJobPayload(jobId, apiPrefix ? { apiPrefix } : undefined);
  // 后端 job detail 的完整契约由 @retainpdf/api 拥有；这里只按消费到的
  // JobLike 子集读取 markdown artifacts，故收窄而非 any。
  const contract = resolveJobMarkdownContract(job as unknown as JobLike);
  if (!contract?.rawUrl) return null;
  return {
    rawUrl: contract.rawUrl,
    totalBytes: contract.sizeBytes ?? null,
    imagesBaseUrl: contract.imagesBaseUrl || "",
  };
}

// 一次 HTTP Range 拉取；后端 ?raw=true 走 stream_file，支持 206/Content-Range/ETag。
async function fetchJobMarkdownRange(
  rawUrl: string,
  start: number,
  endInclusive: number,
  etag?: string,
  signal?: AbortSignal,
): Promise<MarkdownRangeResult> {
  if (isMockMode() && `${rawUrl || ""}`.startsWith("mock://")) {
    const bytes = new TextEncoder().encode(`${getMockJobMarkdown()?.content || ""}`);
    const slice = bytes.slice(start, Math.min(endInclusive + 1, bytes.length));
    return {
      status: 206,
      bytes: slice,
      totalBytes: bytes.length,
      rangeEnd: start + slice.length - 1,
      etag: 'W/"mock"',
    };
  }
  const headers: Record<string, string> = { Range: `bytes=${start}-${endInclusive}` };
  // If-Range 只接受强校验器；弱 ETag（W/"…"）会被服务端忽略并回整篇。
  if (etag && !etag.startsWith("W/")) headers["If-Range"] = etag;
  const resp = await fetchApiProtected(rawUrl, { headers, signal });
  const contentRange = resp.headers.get("Content-Range") || "";
  const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
  const rangeEnd = match ? Number(match[2]) : null;
  const totalBytes = match && match[3] !== "*" ? Number(match[3]) : null;
  const bytes = new Uint8Array(await resp.arrayBuffer());
  return {
    status: resp.status,
    bytes,
    totalBytes,
    rangeEnd,
    etag: resp.headers.get("ETag"),
  };
}


async function fetchReaderRegions(jobId: string, apiPrefix?: string) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockReaderRegions();
  }
  return fetchApiReaderRegions(jobId, apiPrefix);
}

async function fetchReaderMetadata(jobId: string, apiPrefix?: string) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return null;
  }
  return fetchApiReaderMetadata(jobId, apiPrefix);
}


export const pdfPort: ReaderPdfPort = {
  fetchProtected: (input, init) => fetchProtected(input, init),
  resolvePdfjsVendorUrl,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function normalizedString(value: unknown): string { return `${value ?? ""}`.trim(); }
function resolveSnapshotDocumentId(payload: unknown): string {
  const record = asRecord(payload);
  for (const value of [
    record.document_id,
    record.documentId,
    asRecord(record.document).document_id,
    asRecord(record.book_summary).document_id,
    asRecord(asRecord(record.request_payload).source).document_id,
  ]) {
    const id = normalizedString(value);
    if (id) return id;
  }
  return "";
}
function snapshotTitle(payload: unknown, jobId: string): string {
  const record = asRecord(payload);
  for (const value of [record.title, record.display_name, record.source_file_name, asRecord(record.book_summary).source_file_name]) {
    const text = normalizedString(value);
    if (text && text !== jobId && text !== `${jobId}.pdf`) return text.replace(/\.pdf$/i, "");
  }
  return "";
}
function snapshotStatus(payload: unknown): string { return normalizedString(asRecord(payload).status).toLowerCase(); }
function snapshotWorkflow(payload: unknown): string { return normalizedString(asRecord(payload).workflow || asRecord(payload).job_type).toLowerCase(); }

export const sessionDataPort: ReaderSessionDataPort = {
  loadSessionSnapshot: async (input): Promise<ReaderSessionSnapshot> => {
    // documents 查询只依赖 jobId，和 job / manifest（/ regions）并行发出。原来排在
    // loadReaderPayload 之后串行等，而 session 又会再查一遍 —— 见 linkedDocument。
    const linkedPromise = input.jobId && !input.routeDocumentId
      ? fetchDocumentByJobId(API_PREFIX, input.jobId).catch(() => null)
      : Promise.resolve(null);
    const [payload, linked] = await Promise.all([
      defaultReaderDataPort.loadReaderPayload(input.jobId, {
        includeOptionalArtifacts: input.includeOptionalArtifacts !== false,
      }),
      linkedPromise,
    ]);
    const payloadDocumentId = resolveSnapshotDocumentId(payload.jobPayload);
    const documentId = input.documentId || input.routeDocumentId || payloadDocumentId || normalizedString(linked?.document_id);
    const activeJobId = normalizedString(linked?.active_job_id);
    const activeVersionId = normalizedString(linked?.active_version_id);
    const committed = input.committedSource;
    const restoreCommitted = Boolean(
      payloadDocumentId && activeVersionId && activeJobId === input.jobId && !committed,
    );
    const sourceItem = resolveReaderSourcePdf(payload.manifestPayload);
    const sourceArtifact = typeof sourceItem === "string" ? sourceItem : resolveReaderArtifactUrl(sourceItem);
    const translated = resolveReaderTranslatedPdfUrl(payload.jobPayload, payload.manifestPayload);
    const sourceUrl = committed?.documentId
      ? resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(committed.documentId)}/source.pdf?version=${encodeURIComponent(committed.revision)}`)
      : sourceArtifact || (documentId ? resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(documentId)}/source.pdf`) : "");
    const translatedUrl = committed || restoreCommitted ? "" : translated || "";
    return {
      loadPlan: restoreCommitted
        ? { kind: "restore-committed-source", documentId: payloadDocumentId, revision: activeVersionId }
        : { kind: "open-job-artifacts" },
      jobId: input.jobId,
      documentId,
      jobStatus: snapshotStatus(payload.jobPayload),
      workflow: snapshotWorkflow(payload.jobPayload),
      title: snapshotTitle(payload.jobPayload, input.jobId),
      sourceUrl,
      translatedUrl,
      sourceOnly: !input.jobId,
      sourcePayload: payload.jobPayload,
      manifestPayload: payload.manifestPayload,
      regions: normalizeReaderRegions(payload.regionsPayload),
      readerMetadata: normalizeReaderMetadata(payload.readerMetadata),
      readerErrors: payload.readerErrors,
      // 只有真查过（job 链路、没有 route document）才带回；否则 undefined，
      // 让 session 按自己的条件决定要不要查。
      ...(input.jobId && !input.routeDocumentId ? { linkedDocument: linked ?? null } : {}),
    };
  },
  loadReaderPayload: (jobId, options) => defaultReaderDataPort.loadReaderPayload(jobId, options),
  loadReaderOptionalArtifacts: (jobId) => defaultReaderDataPort.loadReaderOptionalArtifacts(jobId),
  loadJobPayload: (jobId) => defaultReaderDataPort.loadJobPayload(jobId),
  fetchDocumentByJobId: async (apiPrefix, jobId) => fetchDocumentByJobId(apiPrefix, jobId),
  fetchProtected: (input, init) => fetchProtected(input, init),
  resolveResourceUrl,
  resolveReaderSourcePdf: (manifestPayload) => resolveReaderSourcePdf(manifestPayload),
  resolveReaderTranslatedPdfUrl: (jobPayload, manifestPayload) => resolveReaderTranslatedPdfUrl(jobPayload, manifestPayload),
  resolveReaderArtifactUrl: (item) => resolveReaderArtifactUrl(item),
};

export const liveTranslationPort: ReaderLiveTranslationPort = {
  fetchLayout: (jobId, options: { signal?: AbortSignal } = {}) =>
    fetchLiveTranslationLayout(jobId, {
      apiPrefix: API_PREFIX,
      signal: options.signal,
    }),
  fetchPage: (jobId, pageIdx, options: { signal?: AbortSignal } = {}) =>
    fetchLiveTranslationPage(jobId, pageIdx, {
      apiPrefix: API_PREFIX,
      signal: options.signal,
    }),
  streamEvents: (jobId, options) =>
    streamLiveTranslationEvents(jobId, {
      apiPrefix: API_PREFIX,
      afterSeq: options.afterSeq,
      signal: options.signal,
      onEvent: options.onEvent,
    }),
};

export async function fetchProtected(url: string, options: RequestInit = {}): Promise<Response> {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) {
    return fetchMockProtected(url);
  }
  return fetchApiProtected(url, options);
}

// 入口参数类型取自 reader 包公开签名，避免 any 掩盖适配契约。
type ReaderDataPortOptions = NonNullable<
  Parameters<typeof readerData.createReaderDataPort>[0]
>;
type ReaderSourcePdfOptions = NonNullable<
  Parameters<typeof readerData.resolveReaderSourcePdf>[1]
>;
type ReaderTranslatedPdfOptions = NonNullable<
  Parameters<typeof readerData.resolveReaderTranslatedPdfUrl>[2]
>;
type ReaderArtifactUrlOptions = NonNullable<
  Parameters<typeof readerData.resolveReaderArtifactUrl>[1]
>;
type BuildPdfDocumentOptions = NonNullable<
  Parameters<typeof readerData.buildPdfDocumentOptions>[0]
>;
type LoadPdfDocumentOptions = NonNullable<
  Parameters<typeof readerData.loadPdfDocument>[0]
>;

export const createReaderDataPort = (options: ReaderDataPortOptions = {}) =>
  readerData.createReaderDataPort({
    apiPrefix: API_PREFIX,
    loadJob: fetchJobPayload,
    loadManifest: fetchJobArtifactsManifest,
    loadMarkdown: fetchJobMarkdown,
    loadMarkdownSource: fetchJobMarkdownSource,
    fetchMarkdownRange: fetchJobMarkdownRange,
    loadRegions: fetchReaderRegions,
    loadMetadata: fetchReaderMetadata,
    fetchProtectedResource: fetchProtected,
    liveTranslation: liveTranslationPort,
    ...options,
  });
export const defaultReaderDataPort = createReaderDataPort();

export const resolveReaderArtifactUrl = (
  item: Parameters<typeof readerData.resolveReaderArtifactUrl>[0],
  options: ReaderArtifactUrlOptions = {},
) => readerData.resolveReaderArtifactUrl(item, { resolveResourceUrl, ...options });
export const buildPdfDocumentOptions = (options: BuildPdfDocumentOptions = {}) =>
  readerData.buildPdfDocumentOptions({
    configPort: defaultReaderPdfDocumentConfigPort,
    resolvePdfjsVendorUrl,
    ...options,
  });
export const loadPdfDocument = (options: LoadPdfDocumentOptions = {}) =>
  readerData.loadPdfDocument({
    configPort: defaultReaderPdfDocumentConfigPort,
    resolveResourceUrl,
    resolvePdfjsVendorUrl,
    ...options,
  });
export const __resetPdfjsForTests = readerData.__resetPdfjsForTests;

export const resolveReaderJobId = readerData.resolveReaderJobId;
export const resolveReaderSourcePdf = (
  manifestPayload: Parameters<typeof readerData.resolveReaderSourcePdf>[0],
  options: ReaderSourcePdfOptions = {},
) =>
  readerData.resolveReaderSourcePdf(manifestPayload, {
    findReadyManifestArtifact,
    resolveManifestArtifactUrl: (payload, key) =>
      resolveManifestArtifactUrl(payload, key),
    ...options,
  });
export const resolveReaderTranslatedPdfUrl = (
  jobPayload: Parameters<typeof readerData.resolveReaderTranslatedPdfUrl>[0],
  manifestPayload: Parameters<typeof readerData.resolveReaderTranslatedPdfUrl>[1],
  options: ReaderTranslatedPdfOptions = {},
) => readerData.resolveReaderTranslatedPdfUrl(jobPayload, manifestPayload, {
  resolveJobActions,
  findReadyManifestArtifact,
  resolveReaderArtifactUrl,
  resolveResourceUrl,
  ...options,
});
