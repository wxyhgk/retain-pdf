// AppUpdateBanner 的 DOM id 契约。
//
// 这些 id 被 tests/home/app-update-banner-component.test.mjs 按字面量断言
// （更新按钮、详情弹窗、状态行、重新检查按钮各一份，且全页唯一），
// 改名需同步该测试。状态枚举在 domain/app-update-states.ts。

export const APP_UPDATE_IDS = Object.freeze({
  button: "app-update-btn",
  dialog: "app-update-dialog",
  status: "app-update-status",
  checkButton: "app-update-check-btn",
});
