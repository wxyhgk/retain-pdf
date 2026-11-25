import type { createReaderDataPort } from "./runtime/data.js";
import type { createReaderPageConfigPort } from "./runtime/config.js";
import type {
} from "./shared/types/types.js";
import type { ReaderLiveTranslationPort } from "./contracts/live-translation.js";
import type { ReaderPdfPort } from "./contracts/pdf.js";
import type { ReaderSessionDataPort } from "./contracts/session.js";
export {
  hasMarkdownContent,
  loadMarkdownPayloadWithFallback,
  normalizeMarkdownPayload,
} from "./shared/data/markdown-payload.js";

// frontend/packages/reader 对宿主环境的唯一契约（取代 frontend/web/src/pages/reader/external.ts）
// 扩展：将 external 的 20+ 符号收敛为可注入能力，逐步替换直接 import
export type ReaderSessionAdapters = {
  // 细粒度：保留旧 external 的关键能力以便渐进迁移
  isMockMode?: () => boolean;
  resolveResourceUrl?: (url: string) => string;
  fetchProtected?: typeof fetch;
  resolvePdfjsVendorUrl?: (relativePath?: string) => string;
  // 形状直接取自包内 runtime 工厂签名，宿主漏注入/结构漂移在 tsc 阶段暴露。
  defaultReaderDataPort?: ReturnType<typeof createReaderDataPort>;
  defaultReaderPageConfigPort?: ReturnType<typeof createReaderPageConfigPort>;
  resolveReaderAnchor?: (...args: any[]) => any;
  resolveReaderDocumentId?: () => string;
  resolveReaderJobId?: () => string;
  resolveReaderArtifactUrl?: (...args: any[]) => string;
  resolveReaderSourcePdf?: (...args: any[]) => any;
  resolveReaderTranslatedPdfUrl?: (...args: any[]) => string;
  /** Optional during migration; hosts without live translation remain supported. */
  liveTranslation?: ReaderLiveTranslationPort;
  /** Optional during migration; legacy flat fields remain supported. */
  pdf?: ReaderPdfPort;
  /** Optional during migration; legacy data/runtime fields remain supported. */
  sessionData?: ReaderSessionDataPort;
};
export type ReaderMarkdownAdapters = {
  resolveMarkdownAssetUrl: (imagesBaseUrl: unknown, relativePath: unknown) => string;
};
export type ReaderDownloadContext = {
  jobId?: string;
  jobPayload?: unknown;
  manifestPayload?: unknown;
};
export type ReaderDownloadUrls = {
  source: string;
  sideBySide: string;
  translated: string;
};
export type ReaderDownloadAdapters = {
  resolveReaderDownloadUrls: (context?: ReaderDownloadContext) => ReaderDownloadUrls;
  resolveReaderDownloadName: (action: string, context: ReaderDownloadContext) => string;
  downloadProtectedResource: (
    fetchProtected: typeof fetch,
    url: string,
    fallbackName: string,
    preferredName?: string,
    onStatus?: ((status: unknown) => void) | null,
    onBusy?: ((busy: boolean, status?: string) => void) | null,
  ) => Promise<unknown>;
  failDownloadToast: (message?: string) => void;
};
/** 文档身份查询。原来这块叫 ReaderFavoritesAdapters —— 收藏删掉之后只剩这两项，
 * 而它们是「按 jobId 反查文档」这件事，跟收藏无关。 */
export type ReaderDocumentIdentityAdapters = {
  apiPrefix?: string;
  fetchDocumentByJobId: (apiPrefix: string, jobId: string) => Promise<{
    document_id?: string;
    active_job_id?: string | null;
    active_version_id?: string | null;
  } | null>;
};
export type ReaderAdapters = ReaderSessionAdapters
  & ReaderMarkdownAdapters
  & ReaderDownloadAdapters
  & ReaderDocumentIdentityAdapters;

/**
 * ReaderAdapters 声明键的运行时镜像（TS 类型在运行时被擦除）。
 * 注册层与门禁测试共用，避免手工复制字段集漂移；`satisfies` 保证不引入拼错键。
 * 完整性由紧随其后的编译期断言守护。
 */
export const READER_ADAPTER_KEYS = [
  "isMockMode",
  "resolveResourceUrl",
  "fetchProtected",
  "resolvePdfjsVendorUrl",
  "defaultReaderDataPort",
  "defaultReaderPageConfigPort",
  "resolveReaderAnchor",
  "resolveReaderDocumentId",
  "resolveReaderJobId",
  "resolveReaderArtifactUrl",
  "resolveReaderSourcePdf",
  "resolveReaderTranslatedPdfUrl",
  "liveTranslation",
  "pdf",
  "sessionData",
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "apiPrefix",
  "fetchDocumentByJobId",
] as const satisfies readonly (keyof ReaderAdapters)[];

/** 必填（非 `?`）适配键子集，供门禁断言最小注入面。 */
export const READER_REQUIRED_ADAPTER_KEYS = [
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "fetchDocumentByJobId",
] as const satisfies readonly (keyof ReaderAdapters)[];

type RequiredAdapterKey = {
  [K in keyof ReaderAdapters]: undefined extends ReaderAdapters[K] ? never : K;
}[keyof ReaderAdapters];

// 编译期守护：声明新增/删除字段时，上面两个运行时数组必须同步。
const _adapterKeysComplete: Exclude<
  keyof ReaderAdapters,
  (typeof READER_ADAPTER_KEYS)[number]
> extends never ? true : false = true;
const _requiredKeysCovered: Exclude<
  RequiredAdapterKey,
  (typeof READER_REQUIRED_ADAPTER_KEYS)[number]
> extends never ? true : false = true;
void _adapterKeysComplete;
void _requiredKeysCovered;

// 全局注入注册（monorepo 内由 frontend/web 在启动时 set）
let _adapters: ReaderAdapters | null = null;
export function setReaderAdapters(a: ReaderAdapters | null) {
  _adapters = a;
}
export function getReaderAdapters(): ReaderAdapters | null { return _adapters; }
export function requireAdapter<T extends keyof ReaderAdapters>(key: T): NonNullable<ReaderAdapters[T]> {
  const v = _adapters?.[key];
  if (v == null) throw new Error(`Reader adapter missing: ${String(key)} (call setReaderAdapters)`);
  return v as NonNullable<ReaderAdapters[T]>;
}
