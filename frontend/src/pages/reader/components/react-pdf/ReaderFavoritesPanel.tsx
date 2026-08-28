// Cửa sổ nổi trích đoạn: danh sách favorite phía server của tài liệu hiện tại (khớp vùng cloud legacy).

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import {
  API_PREFIX,
  createReaderServerFavoritesPort,
  fetchFavorites,
  normalizeServerFavorite,
  type ServerFavorite,
} from "../../external.js";
import { ReaderFloatShell } from "./ReaderFloatShell.js";

export type ReaderFavoritesPanelProps = {
  open: boolean;
  jobId: string;
  documentId: string;
  onClose: () => void;
  /** 1-based page jump */
  onJumpPage: (page: number) => void;
};

function kindLabel(kind: string) {
  const k = `${kind || ""}`.trim();
  if (k === "figure") return "Hình/bảng";
  if (k === "data") return "Dữ liệu";
  if (k === "sentence") return "Trích đoạn";
  return k || "Trích đoạn";
}

export function ReaderFavoritesPanel({
  open,
  jobId,
  documentId,
  onClose,
  onJumpPage,
}: ReaderFavoritesPanelProps) {
  const [items, setItems] = useState<ServerFavorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!jobId && !documentId) {
      setItems([]);
      setError("Hiện không có tài liệu có thể liên kết");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let list: ServerFavorite[] = [];
      if (jobId) {
        const port = createReaderServerFavoritesPort({ jobId });
        list = await port.loadServerFavorites();
      } else if (documentId) {
        const { favorites = [] } = await fetchFavorites(API_PREFIX, { documentId });
        list = (Array.isArray(favorites) ? favorites : [])
          .map((raw) => normalizeServerFavorite(raw))
          .filter(Boolean) as ServerFavorite[];
      }
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đọc được trích đoạn");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [jobId, documentId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  return (
    <ReaderFloatShell
      id="reader-favorites-panel"
      open={open}
      title="Trích đoạn"
      subtitle="Favorite cloud của sách này · lưu cục bộ"
      titleIcon={<Bookmark size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.favorites-float.pos.v1"
      ariaLabel="Trích đoạn"
      onClose={onClose}
      toolbar={(
        <>
          <span className="reader-notes-count">
            {loading ? "Đang tải..." : `${items.length} mục`}
          </span>
          <button
            type="button"
            className="reader-notes-export"
            disabled={loading}
            onClick={() => void reload()}
          >
            Làm mới
          </button>
        </>
      )}
    >
      {error ? (
        <p className="reader-notes-empty" role="alert">{error}</p>
      ) : loading ? (
        <p className="reader-notes-empty">Đang tải trích đoạn...</p>
      ) : items.length === 0 ? (
        <p className="reader-notes-empty">
          Chưa có trích đoạn. Hãy chọn văn bản khi đọc để thêm ghi chú, hoặc nhảy tới từ favorite ở trang chủ.
        </p>
      ) : (
        items.map((item) => (
          <article key={item.favoriteId} className="reader-notes-item">
            <div className="reader-notes-item-top">
              <span className="reader-notes-kind">{kindLabel(item.kind)}</span>
              <div className="reader-notes-item-actions">
                <button
                  type="button"
                  className="reader-notes-link"
                  onClick={() => onJumpPage(Math.max(1, (item.pageIdx || 0) + 1))}
                >
                  Trang {(item.pageIdx || 0) + 1}
                </button>
              </div>
            </div>
            <p className="reader-notes-quote">{item.quoteText}</p>
            {item.note ? <p className="reader-notes-note" style={{ cursor: "default" }}>{item.note}</p> : null}
          </article>
        ))
      )}
    </ReaderFloatShell>
  );
}
