// Tab "Yêu thích" trang chính: danh sách trích dẫn/ghi chú xuyên sách.
//
// Phân biệt với "Bộ sưu tập": bộ sưu tập = nhóm tài liệu; yêu thích = câu/hình ảnh/ghi chú
// được đánh dấu trong trình đọc. Phiên bản đầu: kéo toàn bộ favorites → trạng thái rỗng/danh
// sách; bấm một mục mở trình đọc kèm neo.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  API_PREFIX,
  APP_EVENTS,
  fetchFavorites,
} from "../../../composition/external.js";
import { useHomeServices } from "../../../home-services-context.js";
import { EmptyState } from "../../../../../shared/icons/EmptyState.jsx";

type FavoriteItem = {
  favorite_id?: string;
  document_id?: string;
  job_id?: string;
  page_idx?: number;
  block_id?: string;
  kind?: string;
  quote_text?: string;
  translated_quote_text?: string;
  note?: string;
  created_at?: string;
};

function kindLabel(kind: string) {
  const k = `${kind || ""}`.trim();
  if (k === "figure") return "Hình ảnh";
  if (k === "data") return "Dữ liệu";
  if (k === "sentence") return "Trích dẫn";
  return k || "Trích dẫn";
}

function formatPage(pageIdx: unknown) {
  const n = Number(pageIdx);
  if (!Number.isFinite(n) || n < 0) return "";
  return `Trang ${n + 1}`;
}

function openFavoriteInReader(item: FavoriteItem): boolean {
  const jobId = `${item.job_id || ""}`.trim();
  const documentId = `${item.document_id || ""}`.trim();
  if (!jobId && !documentId) {
    return false;
  }

  const pageIdx = Number(item.page_idx);
  const detail = {
    jobId: jobId || undefined,
    documentId: jobId ? undefined : documentId || undefined,
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId: `${item.block_id || ""}`.trim(),
  };

  if (typeof document?.dispatchEvent === "function" && typeof CustomEvent === "function") {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openReaderRequested, { detail }));
    return true;
  }
  return false;
}

export function FavoritesView() {
  const services = useHomeServices();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchFavorites(API_PREFIX)
      .then((payload: { favorites?: FavoriteItem[] } = {}) => {
        const list = Array.isArray(payload?.favorites) ? payload.favorites : [];
        setItems(list);
      })
      .catch((err: { message?: string }) => {
        setError(err?.message || "Đọc mục yêu thích thất bại, vui lòng thử lại.");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section id="favorites-view" className="library-view favorites-view" aria-label="Yêu thích">
      <div className="favorites-head">
        <h2 className="favorites-title">Yêu thích của tôi</h2>
        <p className="favorites-subtitle">Chọn văn bản khi đọc để thêm vào yêu thích, xem lại tại đây</p>
      </div>

      {loading ? (
        <div className="events-empty" id="favorites-loading">Đang tải mục yêu thích…</div>
      ) : error ? (
        <div className="events-empty" id="favorites-error" role="alert">
          <p>{error}</p>
          <button type="button" className="app-button favorites-retry-btn" onClick={() => reload()}>
            Thử lại
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          id="favorites-empty"
          className="favorites-empty"
          instrument="flask"
          title="Chưa có mục yêu thích"
          hint="Mở một cuốn sách, chọn đoạn văn hoặc hình ảnh rồi nhấn «Yêu thích», sau đó có thể nhanh chóng quay lại đây."
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={() => services.workflowDialog.requestOpenUpload()}
          >
            Tải lên PDF
          </button>
        </EmptyState>
      ) : (
        <ul id="favorites-list" className="favorites-list">
          {items.map((item) => {
            const id = `${item.favorite_id || ""}`.trim();
            const quote = `${item.quote_text || ""}`.trim();
            const note = `${item.note || ""}`.trim();
            const page = formatPage(item.page_idx);
            const kind = kindLabel(item.kind || "");
            return (
              <li key={id || `${item.document_id}-${item.block_id}-${item.page_idx}`}>
                <button
                  type="button"
                  className="favorites-card"
                  data-favorite-id={id}
                  onClick={() => {
                    if (!openFavoriteInReader(item)) {
                      toast.error("Không thể mở: thiếu thông tin sách liên quan");
                    }
                  }}
                >
                  <div className="favorites-card-meta">
                    <span className="favorites-card-kind">{kind}</span>
                    {page ? <span className="favorites-card-page">{page}</span> : null}
                  </div>
                  <p className="favorites-card-quote">{quote || "(Không có văn bản trích dẫn)"}</p>
                  {note ? <p className="favorites-card-note">{note}</p> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
