import { setReaderAiConfigAdapters } from "./shared/ai/config.js";
import {
  resetAnswerEnhanceAdapters,
  setAnswerEnhanceAdapters,
} from "./shared/ai/answer-enhance.js";
import type { createReaderDataPort } from "./runtime/data.js";
import type { createReaderPageConfigPort } from "./runtime/config.js";
import type {
} from "./shared/types/types.js";
import type { askLibraryAi } from "@retainpdf/api/ai";
import type { ReactNode } from "react";
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
export type ReaderCredentialsPort = {
  getCredentials?: () => { modelApiKey?: string } | null;
};
export type ReaderCredentialsAdapters = {
  credentialsPort: ReaderCredentialsPort;
};
/** 宿主往辅助面板里塞一块自己的 UI 时拿到的东西。 */
/** 宿主渲染 agent 产物（board/ 里的 HTML）时拿到的东西。
 *
 * 这块**接管文档区**（PDF 那半边），不是又开一个 dock 面板 —— 用户要的是
 * 「左边直接打开」。所以它和 ReaderCompareGrid 是二选一，由 App 决定。
 *
 * 包不认识 board 端点，也不认识 HTML 怎么安全渲染（那一整套隔离在宿主的
 * domain/board-html.ts 里）。这里只约定「给你 jobId 和文件名，还我一块内容」。
 */
export type ReaderBoardSlotProps = {
  jobId: string;
  /** board/ 里的文件名。 */
  name: string;
  onClose: () => void;
};

export type ReaderBoardAdapters = {
  /** 不提供 = 打不开 agent 产物，AI 面板里也不会出现那一条。 */
  renderReaderBoard?: (props: ReaderBoardSlotProps) => ReactNode;
};

export type ReaderTerminalSlotProps = {
  open: boolean;
  /** 同一个 key 接回同一份终端会话。用 jobId，换文档就换终端。 */
  sessionKey: string;
  /** 「从选区问 AI」要送进终端的那段文字。
   *
   * 宿主只在 token 变了时注入一次，且**不替用户回车** —— 由页面选区拼出来的
   * 一条命令直接开跑太意外了，得让人先看见自己要问什么。
   * token 而不是文本判重：连着两次选同一段，两次都该送。 */
  pendingInput: { text: string; token: number } | null;
  /** agent 在 board/ 里写了个能看的东西，请求把它在左边打开。
   *
   * 由包来开：文档区归包管，宿主自己去改左半边会和分栏/模式状态打架。 */
  onOpenBoard: (name: string) => void;
  onClose: () => void;
};

export type ReaderTerminalAdapters = {
  /** 终端面板由**宿主**渲染。
   *
   * 本包不认识终端用什么渲染，也不认识它连到哪 —— 那是 RetainPDF 应用的东西，
   * 而这个包要能被别的宿主用。所以这里只留一个槽：包决定它在 dock 里的位置和
   * 生命周期，内容宿主给。
   *
   * 不提供 = 这个 tab 在 dock 里根本不出现。留一个点了没反应的 tab 比没有
   * 这个功能更糟。
   */
  renderReaderTerminal?: (props: ReaderTerminalSlotProps) => ReactNode;
};

/** 悬停框「摘到笔记」送出的一段：哪一块、原文在第几页，和点的时候的原文、译文。
 *  任务、书、书名由宿主补（宿主知道自己开的是哪个任务）。 */
export type ReaderNotesQuote = {
  itemId: string;
  /** 原文所在页，0 起。 */
  pageIdx: number;
  sourceText: string;
  /** 跨块、跨页接起来的段落是整段；还没翻译时为 null。 */
  translatedText: string | null;
};

export type ReaderNotesQuoteAdapters = {
  /** 「摘到笔记」：阅读页放在笔记（Studio）里、和它握过手时由宿主给。
   *
   * 包不认识笔记，也不认识消息怎么发，只问两件事：现在能不能摘（`available`，每次画悬停框时问），
   * 摘的时候把这一段交出去（`send`，返回有没有送出去）。不提供或 `available()` 为假 = 悬停框里不出这个按钮。 */
  notesQuote?: {
    available: () => boolean;
    send: (quote: ReaderNotesQuote) => boolean;
  };
};

/** 「笔记」按钮：阅读页放在笔记（Studio）里、Studio 认 open-notes 时由宿主给。开没开由 Studio 说了算，宿主转告。 */
export type ReaderNotesPanelState = { available: boolean; open: boolean; title: string | null };

export type ReaderNotesPanelAdapters = {
  /** 不提供或 `available` 为假 = 顶栏没有「笔记」按钮。`getState` 没变时返回同一个对象（给 useSyncExternalStore）。 */
  notesPanel?: {
    getState: () => ReaderNotesPanelState;
    subscribe: (listener: () => void) => () => void;
    toggle: () => void;
  };
};

export type ReaderAdapters = ReaderSessionAdapters
  & ReaderMarkdownAdapters
  & ReaderDownloadAdapters
  & ReaderDocumentIdentityAdapters
  & ReaderCredentialsAdapters
  & ReaderTerminalAdapters
  & ReaderBoardAdapters
  & ReaderNotesQuoteAdapters
  & ReaderNotesPanelAdapters;

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
  "credentialsPort",
  "renderReaderTerminal",
  "renderReaderBoard",
  "notesQuote",
  "notesPanel",
] as const satisfies readonly (keyof ReaderAdapters)[];

/** 必填（非 `?`）适配键子集，供门禁断言最小注入面。 */
export const READER_REQUIRED_ADAPTER_KEYS = [
  "resolveMarkdownAssetUrl",
  "resolveReaderDownloadUrls",
  "resolveReaderDownloadName",
  "downloadProtectedResource",
  "failDownloadToast",
  "fetchDocumentByJobId",
  "credentialsPort",
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
  setReaderAiConfigAdapters({ credentialsPort: a?.credentialsPort ?? null });
  resetAnswerEnhanceAdapters();
  if (a) {
    setAnswerEnhanceAdapters({
      fetchProtected: a.fetchProtected,
      resolveResourceUrl: a.resolveResourceUrl,
    });
  }
}
export function getReaderAdapters(): ReaderAdapters | null { return _adapters; }
export function requireAdapter<T extends keyof ReaderAdapters>(key: T): NonNullable<ReaderAdapters[T]> {
  const v = _adapters?.[key];
  if (v == null) throw new Error(`Reader adapter missing: ${String(key)} (call setReaderAdapters)`);
  return v as NonNullable<ReaderAdapters[T]>;
}

/** 渲染 agent 产物那一块。
 *
 * 宿主没注册渲染器时返回 null —— 调用方据此回落到 PDF，而不是留一块空白。
 * 和槽位面板同一条规矩：没有实现就当这个功能不存在，不给一个点了没反应的入口。
 */
export function renderReaderBoardSlot(props: ReaderBoardSlotProps): ReactNode {
  return getReaderAdapters()?.renderReaderBoard?.(props) ?? null;
}
