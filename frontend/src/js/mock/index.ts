import { MOCK_JOB_ID } from "./constants.js";
import { buildMockManifest } from "./artifacts.js";
import { buildMockEvents } from "./events.js";
import { buildMockJobPayload } from "./job.js";
import { currentMockScenario } from "./scenario.js";
import {
  buildLiveMockJobEvents,
  buildLiveMockJobPayload,
  isLiveMockJobId,
  registerLiveMockJob,
} from "./live-jobs.js";
import { getMockDocumentByJobId } from "./documents.js";
import type { JobLike } from "../job/types.js";
import type { LibraryCardItem } from "../../pages/home/features/library/types.js";
export { getMockJobMarkdown } from "./markdown.js";
export { fetchMockProtected } from "./responses.js";
export {
  registerLiveMockJob,
  resetLiveMockJobs,
  isLiveMockJobId,
  isLiveMockJobActive,
} from "./live-jobs.js";

export function isMockScenarioEnabled() {
  return !!currentMockScenario();
}

export function getMockScenario() {
  return currentMockScenario();
}

export function getMockJobId() {
  return MOCK_JOB_ID;
}

function enrichJobWithDocument(job: JobLike | LibraryCardItem, jobId: string) {
  const doc = getMockDocumentByJobId(jobId);
  if (!doc) {
    return job;
  }
  return {
    ...job,
    document_id: doc.document_id || (job as LibraryCardItem).document_id,
    title: doc.title || (job as LibraryCardItem).title,
    display_name: doc.title || (job as LibraryCardItem).display_name,
    source_file_name: doc.source_filename || (job as LibraryCardItem).source_file_name,
    page_count: doc.page_count ?? (job as LibraryCardItem).page_count,
    cover_url: doc.cover_url || (job as LibraryCardItem).cover_url,
    thumbnail_url: doc.thumbnail_url || (job as LibraryCardItem).thumbnail_url,
  };
}

export function getMockJobPayload(jobId = ""): JobLike {
  const id = `${jobId || ""}`.trim();
  // Live job được tạo từ việc gửi dịch: tiến triển theo đồng hồ (hiển thị hoạt ảnh tiến độ trong Tab chi tiết)
  const live = buildLiveMockJobPayload(id);
  if (live) {
    return enrichJobWithDocument(live, id) as JobLike;
  }
  // Job mock chính: theo kịch bản URL ?mock=
  if (!id || id === MOCK_JOB_ID) {
    return enrichJobWithDocument(buildMockJobPayload(), id || MOCK_JOB_ID) as JobLike;
  }
  // active_job_id được tổng hợp từ trung tâm tài liệu (ví dụ 20260520-att-001): trả về payload trạng thái cuối,
  // cho phép StatusCard nhúng trong chi tiết sách có thể lấy dữ liệu cùng hình dạng với job thành công thật (luồng giai đoạn/sản phẩm sẵn sàng).
  const book = synthesizeMockBook(id);
  return {
    ...buildMockJobPayload("done"),
    ...book,
    job_id: id,
    status: "succeeded",
    stage: "finished",
    stage_detail: book.stage_detail || "Nhiệm vụ đã hoàn thành",
  } as JobLike;
}

export function getMockJobEvents(jobId = "") {
  const id = `${jobId || ""}`.trim();
  if (isLiveMockJobId(id)) {
    return buildLiveMockJobEvents(id);
  }
  return buildMockEvents();
}

export function getMockJobArtifactsManifest() {
  return buildMockManifest();
}

// Lưới trung tâm tài liệu (F2) sẽ dùng library/books?job_ids= để lấy trạng thái động của "tài liệu mock đã dịch".
// Ưu tiên lấy tên sách/bìa từ bảng tài liệu mock, không dùng job_id.pdf làm tiêu đề (một trong những nguyên nhân bìa trống).
function synthesizeMockBook(jobId: string): LibraryCardItem {
  const doc = getMockDocumentByJobId(jobId);
  const title = doc?.title || doc?.source_filename || "Tài liệu đã dịch";
  return {
    id: jobId,
    job_id: jobId,
    document_id: doc?.document_id,
    title,
    display_name: title,
    source_file_name: doc?.source_filename || "",
    page_count: doc?.page_count ?? 12,
    cover_url: doc?.cover_url,
    thumbnail_url: doc?.thumbnail_url,
    status: "succeeded",
    stage: "finished",
    stage_detail: "Nhiệm vụ đã hoàn thành",
    progress: { current: 12, total: 12, percent: 100, unit: "none" },
    output_pdf_ready: true,
    markdown_ready: true,
    bundle_ready: true,
    created_at: doc?.added_at || "2026-06-01T10:00:00Z",
    updated_at: doc?.updated_at || "2026-06-01T12:00:00Z",
  };
}

export interface MockJobListQuery {
  jobIds?: Array<string | null | undefined>;
}

export interface MockJobListResult {
  items: Array<JobLike | LibraryCardItem>;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function getMockJobList({ jobIds = [] }: MockJobListQuery = {}): MockJobListResult {
  if (Array.isArray(jobIds) && jobIds.length) {
    const wanted = jobIds.map((id) => `${id}`.trim()).filter(Boolean);
    const items = wanted.map((id) => {
      if (id === MOCK_JOB_ID) {
        return enrichJobWithDocument(buildMockJobPayload(), id);
      }
      const live = buildLiveMockJobPayload(id);
      if (live) {
        return enrichJobWithDocument(live, id);
      }
      return synthesizeMockBook(id);
    });
    return { items, limit: 20, offset: 0, has_more: false };
  }
  return {
    items: [enrichJobWithDocument(buildMockJobPayload(), MOCK_JOB_ID)],
    limit: 20,
    offset: 0,
    has_more: false,
  };
}

export function submitMockJob(): JobLike {
  // Luồng tải lên "Bắt đầu dịch" cũng chạy live job, mới có thể thấy hoạt ảnh tiến độ trong khu vực trạng thái
  const live = registerLiveMockJob({
    title: "Mock Tải lên dịch",
    pageCount: 12,
  });
  return buildLiveMockJobPayload(live.jobId) || buildMockJobPayload();
}

export function submitMockUpload() {
  return {
    upload_id: "mock-upload-id",
    filename: "mock.pdf",
    page_count: 12,
    bytes: 2_621_440,
  };
}
