import type { ReaderSessionDataPort, ReaderOptionalArtifactErrors, LinkedDocumentRecord } from "../../contracts/session.js";
import type { ReaderMetadata, ReaderRegion } from "../../shared/data/reader-regions.js";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";

export type ReaderMode = "source" | "translated" | "compare";

/**
 * 可选产物（译文区域 regions / 元数据 metadata）的加载错误。
 * 两者失败都不致命：正文仍可读，但要向用户如实说明，而不是静默降级。
 * 成功或请求被跳过时为 null。
 */


/** 与 legacy ReaderDownloadMenu 相同的下载上下文 */
export type ReaderDownloadContext = {
  fetchProtected: ReaderSessionDataPort["fetchProtected"];
  jobId: string;
  jobPayload: Record<string, unknown> | null;
  manifestPayload: Record<string, unknown> | null;
  /** 馆藏只读等无 job 时直接用已解析 URL */
  sourceUrl: string;
  translatedUrl: string;
  sourceOnly: boolean;
};

export type ReaderSessionState = {
  jobId: string;
  jobStatus: string;
  workflow: string;
  jobTerminal: boolean;
  documentId: string;
  /** route 身份：job/document 组合，用于跨 session 重置 AI 运行时等 */
  sessionIdentity: string;
  sourceOnly: boolean;
  mode: ReaderMode;
  setMode: (mode: ReaderMode) => void;
  sourceUrl: string;
  translatedUrl: string;
  /** 预下载完成的 PDF 字节；展示前已就绪 */
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  /** 下载完成、可以挂载 Document */
  assetsReady: boolean;
  boot: {
    loading: boolean;
    percent: number;
    text: string;
    stage: string;
    failed: boolean;
  };
  // display title; react chrome currently does not render it
  title: string;
  regions: ReaderRegion[];
  /** 块和页尺寸到了（或者失败、这次不要）：它们不挡着露页面，晚一点才有。 */
  regionsSettled: boolean;
  readerMetadata: ReaderMetadata;
  /** 可选产物失败的真实错误；非致命提示的唯一真源。 */
  readerErrors: ReaderOptionalArtifactErrors;
  download: ReaderDownloadContext;
  /** Agent 提交新文档版本后，切换到文档当前源文件并重新下载。 */
  refreshCommittedDocument: (input: {
    documentId: string;
    revision: string;
  }) => void;
  /** 流水线进入终态后重新读取权威 job 与最终产物。 */
  refreshJobArtifacts: () => void;
  /** 轻量刷新任务状态；终态成功时会自动触发一次最终产物刷新。 */
  refreshJobStatus: () => Promise<void>;
  /** 关闭导航前建立取消栅栏，禁止迟到请求再写入 Reader UI。 */
  prepareClose: () => void;
};

export type CommittedDocumentSource = {
  documentId: string;
  revision: string;
  sessionIdentity: string;
};

export type ResolvedJobDocument = {
  jobId: string;
  documentId: string;
};

export type { ReaderOptionalArtifactErrors, LinkedDocumentRecord };


export type BootState = ReaderSessionState["boot"];
