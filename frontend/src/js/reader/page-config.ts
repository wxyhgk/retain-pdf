import {
  isMockMode,
  readerMessageTargetOrigin,
} from "../config/runtime.js";
import { getMockJobId } from "../mock/index.js";

function defaultSearch() {
  return globalThis.window?.location?.search || "";
}

export function resolveReaderJobId({
  search = defaultSearch(),
  isMock = isMockMode,
  mockJobId = getMockJobId,
} = {}) {
  const jobId = new URLSearchParams(search).get("job_id")?.trim() || "";
  if (jobId) {
    return jobId;
  }
// ?document_id= là điểm truy cập "đọc văn bản gốc" của tài liệu lưu trữ (F4): lúc này không có job, không nên quay lại mock job,
// nếu không trình đọc tài liệu gốc sẽ bị gắn nhầm nhiệm vụ mock.
  const documentId = new URLSearchParams(search).get("document_id")?.trim() || "";
  if (documentId) {
    return "";
  }
  return isMock() ? mockJobId() : "";
}

// Tài liệu thư viện "đọc văn bản gốc" (F4): khi không có job, chỉ có document_id, trình đọc đi theo nhánh tài liệu nguồn chỉ đọc.
export function resolveReaderDocumentId({ search = defaultSearch() } = {}) {
  return new URLSearchParams(search).get("document_id")?.trim() || "";
}

// Neo (page_idx, block_id) từ URL truyền qua khi nhảy lại từ kết quả tìm kiếm/yêu thích
export function resolveReaderAnchor({ search = defaultSearch() } = {}) {
  const params = new URLSearchParams(search);
  const rawPageIdx = `${params.get("page_idx") ?? ""}`.trim();
  const blockId = `${params.get("block_id") || ""}`.trim();
  const pageIdx = rawPageIdx === "" ? NaN : Number(rawPageIdx);
  if (!Number.isFinite(pageIdx) && !blockId) {
    return null;
  }
  return {
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId,
  };
}

export function createReaderPageConfigPort({
  messageTargetOrigin = readerMessageTargetOrigin,
  isMock = isMockMode,
  mockJobId = getMockJobId,
  search = defaultSearch,
} = {}) {
  function readerJobId() {
    return resolveReaderJobId({
      search: search(),
      isMock,
      mockJobId,
    });
  }

  return Object.freeze({
    messageTargetOrigin,
    readerJobId,
  });
}

export const defaultReaderPageConfigPort = createReaderPageConfigPort();
