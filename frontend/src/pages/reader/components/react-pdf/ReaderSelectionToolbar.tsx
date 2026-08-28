// Floating toolbar chọn văn bản: thêm ghi chú (chỉ reader mới).

import { StickyNote, X } from "lucide-react";
import type { ReaderTextSelection } from "../../hooks/use-reader-text-selection.js";

export type ReaderSelectionToolbarProps = {
  selection: ReaderTextSelection | null;
  onAddNote: (selection: ReaderTextSelection) => void;
  onDismiss: () => void;
};

function clipQuote(text: string, max = 42) {
  const t = `${text || ""}`.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function ReaderSelectionToolbar({
  selection,
  onAddNote,
  onDismiss,
}: ReaderSelectionToolbarProps) {
  if (!selection) {
    return null;
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;
  const midX = selection.rect.left + selection.rect.width / 2;
  const left = Math.min(Math.max(16, midX), vw - 16);

  // Ưu tiên phía trên selection; nếu không đủ chỗ thì lật xuống dưới.
  const preferAbove = selection.rect.top > 72;
  const top = preferAbove
    ? Math.max(12, selection.rect.top - 8)
    : Math.min(vh - 12, selection.rect.top + selection.rect.height + 8);
  const place = preferAbove ? "above" : "below";

  const paneLabel = selection.pane === "translated" ? "Bản dịch" : "Bản gốc";
  const quote = clipQuote(selection.quote);

  return (
    <div
      className={`reader-sel-pop reader-sel-pop--${place}`}
      style={{ left, top }}
      role="toolbar"
      aria-label="Thao tác selection"
    >
      <div className="reader-sel-pop-card">
        <div className="reader-sel-pop-quote" title={selection.quote}>
          <span className="reader-sel-pop-mark" aria-hidden="true">“</span>
          <span className="reader-sel-pop-quote-text">{quote}</span>
        </div>

        <div className="reader-sel-pop-meta">
          <span className="reader-sel-pop-chip">Trang {selection.page}</span>
          <span className={`reader-sel-pop-chip reader-sel-pop-chip--${selection.pane}`}>
            {paneLabel}
          </span>
        </div>

        <div className="reader-sel-pop-actions">
          <button
            type="button"
            className="reader-sel-pop-btn reader-sel-pop-btn--primary"
            onClick={() => onAddNote(selection)}
          >
            <StickyNote size={15} strokeWidth={2.25} aria-hidden />
            <span>Thêm ghi chú</span>
          </button>
          <button
            type="button"
            className="reader-sel-pop-btn reader-sel-pop-btn--ghost"
            onClick={onDismiss}
            aria-label="Hủy selection"
            title="Hủy"
          >
            <X size={15} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
      <span className="reader-sel-pop-caret" aria-hidden="true" />
    </div>
  );
}
