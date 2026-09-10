// 主页「收藏」tab：跨书摘录/笔记列表。
//
// 与「合集」区分：合集 = 文档分组；收藏 = 阅读器里标的句子/图表/笔记。
// 首版：拉全量 favorites → 空态 / 列表；点一项带锚点打开阅读器。

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { fetchFavorites } from "@/platform/api/index.js";
import { EmptyState } from "@/ui/icons/EmptyState.jsx";

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
  if (k === "figure") return "图表";
  if (k === "data") return "数据";
  if (k === "sentence") return "摘录";
  return k || "摘录";
}

function formatPage(pageIdx: unknown) {
  const n = Number(pageIdx);
  if (!Number.isFinite(n) || n < 0) return "";
  return `第 ${n + 1} 页`;
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
    documentId: documentId || undefined,
    pageIdx: Number.isFinite(pageIdx) ? pageIdx : null,
    blockId: `${item.block_id || ""}`.trim(),
  };

  if (typeof document?.dispatchEvent === "function" && typeof CustomEvent === "function") {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openReaderRequested, { detail }));
    return true;
  }
  return false;
}

export type FavoritesViewProps = {
  /** 空态里的"上传 PDF"按钮：由页面接到自己的上传弹窗上。 */
  onRequestUpload: () => void;
};

export function FavoritesView({ onRequestUpload }: FavoritesViewProps) {
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
        setError(err?.message || "读取收藏失败，请稍后重试。");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section id="favorites-view" className="library-view favorites-view" aria-label="收藏">
      <div className="favorites-head">
        <h2 className="favorites-title">我的收藏</h2>
        <p className="favorites-subtitle">阅读时选中文字即可收藏，在这里统一回看</p>
      </div>

      {loading ? (
        <div className="events-empty" id="favorites-loading">正在加载收藏…</div>
      ) : error ? (
        <div className="events-empty" id="favorites-error" role="alert">
          <p>{error}</p>
          <button type="button" className="app-button favorites-retry-btn" onClick={() => reload()}>
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          id="favorites-empty"
          className="favorites-empty"
          instrument="flask"
          title="还没有收藏"
          hint="打开一本书，选中段落或图表后点「收藏」，之后就能在这里快速跳回原文。"
        >
          <button
            type="button"
            className="app-button empty-state-action"
            onClick={onRequestUpload}
          >
            上传 PDF
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
                      toast.error("无法打开：缺少关联书籍信息");
                    }
                  }}
                >
                  <div className="favorites-card-meta">
                    <span className="favorites-card-kind">{kind}</span>
                    {page ? <span className="favorites-card-page">{page}</span> : null}
                  </div>
                  <p className="favorites-card-quote">{quote || "（无摘录文本）"}</p>
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
