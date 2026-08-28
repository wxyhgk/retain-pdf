// Cột phải: thông báo lỗi + xác nhận xóa.

import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {string} [props.error]
 * @param {boolean} props.confirmingDelete
 * @param {string|boolean} props.busy
 * @param {() => void} props.onDelete
 */
export function DeleteFooterPanel({ error, confirmingDelete, busy, onDelete }) {
  return (
    <>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="border-t border-border/30 pt-3">
        <button
          id="book-detail-delete-btn"
          type="button"
          disabled={Boolean(busy)}
          onClick={onDelete}
          className={cn(
            "text-sm text-destructive hover:underline disabled:opacity-55",
            confirmingDelete && "font-semibold",
          )}
        >
          {confirmingDelete ? "Xác nhận xóa cuốn sách này?" : "Xóa"}
        </button>
      </div>
    </>
  );
}
