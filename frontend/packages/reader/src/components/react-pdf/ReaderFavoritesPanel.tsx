// 摘录悬浮窗：当前文档的服务端收藏列表（对齐 legacy 云端区）

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
  if (k === "figure") return "图表";
  if (k === "data") return "数据";
  if (k === "sentence") return "摘录";
  return k || "摘录";
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
      setError("当前没有可关联的文档");
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
      setError(err instanceof Error ? err.message : "读取摘录失败");
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
      title="摘录"
      subtitle="本书云端收藏 · 本地保存"
      titleIcon={<Bookmark size={14} strokeWidth={2.25} aria-hidden />}
      storageKey="retainpdf.reader.favorites-float.pos.v1"
      ariaLabel="摘录"
      onClose={onClose}
      toolbar={(
        <>
          <span className="reader-notes-count">
            {loading ? "加载中…" : `${items.length} 条`}
          </span>
          <button
            type="button"
            className="reader-notes-export"
            disabled={loading}
            onClick={() => void reload()}
          >
            刷新
          </button>
        </>
      )}
    >
      {error ? (
        <p className="reader-notes-empty" role="alert">{error}</p>
      ) : loading ? (
        <p className="reader-notes-empty">正在加载摘录…</p>
      ) : items.length === 0 ? (
        <p className="reader-notes-empty">
          暂无摘录。可从主页收藏内容后在这里定位阅读。
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
                  第 {(item.pageIdx || 0) + 1} 页
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
