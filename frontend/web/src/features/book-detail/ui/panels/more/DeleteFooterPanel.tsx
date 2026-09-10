// 右栏：错误提示 + 删除确认。

import { cn } from "@/ui/lib/utils";
import { Trash2 } from "lucide-react";

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
      <div className="book-detail-delete-panel border-t border-border/30 pt-3">
        <button
          id="book-detail-delete-btn"
          type="button"
          disabled={Boolean(busy)}
          onClick={onDelete}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:bg-muted hover:text-foreground disabled:opacity-55",
            confirmingDelete && "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
          )}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {confirmingDelete ? "确认删除这本书？" : "删除"}
        </button>
      </div>
    </>
  );
}
