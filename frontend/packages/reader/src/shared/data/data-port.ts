// 共享真值（原 frontend/web/src/js/reader/data-port.ts），已抽离为纯函数 + 可注入依赖
// 不直接 import frontend/web 的 api/http，改为参数注入，默认用 window/fetch 或空实现

import {
  hasMarkdownContent,
  loadMarkdownPayloadWithFallback,
  resolveLinkedMarkdownJobId,
} from "./markdown-payload.js";

const DEFAULT_API_PREFIX = "/api/v1";

function defaultLoadJob(): Promise<unknown> {
  return Promise.resolve(null);
}
function defaultLoadManifest(): Promise<unknown> {
  return Promise.resolve({ items: [] } as unknown);
}
function defaultLoadMarkdown(): Promise<unknown> {
  return Promise.resolve(null);
}
function defaultLoadMarkdownDocument(): Promise<unknown> {
  return Promise.resolve(null);
}
function defaultLoadAiChat(): Promise<unknown> {
  return Promise.resolve({ answer: "" } as unknown);
}
function defaultLoadRegions(): Promise<unknown> {
  return Promise.resolve({ items: [] } as unknown);
}
function defaultLoadMetadata(): Promise<unknown> {
  return Promise.resolve(null);
}
function defaultLoadTranslationItem(): Promise<unknown> {
  return Promise.resolve(null);
}
function defaultFetchProtected(input: any, init?: RequestInit): Promise<Response> {
  if (typeof globalThis.fetch === "function") {
    return (globalThis.fetch as any)(input, init);
  }
  return Promise.reject(new Error(`fetchProtected not injected for ${input}`));
}

export function createReaderDataPort({
  apiPrefix = DEFAULT_API_PREFIX,
  loadJob = defaultLoadJob,
  loadManifest = defaultLoadManifest,
  loadMarkdown = defaultLoadMarkdown,
  loadMarkdownDocument = defaultLoadMarkdownDocument,
  loadAiChat = defaultLoadAiChat,
  loadRegions = defaultLoadRegions,
  loadMetadata = defaultLoadMetadata,
  loadTranslationItem = defaultLoadTranslationItem,
  fetchProtectedResource = defaultFetchProtected,
}: {
  apiPrefix?: string;
  loadJob?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadManifest?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadMarkdown?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadMarkdownDocument?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadAiChat?: (jobId: string, payload: unknown, apiPrefix: string) => Promise<unknown>;
  loadRegions?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadMetadata?: (jobId: string, apiPrefix: string) => Promise<unknown>;
  loadTranslationItem?: (jobId: string, itemId: string, apiPrefix: string) => Promise<unknown>;
  fetchProtectedResource?: typeof fetch;
} = {}) {
  async function loadReaderPayload(jobId: string) {
    const [jobPayload, manifestPayload, regionsPayload, readerMetadata] = await Promise.all([
      loadJob(jobId, apiPrefix),
      // During OCR the immutable artifact manifest does not exist yet. That is
      // a normal in-progress state: the Reader can still load the document's
      // source PDF and reserve the right pane for live translation.
      loadManifest(jobId, apiPrefix).catch(() => ({ items: [] })),
      (loadRegions as any)(jobId, apiPrefix).catch(() => ({ items: [] })),
      (loadMetadata as any)(jobId, apiPrefix).catch(() => null),
    ]);
    return {
      jobPayload,
      manifestPayload,
      readerMetadata,
      regionsPayload,
    };
  }

  function loadJobPayload(jobId: string) {
    return loadJob(jobId, apiPrefix);
  }

  function fetchRegionTranslationItem(jobId: string, itemId: string) {
    return loadTranslationItem(jobId, itemId, apiPrefix);
  }

  async function loadMarkdownPayload(jobId: string) {
    const currentPayload = await loadMarkdownPayloadWithFallback(
      () => loadMarkdownDocument(jobId, apiPrefix),
      () => loadMarkdown(jobId, apiPrefix),
    );
    if (hasMarkdownContent(currentPayload)) return currentPayload;

    // OCR-reuse translation jobs do not copy the source Markdown into their
    // own job root. Follow the public source_artifact_job_id and load the
    // canonical Markdown from the OCR job instead.
    try {
      const jobPayload = await loadJob(jobId, apiPrefix);
      const linkedJobId = resolveLinkedMarkdownJobId(jobPayload, jobId);
      if (!linkedJobId) return currentPayload;
      const linkedPayload = await loadMarkdownPayloadWithFallback(
        () => loadMarkdownDocument(linkedJobId, apiPrefix),
        () => loadMarkdown(linkedJobId, apiPrefix),
      );
      return hasMarkdownContent(linkedPayload) ? linkedPayload : currentPayload;
    } catch {
      return currentPayload;
    }
  }

  function submitAiChat(jobId: string, payload: unknown) {
    return loadAiChat(jobId, payload, apiPrefix);
  }

  return Object.freeze({
    apiPrefix,
    fetchProtected: fetchProtectedResource,
    fetchRegionTranslationItem,
    loadMarkdownPayload,
    loadJobPayload,
    loadReaderPayload,
    submitAiChat,
  });
}

export const defaultReaderDataPort = createReaderDataPort();
