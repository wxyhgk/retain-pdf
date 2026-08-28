// Nguồn dữ liệu phân trang cho lưới document-centric (kế hoạch F2). Shape trả về khớp với
// recent-jobs/pagination.js#collectRecentJobsPage
// ({ collected, hasMore, latestInvocationSummary, nextOffset }) để engine
// loader.js/commit.js/store của recent-jobs dùng được mà không cần sửa.
//
// Mỗi document tạo một thẻ: lấy một trang /documents, gom active_job_id của trang đó,
// gọi hàng loạt library/books?job_ids= để lấy trạng thái sống của các job, rồi merge theo job_id
// (shapeDocumentCardItem). Document chỉ có trong thư viện (không có active_job_id) dùng job_id
// tổng hợp để đi qua engine.
//
// Tìm kiếm: /documents hiện chưa có tìm kiếm văn bản phía server (chỉ filter reading_status/tag/collection),
// nên query ở đây dùng **lọc tiêu đề/tên file phía client**; khi có query, kéo một batch lớn hơn rồi lọc,
// và tắt phân trang tiếp. Tìm kiếm full-text/tiêu đề ở cấp document là phần backend còn cần bổ sung
// (xem memory f2-document-centric-grid-design).

import { shapeDocumentsWithBooks } from "./shape-documents-with-books.js";

const SEARCH_FETCH_LIMIT = 200;

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

export async function collectDocumentLibraryPage({
  fetchDocumentList,
  fetchLibraryBookList,
  apiPrefix,
  startOffset = 0,
  pageSize,
  existingJobIds = new Set(),
  query = "",
}: any) {
  const trimmedQuery = `${query || ""}`.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const seen = existingJobIds instanceof Set
    ? new Set(existingJobIds)
    : new Set((Array.isArray(existingJobIds) ? existingJobIds : []).map(normalizedJobId).filter(Boolean));

  const limit = searching ? Math.max(pageSize, SEARCH_FETCH_LIMIT) : pageSize;
  const offset = searching ? 0 : startOffset;

  const payload = await fetchDocumentList(apiPrefix, { limit, offset });
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];
  const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : documents.length;

  // Mapping document -> thẻ đi qua điều phối chung (shapeDocumentsWithBooks); dedupe/lọc tìm kiếm
  // là trách nhiệm riêng của nguồn dữ liệu phân trang và ở lại bên dưới.
  const shaped = await shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix });

  const collected = [];
  for (const item of shaped) {
    const key = normalizedJobId(item.job_id);
    if (!key || seen.has(key)) {
      continue;
    }
    if (searching) {
      const haystack = `${item.title || ""} ${item.display_name || ""} ${item.source_file_name || ""}`.toLowerCase();
      if (!haystack.includes(trimmedQuery)) {
        continue;
      }
    }
    seen.add(key);
    collected.push(item);
  }

  const hasMore = searching
    ? false
    : documents.length > 0 && offset + documents.length < total;
  const nextOffset = searching ? startOffset : startOffset + pageSize;

  return {
    collected,
    hasMore,
    latestInvocationSummary: null,
    nextOffset,
  };
}
