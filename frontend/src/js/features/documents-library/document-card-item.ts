// Shape item thẻ của lưới document-centric (F2 trong kế hoạch wondrous-baking-donut.md).
//
// Điểm thiết kế (xem memory f2-document-centric-grid-design): lưới thư viện chuyển sang
// "mỗi document một thẻ", nhưng bên dưới vẫn tái sử dụng nguyên engine store/dedupe/polling
// theo job_id của features/recent-jobs. Vì vậy:
// - Document đã dịch (active_job_id khác rỗng): thẻ mang job_id thật và merge trạng thái sống
//   status/stage/progress/cover từ library/books -> cơ chế polling/progress/cover hiện có tiếp quản nguyên vẹn.
// - Document chỉ có trong thư viện (active_job_id null/rỗng): cấp một **job_id namespace tổng hợp**
//   `doc:<document_id>` để đi qua nguyên dedupeRecentJobs / store theo job_id, không bị logic
//   "job_id rỗng thì bỏ luôn" lọc mất; thẻ dựa vào boolean library_only để phân nhánh trạng thái thư viện
//   (tắt đọc đối chiếu, hiển thị "chưa dịch", đi qua dịch/đọc bản gốc), không parse id tổng hợp này.

import { flattenStageSnapshot } from "../../job/stage-snapshot-flatten.js";

export const LIBRARY_ONLY_JOB_PREFIX = "doc:";

export function syntheticLibraryJobId(documentId) {
  const normalized = `${documentId || ""}`.trim();
  return normalized ? `${LIBRARY_ONLY_JOB_PREFIX}${normalized}` : "";
}

export function isLibraryOnlyItem(item: any = {}) {
  return item?.library_only === true;
}

function firstUrl(...candidates) {
  for (const candidate of candidates) {
    const url = `${candidate || ""}`.trim();
    if (url) {
      return url;
    }
  }
  return "";
}

/** Nếu tiêu đề book là job_id / job_id.pdf / Mock..., dùng tên thật của document. */
function pickCardTitle(bookTitle, document, jobId) {
  const book = `${bookTitle || ""}`.trim();
  const docTitle = `${document?.title || document?.source_filename || ""}`.trim();
  const id = `${jobId || ""}`.trim();
  const bookIsPlaceholder = !book
    || (id && (book === id || book === `${id}.pdf`))
    || /^Mock(\s|retry|-|_)/i.test(book)
    || /^mock-/i.test(book);
  if (bookIsPlaceholder && docTitle) {
    return docTitle;
  }
  return book || docTitle || id || "";
}

// document + projection library/books tùy chọn -> một item thẻ lưới.
// Khi book hit (đã dịch), ưu tiên các field trạng thái sống của book và chồng thêm danh tính document
// (document_id, reading_status, tags, source_pdf_url); khi thiếu book, dựng thẻ thư viện từ field document.
export function shapeDocumentCardItem(document: any = {}, book = null) {
  const documentId = `${document.document_id || ""}`.trim();
  const activeJobId = `${document.active_job_id || ""}`.trim();
  const sharedDocFields = {
    document_id: documentId,
    reading_status: document.reading_status || "",
    tags: Array.isArray(document.tags) ? document.tags : [],
    source_pdf_url: document.source_pdf_url || "",
    bytes: document.bytes,
    added_at: document.added_at || "",
    last_opened_at: document.last_opened_at || null,
  };

  if (activeJobId && book && typeof book === "object") {
    // Đã dịch: ưu tiên trạng thái sống từ library/books (khớp giao diện lưới hiện tại), bổ sung danh tính document
    // và fallback cover (book tổng hợp có thể không có cover_url, fallback về cover cấp document).
    const flattened = flattenStageSnapshot(book);
    const jobId = `${flattened.job_id || book.job_id || activeJobId}`.trim();
    return {
      ...flattened,
      ...sharedDocFields,
      job_id: jobId,
      active_job_id: activeJobId,
      library_only: false,
      // Cover/số trang: ưu tiên trạng thái sống của book, fallback cấp document (khớp giao diện lưới hiện tại).
      // Tiêu đề: không cho book dùng job_id.pdf ghi đè tên sách thật.
      cover_url: firstUrl(flattened.cover_url, book.cover_url, document.cover_url),
      thumbnail_url: firstUrl(flattened.thumbnail_url, book.thumbnail_url, document.thumbnail_url),
      page_count: document.page_count || flattened.page_count || 0,
      updated_at: flattened.updated_at || document.updated_at || "",
      title: pickCardTitle(flattened.title || book.title, document, jobId),
      display_name: pickCardTitle(
        flattened.display_name || flattened.title || book.display_name || book.title,
        document,
        jobId,
      ),
    };
  }

  if (activeJobId) {
    // Có active_job_id nhưng library/books chưa có projection (edge case hiếm: job vừa tạo/bị dọn).
    // Giữ job_id thật để polling/đọc đối chiếu vẫn dùng được, nhưng chưa có trạng thái thành phẩm nên xử lý như chưa hoàn tất (reader bị tắt).
    return {
      ...sharedDocFields,
      job_id: activeJobId,
      active_job_id: activeJobId,
      library_only: false,
      status: "",
      title: document.title || document.source_filename || "",
      display_name: document.title || document.source_filename || "",
      source_file_name: document.source_filename || "",
      page_count: document.page_count || 0,
      cover_url: firstUrl(document.cover_url),
      thumbnail_url: firstUrl(document.thumbnail_url),
      updated_at: document.updated_at || "",
    };
  }

  // Trạng thái thư viện (chưa dịch): job_id tổng hợp giúp đi qua engine key theo job_id; library_only đánh dấu nhánh.
  return {
    ...sharedDocFields,
    job_id: syntheticLibraryJobId(documentId),
    active_job_id: "",
    library_only: true,
    status: "",
    title: document.title || document.source_filename || "",
    display_name: document.title || document.source_filename || "",
    source_file_name: document.source_filename || "",
    page_count: document.page_count || 0,
    cover_url: firstUrl(document.cover_url),
    thumbnail_url: firstUrl(document.thumbnail_url),
    updated_at: document.updated_at || "",
  };
}
