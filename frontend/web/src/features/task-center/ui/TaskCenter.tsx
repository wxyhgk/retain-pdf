import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobListItemView } from "@retainpdf/contracts/job-status";
import {
  Activity,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Square,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  groupTaskCenterJobs,
  taskCenterCounts,
  taskDocumentLabel,
  taskIdentity,
  taskProgressPercent,
  taskStatusLabel,
  taskWorkflowLabel,
  type TaskCenterGroupKey,
} from "../domain/model.js";
import {
  cancelTaskCenterJob,
  loadTaskCenterJobs,
  retryTaskCenterJob,
  TASK_CENTER_MAX_ITEMS,
} from "../domain/task-center-api.js";

const ACTIVE_STATUSES = new Set(["queued", "running"]);

const GROUP_ICONS = {
  running: Activity,
  queued: Clock3,
  failed: TriangleAlert,
  completed: CheckCircle2,
} satisfies Record<TaskCenterGroupKey, typeof Activity>;

function shortJobId(jobId: string): string {
  const value = `${jobId || ""}`.trim();
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TaskRow({ job, busyAction, onOpen, onCancel, onRetry }: {
  job: JobListItemView;
  busyAction: string;
  onOpen: (job: JobListItemView) => void;
  onCancel: (job: JobListItemView) => void;
  onRetry: (job: JobListItemView) => void;
}) {
  const status = `${job.status || ""}`.trim().toLowerCase();
  const isActive = ACTIVE_STATUSES.has(status);
  const progress = taskProgressPercent(job);
  const busy = Boolean(busyAction);

  return (
    <article
      className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
      data-task-id={taskIdentity(job)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <FileText className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">文档</span>
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground" title={taskDocumentLabel(job)}>
              {taskDocumentLabel(job)}
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>任务 <code title={job.job_id}>{shortJobId(job.job_id)}</code></span>
            <span>{taskWorkflowLabel(job)}</span>
            {job.updated_at ? <span>{formatUpdatedAt(job.updated_at)}</span> : null}
          </div>
          {isActive && progress !== null ? (
            <div className="mt-2 flex items-center gap-2" aria-label={`任务进度 ${Math.round(progress)}%`}>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <span className="w-9 text-right text-[11px] text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
          {taskStatusLabel(job)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          onClick={() => onOpen(job)}
        >
          打开详情
        </button>
        {isActive ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            disabled={busy}
            onClick={() => onCancel(job)}
          >
            {busyAction === "cancel" ? <LoaderCircle className="size-3.5 animate-spin" /> : <Square className="size-3.5" />}
            {busyAction === "cancel" ? "取消中" : "取消任务"}
          </button>
        ) : null}
        {status === "failed" ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            disabled={busy}
            onClick={() => onRetry(job)}
          >
            {busyAction === "retry" ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            重试
          </button>
        ) : null}
      </div>
    </article>
  );
}

export type TaskCenterOpenBookDetailInput = {
  job_id?: string;
  display_name?: string;
  source_file_name?: string;
  workflow?: string;
  [key: string]: unknown;
};

export type TaskCenterProps = {
  /** 点任务卡片打开书籍详情：由页面接到自己的图书馆动作上。 */
  onOpenBookDetail: (input: TaskCenterOpenBookDetailInput) => void;
};

export function TaskCenter({ onOpenBookDetail }: TaskCenterProps) {
  const [items, setItems] = useState<JobListItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reachedLimit, setReachedLimit] = useState(false);
  const [busyByJob, setBusyByJob] = useState<Record<string, string>>({});
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const result = await loadTaskCenterJobs();
      if (!mountedRef.current) return;
      setItems(Array.isArray(result?.items) ? result.items : []);
      setReachedLimit(Boolean(result?.reachedLimit));
      setError("");
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "读取任务失败，请稍后重试。");
    } finally {
      requestInFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const hasActiveTasks = items.some((job) => ACTIVE_STATUSES.has(`${job.status || ""}`.toLowerCase()));
  useEffect(() => {
    if (!hasActiveTasks) return undefined;
    const timer = window.setInterval(() => { void load({ silent: true }); }, 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveTasks, load]);

  const groups = useMemo(() => groupTaskCenterJobs(items), [items]);
  const counts = useMemo(() => taskCenterCounts(items), [items]);

  function setBusy(jobId: string, action = "") {
    setBusyByJob((current) => ({ ...current, [jobId]: action }));
  }

  function handleOpen(job: JobListItemView) {
    // Book detail consumes the library projection, while /jobs returns a task
    // projection. Only bridge fields present in both contracts; notably do not
    // manufacture a document_id for a job list row.
    onOpenBookDetail({
      job_id: job.job_id,
      display_name: job.display_name,
      source_file_name: job.source_file_name || undefined,
      workflow: job.workflow,
      status: job.status,
      page_count: job.page_count,
      cover_url: job.cover_url || undefined,
      thumbnail_url: job.thumbnail_url || undefined,
      created_at: job.created_at,
      updated_at: job.updated_at,
      prefer_translate_tab: true,
    });
  }

  async function handleCancel(job: JobListItemView) {
    setBusy(job.job_id, "cancel");
    try {
      await cancelTaskCenterJob(job);
      toast.success("已提交取消请求");
      await load({ silent: true });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "取消失败，请稍后重试。");
    } finally {
      if (mountedRef.current) setBusy(job.job_id);
    }
  }

  async function handleRetry(job: JobListItemView) {
    setBusy(job.job_id, "retry");
    try {
      await retryTaskCenterJob(job.job_id);
      toast.success("已创建恢复任务");
      await load({ silent: true });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "重试失败，请稍后重试。");
    } finally {
      if (mountedRef.current) setBusy(job.job_id);
    }
  }

  return (
    <section id="task-center-view" className="mx-auto flex h-full w-full max-w-6xl flex-col px-5 pb-28 pt-5" aria-label="任务中心">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">任务中心</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">PDF 处理任务</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {reachedLimit
              ? `当前已加载最近 ${TASK_CENTER_MAX_ITEMS} 条，达到前端安全上限。`
              : `当前加载 ${items.length} 条；每次处理按独立任务展示。`}
          </p>
        </div>
        <button
          id="task-center-refresh-btn"
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          disabled={refreshing}
          onClick={() => void load()}
        >
          <RefreshCw className={`size-4${refreshing ? " animate-spin" : ""}`} />
          刷新
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="当前加载范围任务计数">
        {([
          ["全部", counts.total],
          ["运行中", counts.running],
          ["排队中", counts.queued],
          ["失败", counts.failed],
          ["已完成", counts.completed],
        ] as const).map(([label, count]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
            <div className="text-lg font-semibold text-foreground">{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> 正在读取任务…
        </div>
      ) : error && items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <TriangleAlert className="size-7 text-muted-foreground" />
          <p className="text-sm text-foreground">{error}</p>
          <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm" onClick={() => void load()}>重新加载</button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <Clock3 className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">暂无处理任务</p>
          <p className="text-xs text-muted-foreground">上传 PDF 并执行 OCR 或翻译后，任务会出现在这里。</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {error ? <div className="mb-3 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">刷新失败：{error}</div> : null}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group.key];
              return (
                <section key={group.key} className="rounded-3xl border border-border/70 bg-muted/35 p-3" aria-labelledby={`task-group-${group.key}`}>
                  <header className="flex items-center justify-between px-1 pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <h2 id={`task-group-${group.key}`} className="text-sm font-semibold text-foreground">{group.label}</h2>
                    </div>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{group.items.length}</span>
                  </header>
                  {group.items.length ? (
                    <div className="space-y-2">
                      {group.items.map((job) => (
                        <TaskRow
                          key={taskIdentity(job)}
                          job={job}
                          busyAction={busyByJob[job.job_id] || ""}
                          onOpen={handleOpen}
                          onCancel={(target) => void handleCancel(target)}
                          onRetry={(target) => void handleRetry(target)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">暂无{group.label}任务</div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
