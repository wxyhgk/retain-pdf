import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import {
  selectDocumentOcrStatusJob,
  selectReusableOcrJob,
} from "@/features/library/domain.js";
import { isPollingBootstrapPlaceholder } from "@/features/jobs/index.js";

const ACTIVE_STATUSES = new Set(["queued", "pending", "running", "validating"]);
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled", "canceled"]);
export const DOCUMENT_JOBS_REFRESH_INTERVAL_MS = 2_000;
const runtimeJobDocumentCache = new Map<string, string>();

const EMPTY_RUNTIME_STORE = {
  getSnapshot: () => ({ jobId: "", snapshot: null }),
  subscribe: () => () => {},
};

function jobIdOf(job?: Partial<DocumentJobSummary> | null) {
  return `${job?.job_id || job?.id || ""}`.trim();
}

function documentIdOf(value?: Record<string, unknown> | null) {
  return `${value?.document_id || value?.id || ""}`.trim();
}

export function isDocumentJobActive(job?: DocumentJobSummary | null) {
  return ACTIVE_STATUSES.has(`${job?.status || ""}`.trim().toLowerCase());
}

export function isDocumentJobTerminal(job?: DocumentJobSummary | null) {
  return TERMINAL_STATUSES.has(`${job?.status || ""}`.trim().toLowerCase());
}

function workflowOf(job?: DocumentJobSummary | null) {
  return `${job?.workflow || job?.job_type || ""}`.trim().toLowerCase();
}

