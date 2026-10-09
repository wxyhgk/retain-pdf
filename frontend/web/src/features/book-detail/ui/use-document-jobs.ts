import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import type { LibraryController } from "@/features/library/index.js";
import {
  selectDocumentOcrStatusJob,
  selectReusableOcrJob,
} from "@/features/library/domain.js";
import {
  DOCUMENT_JOBS_REFRESH_INTERVAL_MS,
  documentIdOf,
  isDocumentJobTerminal,
  jobIdOf,
  mergeRuntimeDocumentJob,
  runtimeDocumentJob,
  selectLatestDocumentJob,
  selectNewlySucceededJobs,
  selectRetryBaseJob,
  upsertDocumentJob,
  workflowCategory,
  workflowOf,
} from "../domain/document-jobs-model.js";
import type { RuntimeJobState } from "../domain/document-jobs-model.js";
import { useDocumentJobRuntimeOwner } from "./use-document-job-runtime-owner.js";

// 保持既有 import 路径可用：纯模型/选择器转发自 domain。
export {
  DOCUMENT_JOBS_REFRESH_INTERVAL_MS,
  documentJobPresentation,
  isDocumentJobActive,
  isDocumentJobTerminal,
  mergeRuntimeDocumentJob,
  runtimeDocumentJob,
  selectLatestDocumentJob,
  upsertDocumentJob,
} from "../domain/document-jobs-model.js";

type RuntimeJobStore = {
  getSnapshot: () => RuntimeJobState;
  subscribe: (listener: () => void) => () => void;
};

const EMPTY_RUNTIME_STORE = {
  getSnapshot: () => ({ jobId: "", snapshot: null }),
  subscribe: () => () => {},
};

export function useDocumentJobs({
  open,
  documentId,
  actions,
  initialJob,
  runtimeStore,
  refreshIntervalMs = DOCUMENT_JOBS_REFRESH_INTERVAL_MS,
  onJobSucceeded,
}: {
  open: boolean;
  documentId: string;
  actions: Pick<LibraryController, "getDocumentJobs" | "getDocumentByJobId">;
  initialJob?: Partial<DocumentJobSummary> | null;
  runtimeStore?: RuntimeJobStore | null;
  refreshIntervalMs?: number;
  onJobSucceeded?: (job: DocumentJobSummary) => unknown;
}) {
  const [jobs, setJobs] = useState<DocumentJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedDocumentId, setLoadedDocumentId] = useState("");
  const [error, setError] = useState("");
  const [succeededRevision, setSucceededRevision] = useState(0);
  const [lastSucceededJobId, setLastSucceededJobId] = useState("");
  const generationRef = useRef(0);
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

  // “+”提交先发布全局 runtime 快照，但 JobSubmissionView 不携带 document_id。
  // 归属解析把 job_id 反查/缓存后交给下面的 effectiveJobs 合并。
  const runtimeOwner = useDocumentJobRuntimeOwner({
    open,
    documentId,
    runtimeJobId,
    runtimeDeclaredDocumentId,
    initialJobId,
    initialDocumentId,
    resolveDocument: actions?.getDocumentByJobId,
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
    const completed = selectLatestDocumentJob(selectNewlySucceededJobs({
      jobs: effectiveJobs,
      statusById: observedStatusRef.current,
      isOptimisticJobId: (id) => optimisticJobsRef.current.has(id),
    }));
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
    retryBaseTranslation: selectRetryBaseJob(effectiveJobs, latestTranslation),
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
