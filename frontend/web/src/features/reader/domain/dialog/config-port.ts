import {
  buildFrontendPageUrl,
  isTrustedWindowMessage,
  mockScenario,
} from "@/platform/config/runtime.js";
import { buildReaderParams, parseReaderParams } from "@/platform/navigation/pages.js";
import type { ReaderAnchor } from "@/platform/navigation/pages.js";

// 注入点签名直接取自 platform 运行时真值，避免 `any` 让宿主错配/漏接静默通过。
type ReaderDialogConfigPortOptions = {
  buildPageUrl?: typeof buildFrontendPageUrl;
  trustWindowMessage?: typeof isTrustedWindowMessage;
  locationProvider?: () => { href?: string | null } | null | undefined;
  mockScenarioProvider?: typeof mockScenario;
};

export function createReaderDialogConfigPort({
  buildPageUrl = buildFrontendPageUrl,
  trustWindowMessage = isTrustedWindowMessage,
  locationProvider = () => globalThis.window?.location,
  mockScenarioProvider = mockScenario,
}: ReaderDialogConfigPortOptions = {}) {
  function currentMockScenarioSafe() {
    try {
      return `${mockScenarioProvider() || ""}`.trim();
    } catch (_err) {
      return "";
    }
  }

  function buildReaderPageUrl(jobId: string, anchor: ReaderAnchor | null = null) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    // URL 契约统一由 platform/navigation/pages 构造；iframe 是独立文档，
    // mock 场景需要显式透传，否则嵌入式阅读器会去请求真实后端。
    return buildPageUrl("./reader.html", buildReaderParams({
      jobId: normalizedJobId,
      anchor,
      mock: currentMockScenarioSafe(),
    }));
  }

  // 馆藏文档"读原文":没有 job,用 document_id 打开只读源文档阅读器(F4)。
  function buildReaderDocumentPageUrl(documentId: string, anchor: ReaderAnchor | null = null) {
    const normalizedId = `${documentId || ""}`.trim();
    if (!normalizedId) {
      return "";
    }
    return buildPageUrl("./reader.html", buildReaderParams({
      documentId: normalizedId,
      anchor,
      mock: currentMockScenarioSafe(),
    }));
  }

  function currentHref() {
    return locationProvider()?.href || "http://127.0.0.1/";
  }

  function buildReaderRouteUrl(jobId: string) {
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
    const jobId = parseReaderParams(url.search).jobId;
    return view === "reader" && jobId ? jobId : "";
  }

  function isTrustedReaderMessage(event: MessageEvent, expectedSource: MessageEventSource | null = null) {
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
