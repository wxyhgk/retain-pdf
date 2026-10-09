import { defaultReaderDialogConfigPort } from "./config-port.js";
import type { ReaderAnchor } from "@/platform/navigation/pages.js";

export function buildReaderPageUrl(jobId: string, anchor: ReaderAnchor | null = null) {
  return defaultReaderDialogConfigPort.buildReaderPageUrl(jobId, anchor);
}

export function buildReaderDocumentPageUrl(documentId: string, anchor: ReaderAnchor | null = null) {
  return defaultReaderDialogConfigPort.buildReaderDocumentPageUrl(documentId, anchor);
}

export function buildReaderRouteUrl(jobId: string) {
  return defaultReaderDialogConfigPort.buildReaderRouteUrl(jobId);
}

export function requestedReaderJobIdFromLocation() {
  return defaultReaderDialogConfigPort.requestedReaderJobIdFromLocation();
}
