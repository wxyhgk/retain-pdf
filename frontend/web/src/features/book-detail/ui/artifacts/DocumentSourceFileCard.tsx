import { FileText } from "lucide-react";

import { btn } from "../panels/ui.jsx";

export type DocumentSourceFileCardProps = {
  filename?: string;
  pageCount?: number | null;
  available: boolean;
  onOpen: () => void;
};

export function DocumentSourceFileCard({
  filename = "原始 PDF",
  pageCount,
  available,
  onOpen,
}: DocumentSourceFileCardProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-muted/15 p-4" aria-labelledby="book-detail-source-file-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-foreground shadow-sm" aria-hidden="true">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="book-detail-source-file-title" className="truncate text-sm font-semibold text-foreground">
            {filename || "原始 PDF"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pageCount ? `${pageCount} 页 · 入库源文件` : "入库源文件"}
          </p>
        </div>
        <button
          id="book-detail-open-source-file-btn"
          type="button"
          className={btn("outline", "shrink-0")}
          disabled={!available}
          onClick={onOpen}
        >
          查看
        </button>
      </div>
    </section>
  );
}
