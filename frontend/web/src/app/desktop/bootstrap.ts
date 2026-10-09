import { loadPersistedConfig } from "@/platform/config/desktop-persistence.js";
import {
  applyDefaultCredentialInputs,
  hasDesktopCredentials,
} from "@/features/credentials/domain.js";
import { desktopBootstrapState as state } from "@/platform/desktop/state.js";
import {
  setDesktopConfigured,
  setDesktopMode,
  setDeveloperConfig,
  isDesktopConfigured,
} from "@/platform/desktop/state.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";

export function showDesktopUi() {
  document.getElementById("open-output-btn")?.classList.remove("hidden");
}

export function openSetupDialog() {
  document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials, {
    detail: { setupMode: true },
  }));
}

export async function bootstrapDesktop(initialConfig = null) {
  setDesktopMode(state, true);
  showDesktopUi();
  const payload = initialConfig || await loadPersistedConfig();
  setDeveloperConfig(state, payload.developerConfig || {});
  applyDefaultCredentialInputs(payload.browserConfig || {});
  // 不只看 firstRunCompleted：那个布尔只在「首配门里保存」时才写，从设置中心
  // 保存不写、配置文件重建也会丢，于是 Key 明明都在也每次启动被拦一道。凭据
  // 齐全本身就是已配置，这样现有装机下次启动就自愈，不必再存一遍。
  setDesktopConfigured(
    state,
    Boolean(payload.firstRunCompleted) || hasDesktopCredentials(payload.browserConfig),
  );
  if (!isDesktopConfigured(state)) {
    openSetupDialog();
  }
  // 原先 else 分支调 closeSetupDialog()「已配置就关掉可能开着的首配窗」。
  // 那个函数判的是 `dialog.open`——凭据弹窗 React 化后是 Radix 的
  // <DialogContent>（渲染成 div，没有 .open 属性），条件恒为假，从未生效。
  // 且到这一步弹窗只可能由本函数的 openSetupDialog() 打开，不存在要关的窗。
  // 若将来确有该场景，正确做法是走 credentialsDialogStore 而不是 DOM 查找。
}

