import {
  firstNonEmptyText,
} from "./formatters.js";

function firstJobIdFromPayload(payload) {
  return firstNonEmptyText(
    payload?.job_id,
    payload?.data?.job_id,
    payload?.job?.job_id,
    payload?.job?.id,
    payload?.id,
  );
}

export function summarizeResumePlan(plan) {
  if (!plan) {
    return "";
  }
  if (!plan.can_resume) {
    return plan.reason || "Tác vụ hiện chưa thể khôi phục từ điểm dừng.";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
  const bits = [`Có thể khôi phục từ ${fromStage}`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`chạy lại ${reruns}`);
  }
  return bits.join("，");
}

export function syncRerunAction({
  job = null,
  resumePlan = null,
  statusText = "",
  viewPort,
  resolveActions = () => ({}),
}: any = {}) {
  const actions = job ? resolveActions(job) : {};
  const enabled = Boolean(resumePlan?.can_resume || (actions.rerunEnabled && actions.rerun));
  viewPort.setRerunAction({
    enabled,
    status: statusText || (enabled
      ? summarizeResumePlan(resumePlan) || "Backend hỗ trợ tạo tác vụ khôi phục từ artifact của tác vụ hiện tại."
      : summarizeResumePlan(resumePlan) || "Tác vụ hiện chưa thể khôi phục từ điểm dừng."),
  });
  return actions.rerun || "";
}

export async function rerunCurrentJob({
  rerunContext,
  rerunJob,
  setText,
  startPolling,
  viewPort,
  resolveActions = () => ({}),
}: any = {}) {
  const actionUrl = syncRerunAction({
    ...rerunContext,
    statusText: "Đang gửi tác vụ khôi phục...",
    viewPort,
    resolveActions,
  });
  viewPort.setRerunDisabled(true);
  if (!actionUrl) {
    syncRerunAction({
      ...rerunContext,
      statusText: "Tác vụ hiện chưa thể khôi phục từ điểm dừng.",
      viewPort,
      resolveActions,
    });
    return;
  }
  try {
    const payload = await rerunJob(actionUrl);
    const nextJobId = firstJobIdFromPayload(payload);
    if (!nextJobId) {
      syncRerunAction({
        ...rerunContext,
        statusText: "Đã gửi tác vụ khôi phục nhưng phản hồi không có job_id.",
        viewPort,
        resolveActions,
      });
      return;
    }
    viewPort.closeDialog();
    setText?.("error-box", `Đã tạo tác vụ khôi phục ${nextJobId}, bắt đầu poll.`);
    startPolling?.(nextJobId);
  } catch (error) {
    syncRerunAction({
      ...rerunContext,
      statusText: error.message || String(error),
      viewPort,
      resolveActions,
    });
  }
}
