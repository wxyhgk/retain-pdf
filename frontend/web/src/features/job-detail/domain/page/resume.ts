import { firstJobIdFromPayload, firstNonEmpty as firstNonEmptyText } from "@retainpdf/domain/job";
import { buildDetailPageUrl } from "./routing.js";
import { isPageQuotaError, retryJobStage } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { JobDetailPageState } from "./page-state.js";
import type { DetailSetText } from "./page-ports.js";
import type { createJobDetailResumePort } from "./resume-port.js";

type JobDetailResumePort = ReturnType<typeof createJobDetailResumePort>;

export { summarizeResumePlan } from "@retainpdf/domain/job";

export function bindRerunButton({
  detailPageState,
  getJobId,
  resumePort,
  setText,
}: {
  detailPageState: JobDetailPageState;
  getJobId: () => string;
  resumePort: JobDetailResumePort;
  setText: DetailSetText;
}) {
  const button = document.getElementById("detail-rerun-btn") as HTMLButtonElement | null;
  button?.addEventListener("click", async () => {
    const jobId = detailPageState.job?.job_id || getJobId();
    const actionUrl = `${detailPageState.rerunActionUrl || ""}`.trim();
    if (!button || (!jobId && !actionUrl)) {
      setText("detail-rerun-status", "当前任务暂不可从断点恢复。");
      return;
    }
    // 409 后的二次确认走同一按钮的两步态（整页无 React，不用 ConfirmDialog）：
    // 首击 409 → 按钮变“确认仍要重试”，再击执行。其他路径清确认态。
    if (button.dataset?.confirmRisk === "1") {
      button.disabled = true;
      await retryTranslationWithRisk({ button, jobId, setText });
      return;
    }
    button.disabled = true;
    setText("detail-rerun-status", "正在提交恢复任务...");
    try {
      const payload = await resumePort.submit({ actionUrl, jobId });
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
        setText("detail-rerun-status", "恢复任务已提交，但响应中没有 job_id。");
        return;
      }
      setText("detail-rerun-status", `已创建恢复任务 ${nextJobId}，正在跳转...`);
      window.location.href = buildDetailPageUrl(nextJobId);
    } catch (error) {
      const message = (error as { message?: string } | null)?.message || String(error);
      // 409 翻译歧义：通用重跑被后端暂停，直接报死用户就卡住了。
      // 给出路：二次确认重复风险后，用 retry-stage(translation) 显式重跑。
      // 额度不够的原话里可能带「1409 页」这种数字，别误判成 409。
      if (!isPageQuotaError(error) && /409|ambiguous/i.test(message)) {
        setText("detail-rerun-status", "检测到重复翻译风险：重跑可能产生重复费用/产物。再点一次按钮确认仍要从翻译阶段重试。");
        if (button.dataset) button.dataset.confirmRisk = "1";
        button.disabled = false;
        return;
      }
      setText("detail-rerun-status", message);
      if (button.dataset) button.dataset.confirmRisk = "";
      button.disabled = false;
    }
  });
}

async function retryTranslationWithRisk({
  button,
  jobId,
  setText,
}: {
  button: HTMLButtonElement;
  jobId: string;
  setText: DetailSetText;
}) {
  const clearConfirm = () => { if (button.dataset) button.dataset.confirmRisk = ""; };
  try {
    setText("detail-rerun-status", "已确认风险，正在从翻译阶段重试...");
    const retried = await retryJobStage(jobId, API_PREFIX, "translation", {
      ambiguous_request_policy: "accept_duplicate_risk",
    });
    const retryJobId = `${retried?.job_id || ""}`.trim();
    if (!retryJobId) {
      setText("detail-rerun-status", "重试已提交，但响应中没有 job_id。");
      clearConfirm();
      button.disabled = false;
      return;
    }
    setText("detail-rerun-status", `已创建重试任务 ${retryJobId}，正在跳转...`);
    window.location.href = buildDetailPageUrl(retryJobId);
    return;
  } catch (retryError) {
    setText("detail-rerun-status", (retryError as { message?: string } | null)?.message || String(retryError));
    clearConfirm();
    button.disabled = false;
    return;
  }
}

