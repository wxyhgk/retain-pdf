// 更新检查的状态枚举。与 DOM 无关，故归 domain：
// 按钮的 id/class 契约在 ui/app-update-contract.ts。

export const APP_UPDATE_STATES = Object.freeze({
  checking: "checking",
  idle: "idle",
  available: "available",
  latest: "latest",
  error: "error",
});
