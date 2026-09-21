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

// 注意：@retainpdf/domain/job 另有一份同名实现，「没有恢复计划」时返回
// 「当前任务暂不可恢复。」。那一份不能拿来替掉这一份，反之亦然，见
// tests/architecture/domain-package-duplicate-exports.test.mjs 里锁住这条分叉的用例。
//
// 这一份只服务下面的 syncRerunAction，而那里的 `||` 需要一个「我没话可说」的信号：
// plan 为空但 actions.rerunEnabled && actions.rerun 时按钮是可点的，返回非空句子会
// 把 `||` 短路掉，于是按钮可点、旁边却写着「不可恢复」。空串还让 syncRerunAction 的
// 两条兜底跟 snapshot.ts 的 buildStatusDetailSnapshot 对齐——同一个 rerun.status
// 字段有这两个生产者，文案必须逐字相同。
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
      statusText: "当前任务暂不可从断点恢复（缺少恢复入口，请刷新后重试）。",
      viewPort,
      resolveActions,
    });
    // finally 语义：无入口也恢复可点，避免永久禁用。
    viewPort.setRerunDisabled(false);
    return;
  }
  try {
    const payload = await rerunJob(actionUrl);
    const nextJobId = firstJobIdFromPayload(payload);
    if (!nextJobId) {
      syncRerunAction({
        ...rerunContext,
        statusText: "恢复任务已提交，但响应中没有 job_id（请刷新后重试，或去详情页确认新任务）。",
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
  } finally {
    // 失败也恢复可点；成功时对话框已关闭且新轮询接管，解禁无副作用。
    viewPort.setRerunDisabled(false);
  }
}
