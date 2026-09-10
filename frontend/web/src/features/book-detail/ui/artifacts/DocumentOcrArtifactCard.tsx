import { ScanText } from "lucide-react";
import { btn } from "../panels/ui.jsx";
import type { DocumentJobSummary } from "@/features/library/domain.js";

export function DocumentOcrArtifactCard({
  job,
  onOpen,
}: {
  job?: DocumentJobSummary | null;
  onOpen: (jobId: string) => void;
}) {
  if (!job) return null;
  const succeeded = `${job.status || ""}`.toLowerCase() === "succeeded";
  return (
    <section className="rounded-xl border border-border/60 bg-muted/15 p-4" aria-labelledby="book-detail-ocr-file-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper text-foreground shadow-sm" aria-hidden="true">
          <ScanText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="book-detail-ocr-file-title" className="text-sm font-semibold text-foreground">OCR 识别结果</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {succeeded ? "可查看结构化正文与页面定位" : "任务完成后可查看"}
          </p>
        </div>
        <button
          id="book-detail-open-ocr-file-btn"
          type="button"
          className={btn("outline", "shrink-0")}
          disabled={!succeeded || !job.job_id}
          onClick={() => onOpen(job.job_id)}
        >
          {succeeded ? "查看" : "处理中"}
        </button>
      </div>
    </section>
  );
}
