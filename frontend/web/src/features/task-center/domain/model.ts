import type { JobListItemView } from "@retainpdf/contracts/job-status";

export type TaskCenterGroupKey = "running" | "queued" | "failed" | "completed";

export type TaskCenterGroup = {
  key: TaskCenterGroupKey;
  label: string;
  items: JobListItemView[];
};

export const TASK_CENTER_GROUP_ORDER: TaskCenterGroupKey[] = [
  "running",
  "queued",
  "failed",
  "completed",
];

const GROUP_LABELS: Record<TaskCenterGroupKey, string> = {
  running: "运行中",
  queued: "排队中",
  failed: "失败",
  completed: "已完成",
};

export function taskIdentity(job: Pick<JobListItemView, "job_id">): string {
  return `job:${`${job?.job_id || ""}`.trim()}`;
}

export function taskDocumentLabel(job: JobListItemView): string {
  return `${job.display_name || job.source_file_name || "未命名文档"}`.trim() || "未命名文档";
}

export function taskWorkflowLabel(job: Pick<JobListItemView, "workflow">): string {
  switch (`${job.workflow || ""}`.trim().toLowerCase()) {
    case "ocr": return "OCR";
    case "book": return "整本翻译";
    case "translate": return "翻译";
    case "render": return "渲染";
    default: return `${job.workflow || "未知流程"}`;
  }
}

export function taskStatusLabel(job: Pick<JobListItemView, "status">): string {
  switch (`${job.status || ""}`.trim().toLowerCase()) {
    case "queued": return "排队中";
    case "running": return "运行中";
    case "failed": return "失败";
    case "succeeded": return "已完成";
    case "cancelled":
    case "canceled": return "已取消";
    default: return `${job.status || "未知状态"}`;
  }
}

export function taskGroupKey(job: Pick<JobListItemView, "status">): TaskCenterGroupKey {
  switch (`${job.status || ""}`.trim().toLowerCase()) {
    case "running": return "running";
    case "queued": return "queued";
    case "failed": return "failed";
    default: return "completed";
  }
}

export function groupTaskCenterJobs(items: JobListItemView[] = []): TaskCenterGroup[] {
  const grouped = new Map<TaskCenterGroupKey, JobListItemView[]>(
    TASK_CENTER_GROUP_ORDER.map((key) => [key, []]),
  );
  for (const item of items) {
    if (!`${item?.job_id || ""}`.trim()) continue;
    grouped.get(taskGroupKey(item))?.push(item);
  }
  return TASK_CENTER_GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: grouped.get(key) || [],
  }));
}

export function taskCenterCounts(items: JobListItemView[] = []): Record<TaskCenterGroupKey | "total", number> {
  const groups = groupTaskCenterJobs(items);
  return {
    total: groups.reduce((sum, group) => sum + group.items.length, 0),
    running: groups.find((group) => group.key === "running")?.items.length || 0,
    queued: groups.find((group) => group.key === "queued")?.items.length || 0,
    failed: groups.find((group) => group.key === "failed")?.items.length || 0,
    completed: groups.find((group) => group.key === "completed")?.items.length || 0,
  };
}

export function taskProgressPercent(job: JobListItemView): number | null {
  const progress = job.stage_snapshot?.progress;
  const percent = Number(progress?.percent);
  if (Number.isFinite(percent)) return Math.max(0, Math.min(100, percent));
  const current = Number(progress?.current);
  const total = Number(progress?.total);
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return Math.max(0, Math.min(100, (current / total) * 100));
  }
  return null;
}
