import {
  buildFrontendPageUrl,
  isTrustedWindowMessage,
  mockScenario,
} from "@/platform/config/runtime.js";

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
    // iframe 是独立文档,mock 场景需要显式透传,否则嵌入式阅读器会去请求真实后端
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

  // 馆藏文档"读原文":没有 job,用 document_id 打开只读源文档阅读器(F4)。
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
