import {
  resolveSourcePdfDownloadName,
  resolveTranslatedPdfDownloadName,
} from "../../job/artifacts.js";
import { createReaderDialogRuntimePort } from "../../bootstrap/reader-dialog-runtime-port.js";
import type { JobLike, ManifestPayload } from "../../job/types.js";
import { resolveReaderSourcePdf } from "../resource-resolver.js";

export const READER_DOWNLOAD_ACTIONS = Object.freeze({
  source: {
    fallbackSuffix: "source",
    label: "PDF gốc",
    operation: "Tải PDF gốc",
  },
  sideBySide: {
    fallbackSuffix: "side-by-side",
    label: "PDF đối chiếu",
    operation: "Tải PDF đối chiếu",
  },
  translated: {
    fallbackSuffix: "translated",
    label: "PDF bản dịch",
    operation: "Tải PDF bản dịch",
  },
});

export function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function readerDownloadNameState({ jobId = "", jobPayload = null, manifestPayload = null } = {}) {
  return {
    currentJobId: jobId,
    currentJobManifest: manifestPayload || null,
    currentJobManifestJobId: jobId,
    currentJobSnapshot: jobPayload || null,
  };
}

export function resolveReaderDownloadUrls({ jobId = "", jobPayload = null, manifestPayload = null } = {}) {
  const runtimePort = createReaderDialogRuntimePort({
    getCurrentJobId: (state?: unknown) => (state as { currentJobId?: string } | null | undefined)?.currentJobId,
    getCurrentJobSnapshot: (state?: unknown): JobLike | null =>
      ((state as { currentJobSnapshot?: JobLike | null } | null | undefined)?.currentJobSnapshot) || null,
    getCachedManifestFor: (state: unknown, _jobId?: unknown): ManifestPayload | null =>
      ((state as { currentJobManifest?: ManifestPayload | null } | null | undefined)?.currentJobManifest) || null,
  });
  const {
    translatedPdf,
    sideBySidePdf,
  } = runtimePort.currentArtifactUrls(readerDownloadNameState({ jobId, jobPayload, manifestPayload }));
  const readySourcePdf = resolveReaderSourcePdf(manifestPayload);
  const safeSourcePdf = readySourcePdf || "";
  return {
    source: safeSourcePdf,
    sideBySide: safeSourcePdf && translatedPdf ? sideBySidePdf : "",
    translated: translatedPdf,
  };
}

export function resolveReaderDownloadName(action, { jobId, jobPayload, manifestPayload }) {
  const fallbackName = `${jobId || "result"}-${READER_DOWNLOAD_ACTIONS[action]?.fallbackSuffix || "download"}.pdf`;
  const state = readerDownloadNameState({ jobId, jobPayload, manifestPayload });
  if (action === "source") {
    return resolveSourcePdfDownloadName(state, fallbackName) || fallbackName;
  }
  if (action === "translated") {
    return resolveTranslatedPdfDownloadName(state, fallbackName) || fallbackName;
  }
  return fallbackName;
}

export function disabledReason(action, urls) {
  if (action === "sideBySide" && (!urls.source || !urls.translated)) {
    return "PDF đối chiếu cần có cả PDF gốc và PDF bản dịch";
  }
  if (!urls.source && (action === "source" || action === "sideBySide")) {
    return "PDF gốc chưa được tạo hoặc manifest chưa khả dụng";
  }
  if (!urls.translated && (action === "translated" || action === "sideBySide")) {
    return "PDF bản dịch chưa được tạo hoặc manifest chưa khả dụng";
  }
  return "Địa chỉ tải xuống tạm không khả dụng";
}
