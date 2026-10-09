import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import type { PublishSubmitSuccessOptions } from "./contracts.js";
import { asJobPayload } from "./normalizers.js";

export function publishSubmitSuccess({
  payload,
  state,
  renderJob,
  syncCurrentJobSnapshot,
  startJobPolling,
  libraryEventPort,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  now = () => new Date().toISOString(),
}: PublishSubmitSuccessOptions = {}) {
  // 接进度→关框(成功链,顺序不可换):publish 创建事件→ sync 快照→ renderJob→
  // startJobPolling→ dispatch close→ 800ms 兜底 soft refresh→ 5s 强制对账刷新。
  // 成功→ 下一步;任一可选口缺失→ 跳过该步继续,不抛错;close 无监听→ 仅丢事件。
  // 创建事件已 insert+hydrate；不再 200/1500/4000 三次 force 整页刷（叠乘闪烁）
  libraryEventPort?.publishJobCreated?.(payload);
  const job = asJobPayload(payload);

  // 先让全局 job runtime 接管新任务，再关闭上传弹窗。关闭弹窗只影响展示，
  // 不会停止后台轮询；同时 close 事件会解除书库刷新挂起并触发一次投影对账。
  syncCurrentJobSnapshot?.(state, payload, job?.job_id || "", {
    startedAt: now(),
  });
  renderJob?.(payload);
  // 提交成功的回包一定带 job_id；没有就无从轮询。
  if (job?.job_id) startJobPolling?.(job.job_id);

  const EventCtor = documentRef?.defaultView?.CustomEvent || globalThis.CustomEvent;
  const closeWorkflowEvent = typeof EventCtor === "function"
    ? new EventCtor(APP_EVENTS.closeTranslationWorkflow)
    : { type: APP_EVENTS.closeTranslationWorkflow };
  documentRef?.dispatchEvent?.(closeWorkflowEvent as Event);

  // close 事件通常会在 300ms 后刷新；这一轮 soft refresh 是无 DOM 订阅者时的兜底，
  // scheduler 会合并/节流重复刷新，且此时 workflow 已不再处于 suspended 状态。
  // 返回取消函数：提交后卸载（极少见）可撤掉两路兜底，避免打到旧实例。
  const timerIds: number[] = [];
  const later = (handler: () => void, delay: number) => {
    const id = windowRef?.setTimeout?.(() => {
      handler();
    }, delay);
    if (typeof id === "number") timerIds.push(id);
  };
  later(() => {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: false });
  }, 800);
  // 兜底对账：后端建档/链文档可能慢于前 1 秒内的两次刷新（尤其同文件重传，
  // 文档行要等 active_job_id 落库）。5 秒后强制刷新一次，保证新任务可见，
  // 不用用户手动刷新。只此一次，不影响节流。
  later(() => {
    libraryEventPort?.requestRefresh?.({ delay: 0, force: true });
  }, 5000);
  return () => {
    for (const id of timerIds) windowRef?.clearTimeout?.(id);
    timerIds.length = 0;
  };
}