function workflowCategory(job?: DocumentJobSummary | null) {
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

/** currentJobStore -> documentJobs 共用的当前任务形状。 */
export function runtimeDocumentJob(runtimeState: any): DocumentJobSummary | null {
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

export function documentJobPresentation(job?: DocumentJobSummary | null, idleLabel = "尚未开始") {
  if (!job) return { label: idleLabel, tone: "muted" };
  const status = `${job.status || ""}`.trim().toLowerCase();
  if (ACTIVE_STATUSES.has(status)) return { label: "处理中", tone: "active" };
  if (status === "succeeded") return { label: "已完成", tone: "done" };
  if (status === "failed") return { label: "失败", tone: "failed" };
  if (status === "cancelled" || status === "canceled") return { label: "已取消", tone: "muted" };
  return { label: status || idleLabel, tone: "muted" };
}

export function useDocumentJobs({
  open,
  documentId,
  actions,
  initialJob,
  runtimeStore,
  refreshIntervalMs = DOCUMENT_JOBS_REFRESH_INTERVAL_MS,
  onJobSucceeded,
}: any) {
  const [jobs, setJobs] = useState<DocumentJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedDocumentId, setLoadedDocumentId] = useState("");
  const [error, setError] = useState("");
  const [succeededRevision, setSucceededRevision] = useState(0);
  const [lastSucceededJobId, setLastSucceededJobId] = useState("");
  const generationRef = useRef(0);
  const ownerGenerationRef = useRef(0);
  const optimisticJobsRef = useRef(new Map<string, DocumentJobSummary>());
  const terminalRefreshKeyRef = useRef("");
  const observedStatusRef = useRef(new Map<string, string>());
  const onJobSucceededRef = useRef(onJobSucceeded);
  onJobSucceededRef.current = onJobSucceeded;
  const runtimeState = useStoreSnapshot(runtimeStore || EMPTY_RUNTIME_STORE);
  const runtimeJob = useMemo(() => runtimeDocumentJob(runtimeState), [runtimeState]);
  const runtimeJobId = jobIdOf(runtimeJob);
  const runtimeDeclaredDocumentId = documentIdOf(runtimeJob);
  const initialJobId = `${initialJob?.job_id || initialJob?.active_job_id || ""}`.trim();
  const initialDocumentId = documentIdOf(initialJob);
  const [runtimeOwner, setRuntimeOwner] = useState({
    jobId: "",
    documentId: "",
    resolving: false,
  });

  const upsert = useCallback((candidate?: Partial<DocumentJobSummary> | null) => {
    const normalized = upsertDocumentJob([], candidate, documentId)[0];
    if (!normalized) return null;
    optimisticJobsRef.current.set(normalized.job_id, normalized);
    setJobs((current) => upsertDocumentJob(current, normalized, documentId));
    return normalized;
  }, [documentId]);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!open || !documentId) {
      setJobs([]);
      setLoading(false);
      setLoadedDocumentId("");
      return [];
    }
    const generation = ++generationRef.current;
    if (!quiet) setLoading(true);
    try {
      const response = await actions.getDocumentJobs(documentId);
      const fromServer = Array.isArray(response?.items) ? response.items : [];
      const serverIds = new Set<string>(
        (fromServer as DocumentJobSummary[]).map(jobIdOf).filter(Boolean),
      );
      for (const serverId of serverIds) optimisticJobsRef.current.delete(serverId);
      const next = [...optimisticJobsRef.current.values()].reduce(
        (current, optimistic) => upsertDocumentJob(current, optimistic, documentId),
        fromServer as DocumentJobSummary[],
      );
      if (generation === generationRef.current) {
        setJobs(next);
        setError("");
        setLoadedDocumentId(documentId);
      }
      return next;
    } catch (cause) {
      if (generation === generationRef.current) {
        setError(`${cause?.message || cause || "读取任务状态失败"}`);
        setLoadedDocumentId(documentId);
      }
      return [];
    } finally {
      // 静默轮询可能在首次加载尚未完成时成为最新一代请求；此时也必须
      // 收起首次 loading，不能让“正在读取文档任务”永久残留。
      if (generation === generationRef.current) setLoading(false);
    }
  }, [actions, documentId, open]);

  useEffect(() => {
    optimisticJobsRef.current.clear();
    terminalRefreshKeyRef.current = "";
    observedStatusRef.current.clear();
    setSucceededRevision(0);
    setLastSucceededJobId("");
    if (!open || !documentId) {
      generationRef.current += 1;
      setJobs([]);
      setError("");
      setLoadedDocumentId("");
      return undefined;
    }
    void refresh();
    const interval = Number(refreshIntervalMs) > 0
      ? globalThis.setInterval(() => void refresh({ quiet: true }), Number(refreshIntervalMs))
      : null;
    return () => {
      if (interval !== null) globalThis.clearInterval(interval);
      // 让关闭/切文档前发出的 GET 结果失效，不能回写下一本书。
      generationRef.current += 1;
    };
  }, [documentId, open, refresh, refreshIntervalMs]);

  // “+”提交先发布全局 runtime 快照，但 JobSubmissionView 不携带
  // document_id。详情页不能因此丢掉进度：用既有 job_id 反查一次文档归属，
  // 缓存后再把 runtime 合并进当前文档；切换书籍时仍严格校验归属，避免串书。
  useEffect(() => {
    const generation = ++ownerGenerationRef.current;
    if (!open || !documentId || !runtimeJobId) {
      setRuntimeOwner({ jobId: "", documentId: "", resolving: false });
      return undefined;
    }
    const knownOwner = runtimeDeclaredDocumentId
      || (runtimeJobId === initialJobId ? initialDocumentId : "")
      || runtimeJobDocumentCache.get(runtimeJobId)
      || "";
    if (knownOwner) {
      runtimeJobDocumentCache.set(runtimeJobId, knownOwner);
      setRuntimeOwner({ jobId: runtimeJobId, documentId: knownOwner, resolving: false });
      return undefined;
    }
    const resolveDocument = actions?.getDocumentByJobId;
    if (typeof resolveDocument !== "function") {
      setRuntimeOwner({ jobId: runtimeJobId, documentId: "", resolving: false });
      return undefined;
    }

    setRuntimeOwner({ jobId: runtimeJobId, documentId: "", resolving: true });
    let cancelled = false;
    void (async () => {
      // 上传先建 document 再建 job，通常首请求即可命中；短暂的两次补偿只用于
      // 应对数据库投影尚未可见的瞬间，不依赖 2 秒 document-jobs 轮询。
      for (const delay of [0, 250, 750]) {
        if (delay) await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
        if (cancelled || generation !== ownerGenerationRef.current) return;
        try {
          const owner = await resolveDocument(runtimeJobId);
          const ownerDocumentId = documentIdOf(owner);
          if (!ownerDocumentId) continue;
          runtimeJobDocumentCache.set(runtimeJobId, ownerDocumentId);
          if (!cancelled && generation === ownerGenerationRef.current) {
            setRuntimeOwner({
              jobId: runtimeJobId,
              documentId: ownerDocumentId,
              resolving: false,
            });
          }
          return;
        } catch {
          // 归属解析是 runtime 合并的增强路径；文档任务主轮询仍继续工作。
        }
      }
      if (!cancelled && generation === ownerGenerationRef.current) {
        setRuntimeOwner({ jobId: runtimeJobId, documentId: "", resolving: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    actions?.getDocumentByJobId,
    documentId,
    initialDocumentId,
    initialJobId,
    open,
    runtimeDeclaredDocumentId,
    runtimeJobId,
  ]);

  const effectiveJobs = useMemo(() => {
    let next = jobs;
    if (initialJobId && !initialJobId.startsWith("doc:")) {
      next = upsertDocumentJob(next, { ...initialJob, job_id: initialJobId }, documentId);
    }
    const runtimeId = jobIdOf(runtimeJob);
    const resolvedRuntimeJob = runtimeJob && runtimeOwner.jobId === runtimeId
      && runtimeOwner.documentId === documentId
      ? { ...runtimeJob, document_id: documentId }
      : runtimeJob;
    return mergeRuntimeDocumentJob(
      next,
      resolvedRuntimeJob,
      documentId,
      Boolean(runtimeId && optimisticJobsRef.current.has(runtimeId)),
    );
  }, [documentId, initialJob, initialJobId, jobs, runtimeJob, runtimeOwner]);

  const trackedRuntimeJob = useMemo(() => {
    if (!runtimeJob) return null;
    const runtimeId = jobIdOf(runtimeJob);
    return effectiveJobs.find((job) => jobIdOf(job) === runtimeId) || null;
  }, [effectiveJobs, runtimeJob]);

  const latestOptimisticTranslation = effectiveJobs.find((job) => (
    optimisticJobsRef.current.has(jobIdOf(job))
    && workflowCategory(job) === "translation"
  )) || null;
  const latestTranslation = latestOptimisticTranslation || selectLatestDocumentJob(
    effectiveJobs,
    (job) => workflowCategory(job) === "translation",
  );

  // 任务从非成功态进入 succeeded 时发布一次完成修订。调用方可订阅
  // succeededRevision 刷新 document meta / artifact manifest，也可直接传回调。
  useEffect(() => {
    if (!open || !documentId) return;
    const transitioned: DocumentJobSummary[] = [];
    const currentIds = new Set<string>();
    for (const job of effectiveJobs) {
      const id = jobIdOf(job);
      if (!id) continue;
      currentIds.add(id);
      const status = `${job.status || ""}`.trim().toLowerCase();
      const previous = observedStatusRef.current.get(id);
      if (
        status === "succeeded"
        && previous !== "succeeded"
        && (previous !== undefined || optimisticJobsRef.current.has(id))
      ) {
        transitioned.push(job);
      }
      observedStatusRef.current.set(id, status);
    }
    for (const id of observedStatusRef.current.keys()) {
      if (!currentIds.has(id)) observedStatusRef.current.delete(id);
    }
    const completed = selectLatestDocumentJob(transitioned);
    if (!completed) return;
    const completedId = jobIdOf(completed);
    setLastSucceededJobId(completedId);
    setSucceededRevision((revision) => revision + 1);
    onJobSucceededRef.current?.(completed);
  }, [documentId, effectiveJobs, open]);

  // currentJobStore 每秒更新当前任务；进入终态后立即向 document-scoped API
  // 对账一次，不等待常规 2 秒列表刷新，以尽快补齐产物/阶段字段。
  useEffect(() => {
    if (!open || !documentId || !isDocumentJobTerminal(trackedRuntimeJob)) {
      // 同一 job_id 可以重试；重新进入运行态后允许下一次终态再次对账。
      if (trackedRuntimeJob) terminalRefreshKeyRef.current = "";
      return;
    }
    const key = `${jobIdOf(trackedRuntimeJob)}:${trackedRuntimeJob?.status || ""}`;
    if (!key || terminalRefreshKeyRef.current === key) return;
    terminalRefreshKeyRef.current = key;
    void refresh({ quiet: true });
  }, [documentId, open, refresh, trackedRuntimeJob]);

  return useMemo(() => ({
    jobs: effectiveJobs,
    loading: loading
      || Boolean(open && documentId && loadedDocumentId !== documentId)
      || runtimeOwner.resolving,
    error,
    refresh,
    upsert,
    succeededRevision,
    lastSucceededJobId,
    latestOcr: selectLatestDocumentJob(effectiveJobs, (job) => workflowOf(job) === "ocr"),
    ocrStatusJob: selectDocumentOcrStatusJob(effectiveJobs),
    reusableOcr: selectReusableOcrJob(effectiveJobs),
    latestTranslation,
  }), [
    effectiveJobs,
    error,
    lastSucceededJobId,
    latestTranslation,
    loading,
    loadedDocumentId,
    documentId,
    open,
    refresh,
    runtimeOwner.resolving,
    succeededRevision,
    upsert,
  ]);
}
