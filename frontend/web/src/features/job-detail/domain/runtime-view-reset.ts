// 把 StatusDetailDialog 的运行时/失败/事件三块视图打回初始态。
//
// 原在 src/js/features/app-shell/idle-reset.ts，与 initializeIdleAppView 同住一个
// 文件。按归属拆出来的依据：这里重置的 18 个 DOM id 全部登记在本功能的
// domain/status-detail-dom-ids.ts 里——runtime-*（runtime 段）、
// status-detail-job-id（headline.jobId）、failure-*（failure 段）、
// events-status（events.status）。一个也不属于主页外壳，所以真值应当归 job-detail。
//
// 两个消费方：
//   - app/home/composition/idle-view.ts（idle 首帧）
//   - features/jobs/domain/runtime/runtime-reset.ts（返回主页时清场），
//     它跨功能经 @/features/job-detail/index.js 取，不直连本文件。

type RuntimeViewResetPorts = {
  setText: (id: string, value: string) => void;
  resetEventsList: () => void;
  activateDetailTab: (name: string) => void;
};

export function resetStatusDetailRuntimeView({
  setText,
  resetEventsList,
  activateDetailTab,
}: RuntimeViewResetPorts) {
  setText("runtime-current-stage", "-");
  setText("runtime-stage-elapsed", "-");
  setText("runtime-total-elapsed", "-");
  setText("runtime-retry-count", "0");
  setText("runtime-last-transition", "-");
  setText("runtime-terminal-reason", "-");
  setText("runtime-input-protocol", "-");
  setText("runtime-stage-spec-version", "-");
  setText("runtime-math-mode", "-");
  setText("status-detail-job-id", "-");
  setText("failure-summary", "-");
  setText("failure-category", "-");
  setText("failure-stage", "-");
  setText("failure-root-cause", "-");
  setText("failure-suggestion", "-");
  setText("failure-last-log-line", "-");
  setText("failure-retryable", "-");
  setText("events-status", "全部事件");
  resetEventsList();
  activateDetailTab("overview");
}
