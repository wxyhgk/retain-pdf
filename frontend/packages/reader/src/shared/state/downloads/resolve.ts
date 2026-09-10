// 共享真值（原 frontend/web/src/js/reader/downloads/resolve.ts），已抽离为可注入依赖
// 纯函数 + 工厂注入：不直接 import frontend/web 的 job/bootstrap/resource-resolver，改为参数注入

export const READER_DOWNLOAD_ACTIONS = Object.freeze({
  source: {
    fallbackSuffix: "source",
    label: "原始 PDF",
    operation: "下载原始 PDF",
  },
  sideBySide: {
    fallbackSuffix: "side-by-side",
    label: "对照 PDF",
    operation: "下载对照 PDF",
  },
  translated: {
    fallbackSuffix: "translated",
    label: "译文 PDF",
    operation: "下载译文 PDF",
  },
});

export function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readerDownloadNameState({ jobId = "", jobPayload = null, manifestPayload = null }: { jobId?: string; jobPayload?: unknown; manifestPayload?: unknown } = {}) {
  return {
    currentJobId: jobId,
    currentJobManifest: manifestPayload || null,
    currentJobManifestJobId: jobId,
    currentJobSnapshot: jobPayload || null,
  };
}

export function disabledReason(action: string, urls: any) {
  if (action === "sideBySide" && (!urls.source || !urls.translated)) {
    return "对照 PDF 需要原始 PDF 和译文 PDF 都可用";
  }
  if (!urls.source && (action === "source" || action === "sideBySide")) {
    return "原始 PDF 尚未生成或清单不可用";
  }
  if (!urls.translated && (action === "translated" || action === "sideBySide")) {
    return "译文 PDF 尚未生成或清单不可用";
  }
  return "下载地址暂不可用";
}

export interface ReaderDownloadResolverOptions {
  resolveSourcePdfDownloadName?: (state: any, fallbackName: string) => string;
  resolveTranslatedPdfDownloadName?: (state: any, fallbackName: string) => string;
  createRuntimePort?: (deps: {
    getCurrentJobId: (state?: unknown) => string;
    getCurrentJobSnapshot: (state?: unknown) => any;
    getCachedManifestFor: (state: unknown, jobId?: unknown) => any;
  }) => { currentArtifactUrls: (state: any) => { sourcePdf?: string; translatedPdf?: string; sideBySidePdf?: string } };
  resolveSourcePdf?: (manifestPayload: unknown) => unknown;
}

export function createReaderDownloadResolver({
  resolveSourcePdfDownloadName = (_state: any, fallback: string) => fallback || "",
  resolveTranslatedPdfDownloadName = (_state: any, fallback: string) => fallback || "",
  createRuntimePort = null as any,
  resolveSourcePdf = (_manifest: unknown) => "" as unknown,
}: ReaderDownloadResolverOptions = {}) {
  function resolveReaderDownloadUrls({ jobId = "", jobPayload = null, manifestPayload = null }: { jobId?: string; jobPayload?: unknown; manifestPayload?: unknown } = {}) {
    let translatedPdf = "";
    let sideBySidePdf = "";
    if (createRuntimePort) {
      const runtimePort = createRuntimePort({
        getCurrentJobId: (state?: unknown) => (state as { currentJobId?: string } | null | undefined)?.currentJobId || "",
        getCurrentJobSnapshot: (state?: unknown): any =>
          ((state as { currentJobSnapshot?: any } | null | undefined)?.currentJobSnapshot) || null,
        getCachedManifestFor: (state: unknown, _jobId?: unknown): any =>
          ((state as { currentJobManifest?: any } | null | undefined)?.currentJobManifest) || null,
      });
      const urls = runtimePort.currentArtifactUrls(readerDownloadNameState({ jobId, jobPayload, manifestPayload }));
      translatedPdf = (urls as any).translatedPdf || "";
      sideBySidePdf = (urls as any).sideBySidePdf || "";
    }
    const readySourcePdf: any = resolveSourcePdf(manifestPayload);
    // 保留原语义：resolveReaderSourcePdf 可能返回 string 或 ManifestArtifactItem 对象
    // 沿用原文件的 `|| ""` 逻辑，对象视为 truthy
    const safeSourcePdf: any = readySourcePdf || "";
    // 若上游返回对象而非字符串，尝试取 resource_url/path 兜底为字符串（兼容 pure 测试）
    const normalizedSource = typeof safeSourcePdf === "string"
      ? safeSourcePdf
      : safeSourcePdf && typeof safeSourcePdf === "object"
        ? (safeSourcePdf.resource_url || safeSourcePdf.resource_path || safeSourcePdf.resourceUrl || safeSourcePdf.resourcePath || "")
        : "";
    // 原实现直接返回 safeSourcePdf（可能是对象），但为下游禁用判断统一归一为字符串空/有效
    // 若原始为对象且含 url，返回该 url 字符串；否则若为对象但无 url，视为有源（保持 truthy 但返回 "" 会误判禁用）
    // 为最小偏离原行为：若 safeSourcePdf 是对象且能提取 url，则用 url；否则若是对象本身 truthy 则保留 "" 以外的值？
    // 原代码 `source: safeSourcePdf` 会把对象直接暴露；现改为若能提取则暴露字符串，否则暴露原始对象（保持 truthy）
    const sourceValue = typeof safeSourcePdf === "string" ? safeSourcePdf : (normalizedSource || safeSourcePdf);
    return {
      source: typeof sourceValue === "string" ? sourceValue : (sourceValue || ""),
      sideBySide: (typeof sourceValue === "string" ? sourceValue : normalizedSource || safeSourcePdf) && translatedPdf ? sideBySidePdf : "",
      translated: translatedPdf,
    };
  }

  function resolveReaderDownloadName(action: string, { jobId, jobPayload, manifestPayload }: { jobId: string; jobPayload: unknown; manifestPayload: unknown }) {
    const fallbackName = `${jobId || "result"}-${(READER_DOWNLOAD_ACTIONS as any)[action]?.fallbackSuffix || "download"}.pdf`;
    const state = readerDownloadNameState({ jobId, jobPayload, manifestPayload });
    if (action === "source") {
      return resolveSourcePdfDownloadName(state, fallbackName) || fallbackName;
    }
    if (action === "translated") {
      return resolveTranslatedPdfDownloadName(state, fallbackName) || fallbackName;
    }
    return fallbackName;
  }

  return Object.freeze({
    resolveReaderDownloadUrls,
    resolveReaderDownloadName,
    readerDownloadNameState,
    disabledReason,
    trimString,
    READER_DOWNLOAD_ACTIONS,
  });
}

// 默认无注入的纯 fallback（用于未注入环境的单元测试，不依赖 frontend/web）
const defaultResolver = createReaderDownloadResolver();

export const resolveReaderDownloadUrls = defaultResolver.resolveReaderDownloadUrls;
export const resolveReaderDownloadName = defaultResolver.resolveReaderDownloadName;
