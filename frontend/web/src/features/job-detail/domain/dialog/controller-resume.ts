// 断点续跑 / 重新运行：把 resume-actions 的纯逻辑接到 store 驱动的 resumeViewPort。
// 依赖只取 resume-actions + store/dialogStore + runtimePort。

import type { StatusDetailRuntimePort } from "../status-detail-runtime-port.js";
import type { StatusDetailStore } from "../status-detail-store.js";
import type { StatusDetailDialogStore } from "../status-detail-dialog-store.js";
import {
  rerunCurrentJob as rerunCurrentJobAction,
  syncRerunAction as syncRerunActionState,
} from "./resume-actions.js";
import type {
  JobActionResolver,
  StatusDetailResumeViewPort,
} from "./controller-types.js";

export function createStatusDetailResumeActions({
  runtimePort,
  store,
  dialogStore,
  rerunJob,
  retryTranslationWithRisk,
  setText,
  startPolling,
  resolveActions,
}: {
  runtimePort: StatusDetailRuntimePort;
  store: StatusDetailStore;
  dialogStore: StatusDetailDialogStore;
  rerunJob: (actionUrl: string) => Promise<unknown>;
  /** 409 翻译歧义被用户二次确认后，改走 retry-stage(translation) + accept_duplicate_risk。 */
  retryTranslationWithRisk?: (jobId: string) => Promise<unknown>;
  setText?: (id: string, message: string) => void;
  startPolling?: (jobId: string) => void;
  resolveActions: JobActionResolver;
}) {
  // ---- resume/rerun(resume-actions.js 保留;resumeViewPort 换 store 驱动,
  //      不再走 view.js 的 dialogComponent() DOM 查询) ----
  const resumeViewPort: StatusDetailResumeViewPort = {
    closeDialog: () => dialogStore.close(),
    setRerunAction: ({ enabled, status }: { enabled?: boolean; status?: string } = {}) => {
      store.actions.setOverview({ rerun: { enabled: Boolean(enabled), status: status || "" } });
    },
    setRerunDisabled: (disabled: boolean) => store.actions.setRerunPending(disabled),
  };

  function syncRerunAction(statusText = "") {
    return syncRerunActionState({
      ...runtimePort.rerunContext(),
      statusText,
      viewPort: resumeViewPort,
      resolveActions,
    });
  }

  // 「再点一次确认」只对弹出提示的那个任务有效；换了任务就作废，免得把确认带到别的任务上。
  let duplicateRiskJobId = "";

  async function rerunCurrentJob() {
    const rerunContext = runtimePort.rerunContext();
    const jobId = `${rerunContext?.job?.job_id || ""}`.trim();
    await rerunCurrentJobAction({
      rerunContext,
      rerunJob,
      setText,
      startPolling,
      viewPort: resumeViewPort,
      resolveActions,
      confirmDuplicateRisk: Boolean(jobId) && duplicateRiskJobId === jobId,
      retryTranslationWithRisk,
      onDuplicateRiskPending: (pending: boolean) => {
        duplicateRiskJobId = pending ? jobId : "";
      },
    });
  }

  return { syncRerunAction, rerunCurrentJob };
}
