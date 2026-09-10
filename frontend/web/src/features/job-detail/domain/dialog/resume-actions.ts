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
    return plan.reason || "当前任务暂不可从断点恢复。";
  }
  const fromStage = firstNonEmptyText(plan.from_stage, plan.resume_from, "checkpoint");
  const workflow = firstNonEmptyText(plan.resume_workflow, plan.workflow);
  const reruns = Array.isArray(plan.reruns_stages) ? plan.reruns_stages.join("、") : "";
  const bits = [`可从 ${fromStage} 恢复`];
  if (workflow) {
    bits.push(`workflow=${workflow}`);
  }
  if (reruns) {
    bits.push(`重跑 ${reruns}`);
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
      ? summarizeResumePlan(resumePlan) || "后端支持从当前任务产物创建恢复任务。"
      : summarizeResumePlan(resumePlan) || "当前任务暂不可从断点恢复。"),
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
    statusText: "正在提交恢复任务...",
    viewPort,
    resolveActions,
  });
  viewPort.setRerunDisabled(true);
  if (!actionUrl) {
    syncRerunAction({
      ...rerunContext,
      statusText: "当前任务暂不可从断点恢复。",
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
        statusText: "恢复任务已提交，但响应中没有 job_id。",
        viewPort,
        resolveActions,
      });
      return;
    }
    viewPort.closeDialog();
    setText?.("error-box", `已创建恢复任务 ${nextJobId}，开始轮询。`);
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
