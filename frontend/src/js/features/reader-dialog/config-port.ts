import {
  buildFrontendPageUrl,
  isTrustedWindowMessage,
  mockScenario,
} from "../../config/runtime.js";

export function createReaderDialogConfigPort({
  buildPageUrl = buildFrontendPageUrl,
  trustWindowMessage = isTrustedWindowMessage,
  locationProvider = () => globalThis.window?.location,
  mockScenarioProvider = mockScenario,
}: any = {}) {
  function currentMockScenarioSafe() {
    try {
      return `${mockScenarioProvider() || ""}`.trim();
    } catch (_err) {
      return "";
    }
  }

  function buildReaderPageUrl(jobId, anchor = null) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    // iframe Là một tài liệu độc lập,mock Các tình huống cần phải minh bạch rõ ràng,Nếu không, trình đọc được nhúng sẽ yêu cầu phụ trợ thực
    const scenario = currentMockScenarioSafe();
    const pageIdx = Number(anchor?.pageIdx);
    return buildPageUrl("./reader.html", {
      job_id: normalizedJobId,
      ...(Number.isFinite(pageIdx) && anchor?.pageIdx !== null && anchor?.pageIdx !== undefined
        ? { page_idx: `${pageIdx}` }
        : {}),
      ...(`${anchor?.blockId || ""}`.trim() ? { block_id: `${anchor.blockId}`.trim() } : {}),
      ...(scenario ? { mock: scenario } : {}),
    });
  }

  // Tài liệu thu thập"Đọc bản gốc":không có job,dùng document_id Mở trình đọc tài liệu nguồn chỉ đọc(F4)。
  function buildReaderDocumentPageUrl(documentId, anchor = null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return "";
    }
    const scenario = currentMockScenarioSafe();
    const pageIdx = Number(anchor?.pageIdx);
    return buildPageUrl("./reader.html", {
      document_id: normalizedId,
      ...(Number.isFinite(pageIdx) && anchor?.pageIdx !== null && anchor?.pageIdx !== undefined
        ? { page_idx: `${pageIdx}` }
        : {}),
      ...(`${anchor?.blockId || ""}`.trim() ? { block_id: `${anchor.blockId}`.trim() } : {}),
      ...(scenario ? { mock: scenario } : {}),
    });
  }

  function currentHref() {
    return locationProvider()?.href || "http://127.0.0.1/";
  }

  function buildReaderRouteUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    const url = new URL(currentHref());
    if (!normalizedJobId) {
      url.searchParams.delete("view");
      url.searchParams.delete("job_id");
      return url.toString();
    }
    url.searchParams.set("job_id", normalizedJobId);
    url.searchParams.set("view", "reader");
    return url.toString();
  }

  function requestedReaderJobIdFromLocation() {
    const url = new URL(currentHref());
    const view = `${url.searchParams.get("view") || ""}`.trim();
    const jobId = `${url.searchParams.get("job_id") || ""}`.trim();
    return view === "reader" && jobId ? jobId : "";
  }

  function isTrustedReaderMessage(event, expectedSource = null) {
    return trustWindowMessage(event, expectedSource);
  }

  return Object.freeze({
    buildReaderPageUrl,
    buildReaderDocumentPageUrl,
    buildReaderRouteUrl,
    isTrustedReaderMessage,
    requestedReaderJobIdFromLocation,
  });
}

export const defaultReaderDialogConfigPort = createReaderDialogConfigPort();
