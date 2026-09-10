import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// StatusCard(Phase 3b job-runtime 域)组件级测试。覆盖蓝图 §6 新增测试⑤⑥:
// ⑤ StatusCard 契约(stage flow/substage/retry/result actions/data-status/
//    ring ids);⑥ 阶段选择语义(点击早期阶段不被后续无关渲染重置)。
// 走真实 mountJobRuntimeFeature 轮询链路(?mock=translate),不 mock fetch——
// 直接验证 statusCardPresenter 在 startPolling 同步链内写 store(蓝图风险 6:
// 首帧 placeholder,否则打开时闪空卡)与 renderPatch 三 source 收敛是否真的
// 端到端工作。

function makeDom(search) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  // Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
  // (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
  // animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
  // 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。NodeFilter
  // 是阶段 C(TranslationWorkflowDialog 换 Radix Dialog)新增的需要——
  // Dialog.Content 的 FocusScope 用它做可聚焦元素树遍历。
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function byId(dom, id) {
  return dom.window.document.getElementById(id);
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
  const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId(dom, "library-add-pdf-btn"), "HomeApp 首帧渲染");
  // 阶段 C(shadcn 改造):TranslationWorkflowDialog 换成 Radix Dialog 后不
  // forceMount Content——StatusCard/#job-status-card 嵌在这个对话框内部,只有
  // 对话框打开过才会挂载(同 CredentialsDialog 等阶段 C 第一批对话框的先例：
  // 关闭态不挂载)。这里直接调 workflowDialog.openUpload()(而非模拟点击"添加"
  // 按钮)让它挂载，不影响 startPolling 之后的轮询/渲染断言——真实用户流程里
  // "打开对话框→提交/恢复任务"本来就是先有对话框打开这一步。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "job-status-card"), "工作流对话框打开后 job-status-card 挂载");
  await wait(0);

  return { services, root, host };
}

test("StatusCard：DOM 契约 id 逐一存在(隐藏区 + ring + 阶段流)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);

  const contractIds = [
    "job-status-card", "cancel-btn", "status-detail-btn", "status-stage-flow",
    "status-ring-label", "status-ring-value", "status-ring-elapsed",
    "status-stage-detail", "status-stage-error-summary", "status-progress-bar",
    "job-progress-bar", "job-progress-text", "status-progress-percent",
    "status-progress-ring", "status-progress-ring-meta", "status-stage-retry",
    "job-id", "job-status", "job-stage-detail", "query-job-duration", "job-finished-at",
  ];
  for (const id of contractIds) {
    assert.ok(byId(dom, id), `契约 id 缺失：#${id}`);
  }
  assert.equal(byId(dom, "job-status-card").querySelectorAll(".status-stage-step[data-stage-key]").length, 4);
  assert.match(byId(dom, "cancel-btn").textContent, /取消任务/, "任务卡必须提供明确的取消入口");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard：真实轮询(mock=translate)驱动 ring/进度/阶段流(首帧不闪空卡)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());

  // startPolling 同步链内已经 renderJob(placeholder),不等待任何 await 就应
  // 该看到非空占位值(蓝图风险 6)。
  assert.notEqual(byId(dom, "status-ring-label").textContent.trim(), "");

  await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "准备中", "真实任务数据到达后 ring value 更新");
  await waitFor(() => {
    const activeStep = byId(dom, "status-stage-flow").querySelector('.status-stage-step[data-stage-key="translate"]');
    return activeStep?.classList.contains("is-active");
  }, "translate 阶段在流程条上高亮");

  const progressBlock = byId(dom, "job-status-card").querySelector(".status-progress-block");
  assert.equal(progressBlock.classList.contains("hidden"), false, "translate 阶段进度区块应可见");

  await waitFor(() => byId(dom, "job-status").textContent.trim() !== "idle", "隐藏区 job-status 摘要已更新(parallel smoke 依赖)");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard：阶段选择语义 + 重试 + 取消", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => {
    if (byId(dom, "job-status-card")?.dataset.currentStageKey !== "translate") return false;
    const activeStep = byId(dom, "job-status-card").querySelector('.status-stage-step[data-stage-key="translate"]');
    return activeStep?.classList.contains("is-active");
  }, "翻译阶段就位");
  await wait(50);
  assert.equal(byId(dom, "job-status-card").dataset.currentStageKey, "translate");

  // ---- 阶段选择:点击 ocr(index < translate,可选) → 选中态切换 ----
  const ocrStep = byId(dom, "job-status-card").querySelector('.status-stage-step[data-stage-key="ocr"]');
  assert.equal(ocrStep.disabled, false, "ocr 阶段已到达,应可选");
  click(dom, ocrStep);
  await waitFor(() => {
    const currentOcrStep = byId(dom, "job-status-card")
      .querySelector('.status-stage-step[data-stage-key="ocr"]');
    return currentOcrStep?.getAttribute("aria-selected") === "true"
      && byId(dom, "status-ring-label").textContent.trim() === "OCR";
  }, "点击 ocr 后当前状态卡选中态切换");
  assert.equal(
    byId(dom, "status-ring-label").textContent.trim(),
    "OCR",
    JSON.stringify({
      current: byId(dom, "job-status-card").dataset.currentStageKey,
      selected: byId(dom, "job-status-card").dataset.selectedStageKey,
      manual: byId(dom, "job-status-card").dataset.manualStageSelection,
    }),
  );

  // ---- 阶段选择语义:同一 job/同一 currentStageKey 下的无关渲染不应清掉手动选择 ----
  services.statusCard.store.actions.setCancelDisabled(false);
  await wait(30);
  assert.equal(ocrStep.getAttribute("aria-selected"), "true", "无关的 store 通知不应重置手动选择");

  // ---- 取消:点击后按钮应立即置灰(shellViewPort.setCancelDisabled 同步生效) ----
  const cancelButton = byId(dom, "cancel-btn");
  if (!cancelButton.disabled) {
    click(dom, cancelButton);
    await waitFor(() => cancelButton.disabled === true, "取消按钮点击后立即禁用");
    assert.match(cancelButton.textContent, /取消中/, "取消请求中必须反馈状态");
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusCard：重试按钮(mock stage-actions 数据到达后可点击并触发新一轮轮询)", async () => {
  const dom = makeDom("?mock=translate");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => {
    if (byId(dom, "job-status-card")?.dataset.currentStageKey !== "translate") return false;
    const retryButton = byId(dom, "job-status-card")
      ?.querySelector('.status-stage-retry-btn[data-retry-stage="translation"]');
    return retryButton && !retryButton.disabled;
  }, "translate 阶段的重试按钮就位(mock fetchJobStageActions 恒返回 translation 可重试)");
  await wait(50);

  const retryButton = byId(dom, "job-status-card")
    .querySelector('.status-stage-retry-btn[data-retry-stage="translation"]');
  assert.ok(retryButton, "重试按钮应存在");
  assert.equal(retryButton.disabled, false);
  assert.equal(retryButton.dataset.retryStage, "translation");

  let retryEventSeen = false;
  dom.window.document.addEventListener(APP_EVENTS.retryStage, (event) => {
    retryEventSeen = event.detail?.stage === "translation";
  });

  const previousJobId = services.features.jobRuntimeFeature.currentJobId();
  click(dom, retryButton);
  await waitFor(() => retryEventSeen, "点击重试按钮 dispatch retryStage 事件(蓝图 §5 事件契约)");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== previousJobId,
    "job-runtime 引擎消费 retryStage 后切换到新 job(mock retryJobStage 返回新 job_id)",
  );

  root.unmount();
  services.dispose();
  host.remove();
});
