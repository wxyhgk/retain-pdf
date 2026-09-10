// 共享真值（原 frontend/web/src/js/reader/page-config.ts），已抽离为纯函数 + 可注入依赖
// 不直接 import frontend/web 的 config/mock，改为参数注入，默认用 window/globalThis

function defaultSearch(): string {
  return globalThis.window?.location?.search || "";
}

function defaultIsMockMode(): boolean {
  return false;
}

function defaultGetMockJobId(): string {
  return "";
}

function defaultReaderMessageTargetOrigin(): string {
  return "*";
}

export function resolveReaderJobId({
  search = defaultSearch(),
  isMock = defaultIsMockMode,
  mockJobId = defaultGetMockJobId,
}: {
  search?: string;
  isMock?: () => boolean;
  mockJobId?: () => string;
} = {}): string {
  const jobId = new URLSearchParams(search).get("job_id")?.trim() || "";
  if (jobId) return jobId;
  const documentId = new URLSearchParams(search).get("document_id")?.trim() || "";
  if (documentId) return "";
  return isMock() ? mockJobId() : "";
}

export function resolveReaderDocumentId({ search = defaultSearch() }: { search?: string } = {}): string {
  return new URLSearchParams(search).get("document_id")?.trim() || "";
}

export function resolveReaderAnchor({ search = defaultSearch() }: { search?: string } = {}): { pageIdx: number | null; blockId: string } | null {
  const params = new URLSearchParams(search);
  const rawPageIdx = `${params.get("page_idx") ?? ""}`.trim();
  const blockId = `${params.get("block_id") || ""}`.trim();
  const pageIdx = rawPageIdx === "" ? NaN : Number(rawPageIdx);
  if (!Number.isFinite(pageIdx) && !blockId) return null;
  return { pageIdx: Number.isFinite(pageIdx) ? pageIdx : null, blockId };
}

export function createReaderPageConfigPort({
  messageTargetOrigin = defaultReaderMessageTargetOrigin,
  isMock = defaultIsMockMode,
  mockJobId = defaultGetMockJobId,
  search = defaultSearch,
}: {
  messageTargetOrigin?: () => string;
  isMock?: () => boolean;
  mockJobId?: () => string;
  search?: () => string;
} = {}) {
  function readerJobId(): string {
    return resolveReaderJobId({ search: search(), isMock, mockJobId });
  }
  return Object.freeze({ messageTargetOrigin, readerJobId });
}

export const defaultReaderPageConfigPort = createReaderPageConfigPort();
