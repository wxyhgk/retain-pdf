import { cn } from "@/ui/lib/utils";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import { documentJobPresentation } from "../../use-document-jobs.js";

function progressOf(job?: DocumentJobSummary | null) {
  const progress: any = job?.stage_snapshot?.progress || job?.progress || {};
  const percent = Number(progress.percent);
  if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));
  const current = Number(progress.current);
  const total = Number(progress.total);
  return Number.isFinite(current) && Number.isFinite(total) && total > 0
    ? Math.max(0, Math.min(100, (current / total) * 100))
    : null;
}

function progressCountOf(job?: DocumentJobSummary | null) {
  const progress: any = job?.stage_snapshot?.progress || job?.progress || {};
  const current = Number(progress.current);
  const total = Number(progress.total);
  return Number.isFinite(current) && Number.isFinite(total) && total > 0
    ? { current, total }
    : null;
}

function elapsedMsOf(job?: DocumentJobSummary | null): number | null {
  const snapshot: any = job?.stage_snapshot || {};
  const runtime: any = (job as any)?.runtime || {};
  const candidates = [
    (job as any)?.total_elapsed_ms,
    (job as any)?.elapsed_ms,
    runtime?.total_elapsed_ms,
    snapshot?.total_elapsed_ms,
    snapshot?.elapsed_ms,
    (job as any)?.active_stage_elapsed_ms,
    runtime?.active_stage_elapsed_ms,
    snapshot?.active_stage_elapsed_ms,
  ];
  for (const candidate of candidates) {
    const ms = Number(candidate);
    if (Number.isFinite(ms) && ms >= 0) return ms;
  }
  return null;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

/** 状态行已展示页码时，去掉 stage_detail 里重复的“第 51/88 页”。 */
function dedupeDetail(detail: string, showCount: boolean) {
  if (!showCount || !detail) return detail;
  return detail
    .replace(/[,，、\s]*第?\s*\d+\s*\/\s*\d+\s*页?/g, "")
    .replace(/^[,，:：、\s]+|[,，:：、\s]+$/g, "")
    .trim();
}

export function ProcessingJobSummary({
  job,
  idleText,
  id,
  labels,
  subject,
}: {
  job?: DocumentJobSummary | null;
  idleText: string;
  id?: string;
  labels?: Partial<Record<"idle" | "active" | "done" | "failed", string>>;
  subject?: string;
}) {
  const state = documentJobPresentation(job, idleText);
  const stateLabel = labels?.[state.tone as "idle" | "active" | "done" | "failed"] || state.label;
  const snapshot: any = job?.stage_snapshot || {};
  const detail = `${snapshot.stage_detail || job?.stage_detail || ""}`.trim();
  const percent = progressOf(job);
  const count = progressCountOf(job);
  // 状态行一行讲清：状态 pill 贴着进度数字；悬停/无障碍保留原 label。
  const statusText = [
    stateLabel,
    count ? `${count.current}/${count.total}` : null,
    percent !== null ? `${Math.round(percent)}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const detailText = dedupeDetail(detail, Boolean(count));
  const elapsedMs = elapsedMsOf(job);
  return (
    <div
      id={id}
      className="book-detail-processing-summary"
      data-job-id={job?.job_id || ""}
      data-job-status={job?.status || "idle"}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(job && "book-detail-status", "text-xs font-medium text-foreground")}
          title={stateLabel}
          aria-label={stateLabel}
        >
          {statusText}
        </span>
        {job?.job_id ? (
          <span className="max-w-44 truncate font-mono text-[10px] text-muted-foreground">
            {job.job_id}
          </span>
        ) : null}
      </div>
      {detailText ? <p className="mt-1.5 text-xs text-muted-foreground">{detailText}</p> : null}
      {percent !== null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      {elapsedMs !== null && subject ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{subject} 已用 {formatElapsed(elapsedMs)}</p>
      ) : null}
    </div>
  );
}
