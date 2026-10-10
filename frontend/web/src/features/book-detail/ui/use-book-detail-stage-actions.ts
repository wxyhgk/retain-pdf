import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  JobRetryStage,
  JobStageActionsView,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { fetchJobPayload } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import { resolveTranslationOwnerId, type TranslationSourceView } from "../domain/translation-owner.js";
import type { LibraryController } from "@/features/library/index.js";
import { isDocumentJobActive } from "./use-document-jobs.js";

type RetryBody = Record<string, unknown> & {
  overrides?: Record<string, unknown> & { render?: Record<string, unknown> };
};

// job_id -> stage-actions 视图。跨文档/跨弹窗复用，但必须有上限，避免长会话无限增长。
const STAGE_ACTIONS_CACHE_LIMIT = 200;
const stageActionsCache = new Map<string, JobStageActionsView>();

function rememberStageActions(jobId: string, view: JobStageActionsView) {
  stageActionsCache.delete(jobId);
  stageActionsCache.set(jobId, view);
  while (stageActionsCache.size > STAGE_ACTIONS_CACHE_LIMIT) {
    const oldest = stageActionsCache.keys().next().value;
    if (oldest === undefined) break;
    stageActionsCache.delete(oldest);
  }
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
  readJob = (id: string) => fetchJobPayload(id, { apiPrefix: API_PREFIX }) as Promise<TranslationSourceView>,
}: {
  open: boolean;
  job?: DocumentJobSummary | null;
  actions: Pick<LibraryController, "getJobStageActions" | "retryJobStage">;
  onJobSubmitted?: (job: Partial<DocumentJobSummary>) => unknown;
  /** OCR/document authority changed while the translation job stayed the same. */
  refreshKey?: string;
  /** 读任务详情（找译文持有者用）；测试替身用，默认走平台接口。 */
  readJob?: (jobId: string) => Promise<TranslationSourceView | null | undefined>;
}) {
  const baseJobId = jobIdOf(job);
  // 底是渲染任务时，先顺着 source_artifact_job_id 找到真正持有译文的任务，重新处理都发给它
  // （见 domain/translation-owner.ts）。找到之前不读阶段动作，免得先闪出一句「不能精修」。
  const needsOwner = Boolean(
    open && baseJobId && !isDocumentJobActive(job) && `${job?.workflow || ""}`.trim().toLowerCase() === "render",
  );
  const [owner, setOwner] = useState<{ base: string; owner: string } | null>(null);
  useEffect(() => {
    if (!needsOwner) return undefined;
    let cancelled = false;
    resolveTranslationOwnerId(baseJobId, readJob)
      .then((ownerId) => { if (!cancelled) setOwner({ base: baseJobId, owner: ownerId }); })
      // 找不到就退回原任务：后端会给出不可用原因，不至于整块消失。
      .catch(() => { if (!cancelled) setOwner({ base: baseJobId, owner: baseJobId }); });
    return () => { cancelled = true; };
    // readJob 是可替换的依赖，每次渲染新建引用不应重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOwner, baseJobId]);
  const resolvingOwner = needsOwner && owner?.base !== baseJobId;
  const jobId = needsOwner ? (owner?.base === baseJobId ? owner.owner : "") : baseJobId;
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
        if (next) rememberStageActions(jobId, next);
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
    const supported = new Set(["translation", "render", "refine"]);
    return (currentView?.stages || []).filter(
      (action): action is JobStageRetryActionView => supported.has(`${action?.stage || ""}`),
    );
  }, [currentView]);
  const effectiveLoading = resolvingOwner || (eligible && !currentView && resolvedJobId !== jobId)
    ? true
    : loading;

  const retry = useCallback(async (
    stage: JobRetryStage,
    { acceptDuplicateRisk = false, renderEngine = "", refineStartPage }: {
      acceptDuplicateRisk?: boolean;
      renderEngine?: string;
      /** 接着精修：从这一页开始（上次精修没审到的第一页）。 */
      refineStartPage?: number;
    } = {},
  ) => {
    const descriptor = stageActions.find((action) => action.stage === stage);
    if (!descriptor?.can_retry || !actions.retryJobStage || pendingStage) return null;
    setPendingStage(stage);
    setError("");
    try {
      // 清单里的每个按钮只做它写的那件事（显式 retry-stage）。「从断点继续」由失败卡片上的
      // 主按钮负责（use-book-detail-resume.ts）。以前这里失败任务一律先试 POST /resume：
      // 那条请求少了接口前缀、一直 404 才被降级成显式重跑；前缀修好之后，点「重新渲染」
      // 会按续跑计划去重新翻译，和按钮说的不是一回事。
      const engineOverride = stage === "render" && (renderEngine === "rpr_fit" || renderEngine === "typst")
        ? renderEngine
        : "";
      const body = (descriptor.action?.body || {}) as RetryBody;
      const result = await actions.retryJobStage(jobId, stage, {
        ...body,
        // 不指定引擎时沿用任务原来的引擎（后端保留 render.engine）。
        ...(engineOverride
          ? {
            overrides: {
              ...(body.overrides || {}),
              render: { ...(body.overrides?.render || {}), engine: engineOverride },
            },
          }
          : {}),
        // 精修在原任务上原地跑（不新建任务、不重翻），后端默认整本 review_and_fix。
        ...(stage === "refine" ? { create_new_job: false } : {}),
        ...(stage === "refine" && refineStartPage
          ? { refine: { ...((body.refine as Record<string, unknown>) || {}), start_page: refineStartPage } }
          : {}),
        ...(acceptDuplicateRisk
          ? { ambiguous_request_policy: "accept_duplicate_risk" }
          : {}),
        document_id: `${job?.document_id || ""}`.trim(),
      });
      if (result) {
        onJobSubmitted?.({
          ...result,
          document_id: result.document_id || job?.document_id,
          workflow: result.workflow || (stage === "render" || stage === "refine" ? "render" : "book"),
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
