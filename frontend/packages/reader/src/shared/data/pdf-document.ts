// 共享真值（原 frontend/web/src/js/reader/pdf-document.ts），已抽离为纯函数 + 可注入依赖
// 不直接 import frontend/web 的 job/artifacts 或 runtime/vendor-url，改为参数注入

import {
  defaultReaderPdfDocumentConfigPort,
} from "../config/pdf-document-config.js";
import type {
  BuildPdfDocumentOptionsArgs,
  LoadPdfDocumentArgs,
} from "../types/types.js";

function defaultResolveResourceUrl(value: unknown): string {
  return `${value ?? ""}`.trim();
}

function defaultResolvePdfjsVendorUrl(relativePath = ""): string {
  // standalone 默认空，需宿主注入真实 vendor-url
  return `${relativePath ?? ""}`.trim() ? `${relativePath}`.trim() : "";
}

const READER_RANGE_CHUNK_SIZE = 512 * 1024;
let pdfjsPromise: Promise<any> | null = null;

function getPdfjsUrls(resolvePdfjsVendorUrl: (path: string) => string = defaultResolvePdfjsVendorUrl) {
  return {
    moduleUrl: resolvePdfjsVendorUrl("build/pdf.mjs"),
    workerUrl: resolvePdfjsVendorUrl("build/pdf.worker.mjs"),
    cmapUrl: resolvePdfjsVendorUrl("cmaps/"),
    standardFontDataUrl: resolvePdfjsVendorUrl("standard_fonts/"),
  };
}

async function loadPdfjs({ resolvePdfjsVendorUrl = defaultResolvePdfjsVendorUrl }: { resolvePdfjsVendorUrl?: (path: string) => string } = {}) {
  const { moduleUrl, workerUrl } = getPdfjsUrls(resolvePdfjsVendorUrl);
  if (!moduleUrl) {
    throw new Error("resolvePdfjsVendorUrl not injected");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import(moduleUrl)
      .then((module: any) => {
        module.GlobalWorkerOptions.workerSrc = workerUrl;
        return module;
      })
      .catch((error: unknown) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

export function resolveReaderArtifactUrl(
  item: { resource_url?: string; resource_path?: string } | null | undefined,
  { resolveResourceUrl = defaultResolveResourceUrl }: { resolveResourceUrl?: (v: unknown) => string } = {},
): string {
  return resolveResourceUrl(item?.resource_url || item?.resource_path || "");
}

export function buildPdfDocumentOptions({
  url,
  configPort = defaultReaderPdfDocumentConfigPort,
  resolvePdfjsVendorUrl = defaultResolvePdfjsVendorUrl,
}: BuildPdfDocumentOptionsArgs & { resolvePdfjsVendorUrl?: (path: string) => string } = {}) {
  if (!url) {
    return null;
  }
  const { cmapUrl, standardFontDataUrl } = getPdfjsUrls(resolvePdfjsVendorUrl);
  return {
    url,
    httpHeaders: (configPort as any)?.apiHeaders?.() ?? {},
    withCredentials: false,
    disableRange: false,
    disableStream: false,
    rangeChunkSize: READER_RANGE_CHUNK_SIZE,
    cMapUrl: cmapUrl,
    cMapPacked: true,
    standardFontDataUrl,
  };
}

export async function loadPdfDocument({
  itemOrUrl,
  configPort = defaultReaderPdfDocumentConfigPort,
  fetchProtected = null,
  resolveResourceUrl = defaultResolveResourceUrl,
  resolvePdfjsVendorUrl = defaultResolvePdfjsVendorUrl,
}: LoadPdfDocumentArgs & {
  resolveResourceUrl?: (v: unknown) => string;
  resolvePdfjsVendorUrl?: (path: string) => string;
} = {}) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveReaderArtifactUrl(itemOrUrl as any, { resolveResourceUrl });
  if (!url) {
    return null;
  }
  const pdfjsLib = await loadPdfjs({ resolvePdfjsVendorUrl });
  const { cmapUrl, standardFontDataUrl } = getPdfjsUrls(resolvePdfjsVendorUrl);
  if (url.startsWith("mock://") && typeof fetchProtected === "function") {
    const response = await fetchProtected(url);
    const data = new Uint8Array(await (response as Response).arrayBuffer());
    return (pdfjsLib as any).getDocument({
      data,
      cMapUrl: cmapUrl,
      cMapPacked: true,
      standardFontDataUrl,
    }).promise;
  }
  return (pdfjsLib as any).getDocument(buildPdfDocumentOptions({ url, configPort, resolvePdfjsVendorUrl })).promise;
}

// 供单测重置缓存
export function __resetPdfjsForTests() {
  pdfjsPromise = null;
}
