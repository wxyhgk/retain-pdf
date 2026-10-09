// 文档任务模型（纯逻辑）：状态判定、runtime/提交合并、选择器与展示文案。
// 供 useDocumentJobs 及处理面板消费；不含 React，可被非 React 宿主复用。

import type { DocumentJobSummary } from "@/features/library/domain.js";
import { isPollingBootstrapPlaceholder } from "@/features/jobs/index.js";
import { isTerminalJobStatus } from "@/platform/contracts/job-status.js";
import { isActiveJobStatus, jobStatusPresentation } from "@retainpdf/domain/job";
export const DOCUMENT_JOBS_REFRESH_INTERVAL_MS = 2_000;

export function jobIdOf(job?: Partial<DocumentJobSummary> | null) {
  return `${job?.job_id || job?.id || ""}`.trim();
}

export function documentIdOf(value?: Record<string, unknown> | null) {
  return `${value?.document_id || value?.id || ""}`.trim();
}

export function isDocumentJobActive(job?: DocumentJobSummary | null) {
  return isActiveJobStatus(job?.status);
}

export function isDocumentJobTerminal(job?: DocumentJobSummary | null) {
  return isTerminalJobStatus(`${job?.status || ""}`.trim().toLowerCase());
}

export function workflowOf(job?: DocumentJobSummary | null) {
  return `${job?.workflow || job?.job_type || ""}`.trim().toLowerCase();
}

export function workflowCategory(job?: DocumentJobSummary | null) {
  const workflow = workflowOf(job);
  if (workflow === "ocr") return "ocr";
  if (workflow === "book" || workflow === "translate" || workflow === "translation" || workflow === "render") {
    return "translation";
  }
  return workflow;
}

