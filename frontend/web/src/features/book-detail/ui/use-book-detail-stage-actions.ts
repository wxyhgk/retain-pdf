import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  JobRetryStage,
  JobStageActionsView,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { resumeJob as resumeJobRequest } from "@/platform/api/index.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import { isDocumentJobActive } from "./use-document-jobs.js";

const stageActionsCache = new Map<string, JobStageActionsView>();

// 失败恢复走 POST /resume（服务端按 resume-plan 自动续跑）：
// render 原地同 job_id，其余新建任务。只有已完成任务的显式重做、
// 用户二次确认接受重复风险、或 resume 不可用时，才走 retry-stage。
const RESUME_CANDIDATE_STATUSES = new Set([
  "failed",
  "error",
  "timeout",
  "dead",
  "cancelled",
  "canceled",
]);

function isResumeCandidate(job?: DocumentJobSummary | null) {
  return RESUME_CANDIDATE_STATUSES.has(`${job?.status || ""}`.trim().toLowerCase());
}

function jobIdOf(job?: DocumentJobSummary | null) {
  const id = `${job?.job_id || job?.id || ""}`.trim();
  return id.startsWith("doc:") ? "" : id;
}

export function useBookDetailStageActions({
  open,
  job,
  actions,
  onJobSubmitted,
  refreshKey = "",
}: {
  open: boolean;
  job?: DocumentJobSummary | null;
  actions: {
    getJobStageActions?: (jobId: string) => Promise<unknown>;
    retryJobStage?: (
      jobId: string,
      stage: JobRetryStage,
      payload?: Record<string, unknown>,
    ) => Promise<any>;
    resumeJob?: (jobId: string) => Promise<any>;
  };
  onJobSubmitted?: (job: Partial<DocumentJobSummary>) => unknown;
  /** OCR/document authority changed while the translation job stayed the same. */
  refreshKey?: string;
}) {
  const jobId = jobIdOf(job);
  const [view, setView] = useState<JobStageActionsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingStage, setPendingStage] = useState<JobRetryStage | "">("");
  const [error, setError] = useState("");
  const [resolvedJobId, setResolvedJobId] = useState("");
  const requestRef = useRef(0);
  const active = isDocumentJobActive(job);
  const eligible = Boolean(open && jobId && !active && actions.getJobStageActions);

  const refresh = useCallback(async () => {
    if (!eligible || !actions.getJobStageActions) {
      setView(null);
      setLoading(false);
      return null;
    }
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const result = await actions.getJobStageActions(jobId) as JobStageActionsView | null;
      if (request === requestRef.current) {
        const next = result && Array.isArray(result.stages) ? result : null;
        if (next) stageActionsCache.set(jobId, next);
        setView(next);
        setResolvedJobId(jobId);
        setError("");
      }
      return result;
    } catch (cause) {
      if (request === requestRef.current) {
        setView(null);
        setResolvedJobId(jobId);
        setError(`${(cause as Error)?.message || cause || "读取重新处理能力失败"}`);
      }
      return null;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [actions, eligible, jobId]);

  useEffect(() => {
    setView(stageActionsCache.get(jobId) || null);
    setError("");
    setPendingStage("");
    void refresh();
    return () => {
      requestRef.current += 1;
    };
  }, [refresh, refreshKey]);

  const currentView = view?.job_id === jobId ? view : stageActionsCache.get(jobId) || null;
  const stageActions = useMemo(() => {
    const supported = new Set(["translation", "render"]);
    return (currentView?.stages || []).filter(
      (action): action is JobStageRetryActionView => supported.has(`${action?.stage || ""}`),
    );
  }, [currentView]);
  const effectiveLoading = eligible && !currentView && resolvedJobId !== jobId
    ? true
    : loading;

  const retry = useCallback(async (
    stage: JobRetryStage,
    { acceptDuplicateRisk = false } = {},
  ) => {
    const descriptor = stageActions.find((action) => action.stage === stage);
    if (!descriptor?.can_retry || !actions.retryJobStage || pendingStage) return null;
    setPendingStage(stage);
    setError("");
    try {
      // 一键断点恢复优先：失败任务先调 POST /resume，服务端按 resume-plan
      // 自动续跑（render 原地同 id，其余新建）。显式二次确认风险后、
      // 已完成任务重做、或 resume 不可用时，才走 retry-stage(显式 stage)。
      if (!acceptDuplicateRisk && isResumeCandidate(job)) {
        try {
          const resume = actions.resumeJob
            ? await actions.resumeJob(jobId)
            : await resumeJobRequest(jobId);
          const resumedId = `${(resume as any)?.job_id || (resume as any)?.id || ""}`.trim();
          if (resumedId || resume) {
            const nextId = resumedId || jobId;
            onJobSubmitted?.({
              ...(resume as object),
              job_id: nextId,
              active_job_id: nextId,
              source_job_id: jobId,
              document_id: (resume as any)?.document_id || (job as any)?.document_id,
              workflow: (resume as any)?.workflow
                || (nextId === jobId ? (job as any)?.workflow : undefined)
                || (stage === "render" ? "render" : "book"),
              library_only: false,
            });
            return resume;
          }
        } catch {
          // resume 不可用（404/不可恢复等）→ 兜底显式 retry-stage。
        }
      }
      const result = await actions.retryJobStage(jobId, stage, {
        ...(descriptor.action?.body || {}),
        ...(acceptDuplicateRisk
          ? { ambiguous_request_policy: "accept_duplicate_risk" }
          : {}),
        document_id: `${job?.document_id || ""}`.trim(),
      });
      if (result) {
        onJobSubmitted?.({
          ...result,
          document_id: result.document_id || job?.document_id,
          workflow: result.workflow || (stage === "render" ? "render" : "book"),
        });
      }
      return result;
    } catch (cause) {
      setError(`${(cause as Error)?.message || cause || "重新处理失败"}`);
      throw cause;
    } finally {
      setPendingStage("");
    }
  }, [actions, job, jobId, onJobSubmitted, pendingStage, stageActions]);

  return {
    stageActions,
    loading: effectiveLoading,
    pendingStage,
    error,
    retry,
    refresh,
  };
}
