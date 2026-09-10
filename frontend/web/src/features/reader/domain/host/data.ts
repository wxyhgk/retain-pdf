/** RetainPDF API and artifact bindings for the package-owned Reader data runtime. */
import { fetchProtected as fetchApiProtected } from "@retainpdf/api/http";
import {
  fetchJobArtifactsManifest as fetchApiJobArtifactsManifest,
  fetchJobMarkdown as fetchApiJobMarkdown,
  fetchJobMarkdownDocument as fetchApiJobMarkdownDocument,
} from "@retainpdf/api/jobs-artifacts";
import { fetchJobPayload as fetchApiJobPayload } from "@retainpdf/api/jobs";
import {
  fetchReaderMetadata as fetchApiReaderMetadata,
  fetchReaderRegions as fetchApiReaderRegions,
} from "@retainpdf/api/reader";
import { fetchTranslationItem as fetchApiTranslationItem } from "@retainpdf/api/translation-debug";
import {
  findReadyManifestArtifact,
  resolveJobActions,
  resolveManifestArtifactUrl,
  resolveResourceUrl,
} from "@retainpdf/domain/job";
import * as readerData from "@retainpdf/reader/runtime/data";
import {
  fetchMockProtected,
  getMockJobArtifactsManifest,
  getMockJobPayload,
  getMockJobMarkdown,
} from "@/platform/mock/index.js";
import { getMockReaderRegions } from "@/platform/mock/documents.js";
import { getMockTranslationItem } from "@/platform/mock/translation.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { isMockMode } from "@/platform/config/runtime.js";
import { resolvePdfjsVendorUrl } from "@/platform/runtime/vendor-url.js";
import { defaultReaderPdfDocumentConfigPort } from "./config.js";

async function fetchJobPayload(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void apiPrefix;
    return getMockJobPayload(jobId);
  }
  return fetchApiJobPayload(jobId, apiPrefix ? { apiPrefix } : undefined);
}

async function fetchJobArtifactsManifest(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobArtifactsManifest();
  }
  return fetchApiJobArtifactsManifest(jobId, apiPrefix);
}

async function fetchJobMarkdown(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobMarkdown();
  }
  return fetchApiJobMarkdown(jobId, apiPrefix);
}

async function fetchJobMarkdownDocument(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockJobMarkdown();
  }
  return fetchApiJobMarkdownDocument(jobId, apiPrefix);
}

async function fetchReaderRegions(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockReaderRegions();
  }
  return fetchApiReaderRegions(jobId, apiPrefix);
}

async function fetchReaderMetadata(jobId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return null;
  }
  return fetchApiReaderMetadata(jobId, apiPrefix);
}

async function fetchTranslationItem(jobId: string, itemId: string, apiPrefix?: string): Promise<any> {
  if (isMockMode()) {
    void apiPrefix;
    return getMockTranslationItem(jobId, itemId);
  }
  return fetchApiTranslationItem(jobId, itemId, apiPrefix);
}

export async function fetchProtected(url: string, options: RequestInit = {}): Promise<Response> {
  if (isMockMode() && `${url || ""}`.startsWith("mock://")) {
    return fetchMockProtected(url);
  }
  return fetchApiProtected(url, options);
}

export const createReaderDataPort = (options: any = {}) =>
  readerData.createReaderDataPort({
    apiPrefix: API_PREFIX,
    loadJob: fetchJobPayload,
    loadManifest: fetchJobArtifactsManifest,
    loadMarkdown: fetchJobMarkdown,
    loadMarkdownDocument: fetchJobMarkdownDocument,
    loadRegions: fetchReaderRegions,
    loadMetadata: fetchReaderMetadata,
    loadTranslationItem: fetchTranslationItem,
    fetchProtectedResource: fetchProtected,
    ...options,
  });
export const defaultReaderDataPort = createReaderDataPort();

export const resolveReaderArtifactUrl = (item: any, options: any = {}) =>
  readerData.resolveReaderArtifactUrl(item, { resolveResourceUrl, ...options });
export const buildPdfDocumentOptions = (options: any = {}) =>
  readerData.buildPdfDocumentOptions({
    configPort: defaultReaderPdfDocumentConfigPort,
    resolvePdfjsVendorUrl,
    ...options,
  });
export const loadPdfDocument = (options: any = {}) =>
  readerData.loadPdfDocument({
    configPort: defaultReaderPdfDocumentConfigPort,
    resolveResourceUrl,
    resolvePdfjsVendorUrl,
    ...options,
  });
export const __resetPdfjsForTests = readerData.__resetPdfjsForTests;

export const resolveReaderJobId = readerData.resolveReaderJobId;
export const resolveReaderSourcePdf = (manifestPayload: any, options: any = {}) =>
  readerData.resolveReaderSourcePdf(manifestPayload, {
    findReadyManifestArtifact,
    resolveManifestArtifactUrl: (payload: any, key: string) =>
      resolveManifestArtifactUrl(payload, key),
    ...options,
  });
export const resolveReaderTranslatedPdfUrl = (
  jobPayload: any,
  manifestPayload: any,
  options: any = {},
) => readerData.resolveReaderTranslatedPdfUrl(jobPayload, manifestPayload, {
  resolveJobActions,
  findReadyManifestArtifact,
  resolveReaderArtifactUrl,
  resolveResourceUrl,
  ...options,
});