function createdAtOf(job?: DocumentJobSummary | null) {
  const value = Date.parse(`${job?.created_at || ""}`.trim());
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

/**
 * document jobs API 当前按 updated_at 排序，但“最新一次提交”的身份必须由
 * created_at 决定。时间缺失/相同则保留输入顺序，让 optimistic 首项稳定胜出。
 */
export function selectLatestDocumentJob(
  jobs: DocumentJobSummary[] = [],
  predicate: (job: DocumentJobSummary) => boolean = () => true,
): DocumentJobSummary | null {
  let selected: DocumentJobSummary | null = null;
  let selectedCreatedAt = Number.NEGATIVE_INFINITY;
  for (const job of jobs) {
    if (!predicate(job)) continue;
    const createdAt = createdAtOf(job);
    if (!selected || createdAt > selectedCreatedAt) {
      selected = job;
      selectedCreatedAt = createdAt;
    }
  }
  return selected;
}

/**
 * 「重新翻译 / 重新渲染」以哪个任务为底。
 *
 * 最新的翻译类任务如果是一次已经结束的重新渲染，就退回到最新的那次**翻译**：重新渲染出来的
 * 任务译文还是它的源任务的，在它上面再重新渲染，底子一直是最早那份译文；而「阅读」按
 * 「最新的翻译胜出」挑任务（后端 resolve_reading_target），于是重新渲染的结果永远输给后来
 * 重翻的那次 —— 用户点了重新渲染、再点阅读，看到的还是旧的。
 * 渲染任务还在跑时照旧返回它，好让按钮保持禁用、不会重复提交。
 */
export function selectRetryBaseJob(
  jobs: DocumentJobSummary[] = [],
  latestTranslation: DocumentJobSummary | null = null,
): DocumentJobSummary | null {
  if (!latestTranslation || workflowOf(latestTranslation) !== "render") return latestTranslation;
  if (!isDocumentJobTerminal(latestTranslation)) return latestTranslation;
  return selectLatestDocumentJob(
    jobs,
    (job) => workflowCategory(job) === "translation" && workflowOf(job) !== "render",
  ) || latestTranslation;
}

/** currentJobStore -> documentJobs 共用的当前任务形状。 */
export type RuntimeJobState = {
  jobId?: string;
  snapshot?: Record<string, unknown> | null;
} | null | undefined;

export function runtimeDocumentJob(runtimeState: RuntimeJobState): DocumentJobSummary | null {
  const snapshot = runtimeState?.snapshot && typeof runtimeState.snapshot === "object"
    ? runtimeState.snapshot
    : null;
  const jobId = `${runtimeState?.jobId || snapshot?.job_id || snapshot?.id || ""}`.trim();
  if (!jobId || !snapshot) return null;
  const workflow = `${snapshot.workflow || snapshot.job_type || ""}`.trim();
  const status = `${snapshot.status || ""}`.trim();
  return {
    ...snapshot,
    job_id: jobId,
    ...(workflow ? { workflow } : {}),
    ...(status ? { status } : {}),
  } as DocumentJobSummary;
}

/**
 * 新提交和 runtime 更新都走同一个 upsert：同 job 合并，新 job 放到列表首位。
 * undefined 字段不会盖掉 document-scoped API 已有的 workflow/document_id。
 */
export function upsertDocumentJob(
  jobs: DocumentJobSummary[] = [],
  candidate?: Partial<DocumentJobSummary> | null,
  documentId = "",
): DocumentJobSummary[] {
  const id = jobIdOf(candidate);
  if (!id) return jobs;
  const cleanCandidate = Object.fromEntries(
    Object.entries(candidate || {}).filter(([, value]) => value !== undefined),
  );
  const index = jobs.findIndex((job) => jobIdOf(job) === id);
  const base = index >= 0 ? jobs[index] : null;
  const baseCategory = workflowCategory(base);
  const candidateCategory = workflowCategory(cleanCandidate as DocumentJobSummary);
  // 同一 job_id 的工作流类型不可变；runtime/list 的旧兼容字段可能把 OCR
  // 误报成 book，但只能更新状态，不能改变任务身份。book/translate 视为同类。
  if (baseCategory && candidateCategory && baseCategory !== candidateCategory) {
    delete cleanCandidate.workflow;
    delete cleanCandidate.job_type;
  }
  const next = {
    ...(base || {}),
    ...cleanCandidate,
    job_id: id,
    document_id: `${cleanCandidate.document_id || base?.document_id || documentId || ""}`.trim(),
  } as DocumentJobSummary;
  if (index < 0) return [next, ...jobs];
  return jobs.map((job, jobIndex) => (jobIndex === index ? next : job));
}

/**
 * runtime 首帧会先发布 queued/正在读取任务状态占位。它只表示请求尚未返回，
 * 不能把同一 job 已由 document API 确认的终态降级成“处理中”。
 */
export function mergeRuntimeDocumentJob(
  jobs: DocumentJobSummary[] = [],
  runtimeJob?: DocumentJobSummary | null,
  documentId = "",
  hasOptimisticJob = false,
): DocumentJobSummary[] {
  if (!runtimeJob) return jobs;
  const runtimeId = jobIdOf(runtimeJob);
  if (!runtimeId) return jobs;
  const existing = jobs.find((job) => jobIdOf(job) === runtimeId) || null;
  const belongsToDocument = `${runtimeJob.document_id || ""}`.trim() === documentId
    || Boolean(existing)
    || hasOptimisticJob;
  if (!belongsToDocument) return jobs;
  if (existing && isDocumentJobTerminal(existing) && isPollingBootstrapPlaceholder(runtimeJob)) {
    return jobs;
  }
  return upsertDocumentJob(jobs, runtimeJob, documentId);
}

// 文字和颜色统一出自 @retainpdf/domain/job 的 jobStatusPresentation。文档任务列表是摘要，
// 没有完成信号，succeeded 就是完成（见那个文件的文件头）。
export function documentJobPresentation(job?: DocumentJobSummary | null, idleLabel = "尚未开始") {
  if (!job) return { label: idleLabel, tone: "muted" };
  const { label, tone } = jobStatusPresentation(job.status, { idleLabel });
  return { label, tone };
}

/**
 * 计算本帧新进入 succeeded 的任务，并同步 job_id -> status 观察表。
 * 只把“从未知演进到成功”或“optimistic 提交后转成功”算作一次转换，
 * 重复响应不会重复发布。会原地清理 statusById 中已消失的 job。
 */
export function selectNewlySucceededJobs({
  jobs = [],
  statusById,
  isOptimisticJobId = () => false,
}: {
  jobs?: DocumentJobSummary[];
  statusById: Map<string, string>;
  isOptimisticJobId?: (jobId: string) => boolean;
}): DocumentJobSummary[] {
  const transitioned: DocumentJobSummary[] = [];
  const currentIds = new Set<string>();
  for (const job of jobs) {
    const id = jobIdOf(job);
    if (!id) continue;
    currentIds.add(id);
    const status = `${job.status || ""}`.trim().toLowerCase();
    const previous = statusById.get(id);
    if (
      status === "succeeded"
      && previous !== "succeeded"
      && (previous !== undefined || isOptimisticJobId(id))
    ) {
      transitioned.push(job);
    }
    statusById.set(id, status);
  }
  for (const id of statusById.keys()) {
    if (!currentIds.has(id)) statusById.delete(id);
  }
  return transitioned;
}
