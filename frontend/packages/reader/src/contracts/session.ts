import type { ReaderMetadata, ReaderRegion } from "../shared/data/reader-regions.js";

export type ReaderOptionalArtifactErrors = {
  regions: unknown;
  metadata: unknown;
};

export type LinkedDocumentRecord = {
  document_id?: string;
  active_job_id?: string | null;
  active_version_id?: string | null;
};

export type ReaderPayload = {
  jobPayload: unknown;
  manifestPayload: unknown;
  readerMetadata: ReaderMetadata | null;
  regionsPayload: unknown;
  readerErrors: ReaderOptionalArtifactErrors;
};

/** 可选产物（regions / metadata）：失败降级为 fallback 值，错误记在 readerErrors。 */
export type ReaderOptionalArtifactsPayload = Pick<ReaderPayload, "readerMetadata" | "regionsPayload" | "readerErrors">;

export type ReaderSessionLoadPlan =
  | { kind: "restore-committed-source"; documentId: string; revision: string }
  | { kind: "open-job-artifacts" };

export type ReaderSessionSnapshot = {
  loadPlan: ReaderSessionLoadPlan;
  jobId: string;
  documentId: string;
  jobStatus: string;
  workflow: string;
  title: string;
  sourceUrl: string;
  translatedUrl: string;
  sourceOnly: boolean;
  sourcePayload: unknown;
  manifestPayload: unknown;
  regions: ReaderRegion[];
  readerMetadata: ReaderMetadata;
  readerErrors: ReaderOptionalArtifactErrors;
  /** 宿主已按 job 查过的文档链接（GET /documents?job_id=）。
   *
   * undefined = 宿主没查（session 自己查）；null = 查过、没有/失败。带回来是为了
   * 不让 session 再串行查一遍 —— 原来同一个请求发两次，且都排在 regions 后面。 */
  linkedDocument?: LinkedDocumentRecord | null;
};

export type ReaderSessionSnapshotInput = {
  jobId: string;
  documentId: string;
  routeDocumentId: string;
  committedSource?: { documentId: string; revision: string } | null;
  includeOptionalArtifacts?: boolean;
};

export type ReaderSessionDataPort = {
  loadReaderPayload: (
    jobId: string,
    options?: { includeOptionalArtifacts?: boolean },
  ) => Promise<ReaderPayload>;
  loadSessionSnapshot?: (
    input: ReaderSessionSnapshotInput,
  ) => Promise<ReaderSessionSnapshot>;
  /** 单独加载可选产物（regions / metadata），永不 reject。
   *
   * 提供它时 session 会让 snapshot 只取 job / manifest（includeOptionalArtifacts:
   * false），可选产物并行另取 —— PDF 地址只依赖前者，下载不必等 regions（可达数百 KB）。
   * 不提供时照旧由 snapshot / loadReaderPayload 一并加载。 */
  loadReaderOptionalArtifacts?: (jobId: string) => Promise<ReaderOptionalArtifactsPayload>;
  loadJobPayload: (jobId: string) => Promise<unknown>;
  fetchDocumentByJobId: (apiPrefix: string, jobId: string) => Promise<LinkedDocumentRecord | null>;
  /** 按书编号读这本书（GET /documents/:document_id），用来看它有没有 active_job_id。
   * 宿主不提供时当作没有，按纯原文打开。 */
  fetchDocument?: (documentId: string) => Promise<LinkedDocumentRecord | null>;
  /** 这本书的修订按阅读页块编号分组（GET /jobs/:job_id/data/revisions?group_by=reader_item_id），
   * 返回 {groups: [{value, count}]}。宿主不提供时译文栏不画「改过」标记。 */
  fetchRevisionGroups?: (jobId: string) => Promise<unknown>;
  fetchProtected: typeof fetch;
  resolveResourceUrl: (url: string) => string;
  resolveReaderSourcePdf: (manifestPayload: unknown) => unknown;
  resolveReaderTranslatedPdfUrl: (jobPayload: unknown, manifestPayload: unknown) => string;
  resolveReaderArtifactUrl: (item: unknown) => string;
};
