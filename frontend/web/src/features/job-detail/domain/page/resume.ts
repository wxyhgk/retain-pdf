import { firstJobIdFromPayload, firstNonEmpty as firstNonEmptyText } from "@retainpdf/domain/job";
import { buildDetailPageUrl } from "./routing.js";
import { retryJobStage } from "@retainpdf/api/jobs-actions";
import { API_PREFIX } from "@/platform/config/api-constants.js";

export { summarizeResumePlan } from "@retainpdf/domain/job";

export function bindRerunButton({
  detailPageState,
  getJobId,
  resumePort,
  setText,
}) {
  document.getElementById("detail-rerun-btn")?.addEventListener("click", async () => {
    const button = document.getElementById("detail-rerun-btn") as any;
    const jobId = detailPageState.job?.job_id || getJobId();
    const actionUrl = `${detailPageState.rerunActionUrl || ""}`.trim();
    if (!button || (!jobId && !actionUrl)) {
      setText("detail-rerun-status", "当前任务暂不可从断点恢复。");
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
      const message = error.message || String(error);
      // 409 翻译歧义：通用重跑被后端暂停，直接报死用户就卡住了。
      // 给出路：二次确认重复风险后，用 retry-stage(translation) 显式重跑。
      if (/409|ambiguous/i.test(message)) {
        const ok = typeof window !== "undefined" && typeof window.confirm === "function"
          ? window.confirm("检测到重复翻译风险：重跑可能产生重复费用/产物。确认仍要从翻译阶段重试吗？")
          : false;
        if (ok) {
          try {
            setText("detail-rerun-status", "已确认风险，正在从翻译阶段重试...");
            const retried: any = await retryJobStage(jobId, API_PREFIX, "translation", {
              ambiguous_request_policy: "accept_duplicate_risk",
            });
            const retryJobId = `${retried?.job_id || ""}`.trim();
            if (!retryJobId) {
              setText("detail-rerun-status", "重试已提交，但响应中没有 job_id。");
              return;
            }
            setText("detail-rerun-status", `已创建重试任务 ${retryJobId}，正在跳转...`);
            window.location.href = buildDetailPageUrl(retryJobId);
            return;
          } catch (retryError) {
            setText("detail-rerun-status", retryError.message || String(retryError));
            button.disabled = false;
            return;
          }
        }
      }
      setText("detail-rerun-status", message);
      button.disabled = false;
    }
  });
}
