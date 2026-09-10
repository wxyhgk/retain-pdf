// 失败 tab 的"从断点恢复/重新运行"按钮绑定(蓝图 §1.2)。resume-actions.js
// (kept)已经把 enabled/status 算好写进 overview.rerun,这里只做
// disabled = !enabled || rerunPending 的组合与点击派发,不重复计算。

export function useRerunAction({ overview, rerunPending, controller }) {
  const rerun = overview.rerun || { enabled: false, status: "" };
  return {
    enabled: Boolean(rerun.enabled),
    status: rerun.status || "",
    disabled: !rerun.enabled || Boolean(rerunPending),
    run: () => controller.rerunCurrentJob(),
  };
}
