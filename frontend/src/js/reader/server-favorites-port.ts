import { API_PREFIX } from "../config/api-constants.js";
import { fetchDocumentByJobId } from "../api/documents.js";
import { createFavorite, deleteFavorite, fetchFavorites } from "../api/favorites.js";
import type {
  CreateServerFavoritesPortOptions,
  FavoriteItem,
  SelectionQuote,
  ServerFavorite,
  ServerFavoriteRaw,
} from "./types.js";

// Yêu thích server → ghi lại view trình đọc: chuyển snake_case sang camelCase,
// page_idx và pageIdx của jumpToReaderAnchor đều là 0-based.
// Dữ liệu bẩn thiếu favorite_id hoặc quote_text sẽ bị loại bỏ trực tiếp (trả về null).
export function normalizeServerFavorite(raw: ServerFavoriteRaw = {}): ServerFavorite | null {
  const favoriteId = `${raw?.favorite_id || ""}`.trim();
  const quoteText = `${raw?.quote_text || ""}`.trim();
  if (!favoriteId || !quoteText) {
    return null;
  }
  const pageIdx = Number(raw.page_idx);
  return {
    favoriteId,
    documentId: `${raw.document_id || ""}`.trim(),
    jobId: `${raw.job_id || ""}`.trim(),
    pageIdx: Number.isFinite(pageIdx) && pageIdx >= 0 ? pageIdx : 0,
    blockId: `${raw.block_id || ""}`.trim(),
    kind: `${raw.kind || ""}`.trim() || "sentence",
    quoteText,
    translatedQuoteText: `${raw.translated_quote_text || ""}`.trim(),
    note: `${raw.note || ""}`.trim(),
    createdAt: `${raw.created_at || ""}`.trim(),
  };
}

// Sau khi đồng bộ ghi chép cục bộ thành công sẽ mang serverFavoriteId; khu vực Yêu thích đám mây không hiển thị trùng lặp các Yêu thích này.
export function dedupeServerFavorites(
  serverFavorites: ServerFavorite[] = [],
  localItems: FavoriteItem[] = [],
): ServerFavorite[] {
  const syncedIds = new Set(
    (Array.isArray(localItems) ? localItems : [])
      .map((item) => `${item?.serverFavoriteId || ""}`.trim())
      .filter(Boolean),
  );
  return (Array.isArray(serverFavorites) ? serverFavorites : [])
    .filter((favorite) => favorite?.favoriteId && !syncedIds.has(favorite.favoriteId));
}

// Đồng bộ Yêu thích trình đọc lên backend favorites.
// document_id được backend tra cứu trực tiếp qua GET /documents?job_id= (bao gồm lịch sử run), frontend không quét danh sách ngược lại.
// Tất cả cuộc gọi server sẽ cố gắng hết sức: thất bại chỉ ghi log, chức năng cục bộ của trình đọc không bị ảnh hưởng.
export function createReaderServerFavoritesPort({
  jobId = "",
  apiPrefix = API_PREFIX,
  documentByJobId = fetchDocumentByJobId,
  submitFavorite = createFavorite,
  loadFavorites = fetchFavorites,
  removeFavorite = deleteFavorite,
}: CreateServerFavoritesPortOptions = {}) {
  let documentIdPromise: Promise<string> | null = null;

  function resolveDocumentId() {
    if (!documentIdPromise) {
      documentIdPromise = (async () => {
        try {
          const document = await documentByJobId(apiPrefix, jobId);
          return `${document?.document_id || ""}`.trim();
        } catch (_err) {
          return "";
        }
      })();
    }
    return documentIdPromise;
  }

  async function syncFavorite(quote: SelectionQuote = {}) {
    const blockId = `${quote.blockId || ""}`.trim();
    const quoteText = `${quote.quoteText || ""}`.trim();
    if (!blockId || !quoteText) {
      return null;
    }
    try {
      // Đường dẫn ghi chỉ cung cấp job_id, backend phân giải tài liệu thuộc về (lịch sử run cũng có thể yêu thích)
      const favorite = await submitFavorite(apiPrefix, {
        job_id: jobId,
        page_idx: Number(quote.pageIdx) || 0,
        block_id: blockId,
        quote_text: quoteText,
        translated_quote_text: `${quote.translatedQuoteText || ""}`,
        kind: "sentence",
      });
      console.info("Yêu thích đã đồng bộ lên server", favorite?.favorite_id || "");
      return favorite;
    } catch (error) {
      console.error("Đồng bộ Yêu thích lên server thất bại", error);
      return null;
    }
  }

// Lấy yêu thích server của tài liệu hiện tại và chuẩn hóa; khi offline/không phân giải được tài liệu, im lặng trả về rỗng.
// Chế độ mock không ngắn mạch: lớp api tự mang nhánh mock, baseline và e2e phụ thuộc mock toàn bộ quy trình có thể sử dụng.
  async function loadServerFavorites(): Promise<ServerFavorite[]> {
    const documentId = await resolveDocumentId();
    if (!documentId) {
      return [];
    }
    try {
      const { favorites = [] } = await loadFavorites(apiPrefix, { documentId });
      return (Array.isArray(favorites) ? favorites : [])
        .map(normalizeServerFavorite)
        .filter(Boolean);
    } catch (error) {
      console.warn("Đọc Yêu thích server thất bại", error);
      return [];
    }
  }

  // Xóa Yêu thích server, thành công trả về true; thất bại chỉ ghi log và trả về false (không chặn quy trình cục bộ).
  async function removeServerFavorite(favoriteId: string) {
    const normalized = `${favoriteId || ""}`.trim();
    if (!normalized) {
      return false;
    }
    try {
      await removeFavorite(apiPrefix, normalized);
      return true;
    } catch (error) {
      console.error("Xóa Yêu thích server thất bại", error);
      return false;
    }
  }

// Quy chuẩn không có PATCH Yêu thích: sửa ghi chú = tái tạo cùng neo + xóa cũ. Tạo trước xóa sau, thất bại không mất dữ liệu.
// Đường dẫn ghi chỉ cung cấp job_id, backend phân giải tài liệu thuộc về.
  async function recreateFavoriteNote(annotation: Partial<ServerFavorite> = {}, note = "") {
    if (!annotation?.favoriteId) {
      return null;
    }
    try {
      const created = await submitFavorite(apiPrefix, {
        job_id: `${annotation.jobId || jobId || ""}`.trim() || undefined,
        page_idx: Number(annotation.pageIdx) || 0,
        block_id: `${annotation.blockId || ""}`.trim(),
        quote_text: `${annotation.quoteText || ""}`,
        translated_quote_text: `${annotation.translatedQuoteText || ""}`,
        kind: `${annotation.kind || "sentence"}`,
        note: `${note || ""}`,
      });
      await removeServerFavorite(annotation.favoriteId);
      return normalizeServerFavorite(created);
    } catch (error) {
      console.error("Cập nhật ghi chú chú thích thất bại", error);
      return null;
    }
  }

  return Object.freeze({
    loadServerFavorites,
    recreateFavoriteNote,
    removeServerFavorite,
    resolveDocumentId,
    syncFavorite,
  });
}
