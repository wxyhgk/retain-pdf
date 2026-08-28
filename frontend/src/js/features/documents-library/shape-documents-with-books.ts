// Điều phối duy nhất cho "một lô documents -> một lô item thẻ lưới" (refactor 2).
//
// Trước đây luồng "thu thập document có active_job_id -> lấy hàng loạt trạng thái sống
// từ library/books -> tạo bookMap -> shapeDocumentCardItem từng document" bị copy ở hai nơi:
// lưới thư viện chính (document-library-source.js) và phần mở rộng collection (collections/controller.js).
// Hai bản copy lệch nhau là gốc của bug "collection rỗng": bản collection là bản cũ trước F2
// document-centric, tự filter mất document chỉ có trong thư viện. Gom về hàm này để mọi UI
// "liệt kê một lô document thành thẻ" (thư viện/collection/tìm kiếm/entry tương lai) đều đi qua
// cùng một đường và không lệch nhau nữa.
//
// Chỉ chịu trách nhiệm map documents -> cards (giữ thứ tự, không dedupe/không phân trang/
// không lọc tìm kiếm; các phần đó thuộc về từng consumer và ở lại call-site).

import { shapeDocumentCardItem } from "./document-card-item.js";

function normalizedJobId(value) {
  return `${value || ""}`.trim();
}

// documents: mảng document trả về từ /documents.
// fetchLibraryBookList: port (apiPrefix, { jobIds, limit }: any) => { items } (có thể bỏ qua).
// Trả về: mảng item thẻ cùng độ dài và cùng thứ tự với documents (document đã dịch được chồng trạng thái sống từ book,
// document chỉ có trong thư viện dùng job_id tổng hợp).
export async function shapeDocumentsWithBooks(documents, { fetchLibraryBookList, apiPrefix }: any = {}) {
  const docs = Array.isArray(documents) ? documents : [];
  const jobIds = docs.map((doc) => normalizedJobId(doc?.active_job_id)).filter(Boolean);

  const bookMap = new Map();
  if (jobIds.length && typeof fetchLibraryBookList === "function") {
    const payload = await fetchLibraryBookList(apiPrefix, { jobIds, limit: jobIds.length });
    for (const book of (Array.isArray(payload?.items) ? payload.items : [])) {
      const id = normalizedJobId(book?.job_id);
      if (id) {
        bookMap.set(id, book);
      }
    }
  }

  return docs.map((doc) => {
    const activeJobId = normalizedJobId(doc?.active_job_id);
    return shapeDocumentCardItem(doc, activeJobId ? bookMap.get(activeJobId) || null : null);
  });
}
