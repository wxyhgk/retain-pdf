import { resolveResourceUrl } from "../job/artifacts.js";
import { resolvePdfjsVendorUrl } from "../runtime/vendor-url.js";
import {
  defaultReaderPdfDocumentConfigPort,
} from "./config-port.js";
import type {
  BuildPdfDocumentOptionsArgs,
  LoadPdfDocumentArgs,
} from "./types.js";

const PDFJS_MODULE_URL = resolvePdfjsVendorUrl("build/pdf.mjs");
const PDFJS_WORKER_URL = resolvePdfjsVendorUrl("build/pdf.worker.mjs");
const PDFJS_CMAP_URL = resolvePdfjsVendorUrl("cmaps/");
const PDFJS_STANDARD_FONT_DATA_URL = resolvePdfjsVendorUrl("standard_fonts/");

const READER_RANGE_CHUNK_SIZE = 512 * 1024;
let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_MODULE_URL)
      .then((module) => {
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return module;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

export function resolveReaderArtifactUrl(item: { resource_url?: string; resource_path?: string } | null | undefined) {
  return resolveResourceUrl(item?.resource_url || item?.resource_path || "");
}

export function buildPdfDocumentOptions({
  url,
  configPort = defaultReaderPdfDocumentConfigPort,
}: BuildPdfDocumentOptionsArgs = {}) {
  if (!url) {
    return null;
  }
  return {
    url,
    httpHeaders: configPort.apiHeaders(),
    withCredentials: false,
    disableRange: false,
    disableStream: false,
    rangeChunkSize: READER_RANGE_CHUNK_SIZE,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  };
}

export async function loadPdfDocument({
  itemOrUrl,
  configPort = defaultReaderPdfDocumentConfigPort,
  fetchProtected = null,
}: LoadPdfDocumentArgs = {}) {
  const url = typeof itemOrUrl === "string" ? itemOrUrl : resolveReaderArtifactUrl(itemOrUrl);
  if (!url) {
    return null;
  }
  const pdfjsLib = await loadPdfjs();
  // Tài nguyên mock:// chỉ fetchProtected chặn, nếu đưa thẳng cho pdfjs sẽ dùng XHR và thất bại
  if (url.startsWith("mock://") && typeof fetchProtected === "function") {
    const response = await fetchProtected(url);
    const data = new Uint8Array(await response.arrayBuffer());
    return pdfjsLib.getDocument({
      data,
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    }).promise;
  }
  return pdfjsLib.getDocument(buildPdfDocumentOptions({ url, configPort })).promise;
}
