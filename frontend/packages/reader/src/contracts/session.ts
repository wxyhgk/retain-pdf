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
  /** 在阅读页里改译文（侧栏「改译文」）。宿主不提供时没有「改」按钮和这个面板。 */
  translationEdit?: ReaderTranslationEditPort | null;
  fetchProtected: typeof fetch;
  resolveResourceUrl: (url: string) => string;
  resolveReaderSourcePdf: (manifestPayload: unknown) => unknown;
  resolveReaderTranslatedPdfUrl: (jobPayload: unknown, manifestPayload: unknown) => string;
  resolveReaderArtifactUrl: (item: unknown) => string;
};

/** 改一段译文时要用的后端能力。错误照抛：Error 带 status、reason（后端的 details.reason）、issues（校验没过的每一条）。 */
export type ReaderTranslationEditPort = {
  /** 真正持有译文的任务：重新排版出来的任务没有自己的译文，改要改到来源任务上。 */
  resolveOwnerJobId: (jobId: string) => Promise<string>;
  /** GET /jobs/:id/translations/:item_id（认阅读页块号），返回 {item_id: 条目里实际存的写法, item: {...}}。 */
  loadItem: (jobId: string, itemId: string) => Promise<{ item_id?: string; item?: Record<string, unknown> } | null>;
  /** PATCH /jobs/:id/translations/:item_id。 */
  revise: (jobId: string, itemId: string, body: ReaderTranslationRevisionBody) => Promise<{ generation?: number; changed?: boolean } | null>;
  /** 修订记录（data/revisions）：给了阅读页块号只要这一块的，按时间从旧到新；不给就是全书最近的，从新到旧。 */
  fetchRevisions: (jobId: string, readerItemId?: string) => Promise<unknown>;
  /** 原地重新排版（retry-stage render，create_new_job=false）。 */
  rerender: (jobId: string) => Promise<unknown>;
};

export type ReaderTranslationRevisionBody = {
  translated_text: string;
  source: "user";
  reason?: string;
  expected_generation?: number;
};
