import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// HomeApp(Phase 3a:app-shell / upload / workflow 三域 React 骨架)组件级测试。
// 校验:DOM 契约 id 逐一存在、idle 复位链落 store、工作流对话框开合的
// APP_EVENTS 契约(蓝图风险 5)、错误盒 setText 通道、页码区间约束、
// 状态区可见性 → 对话框模式同步、3b 回调桥接口定型。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
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
// 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");
const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

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

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  // Radix Tabs 的 Trigger 激活逻辑挂在 onMouseDown(不是 onClick)——
  // LibraryTopTabs(分类改造)是本文件第一处 Radix Tabs,补上 mousedown 让
  // 模拟点击贴近真实交互(同 status-detail-dialog-component.test.mjs 的
  // 既有先例),对纯 <button> 元素无影响。
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

// 控制端输入:绕开 React 的 value 追踪,用原生 setter 写入再冒泡 input
function typeInput(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function createServices() {
  return createHomeComposition({
    fetchGlossaries: async () => ({
      items: [{ glossary_id: "g-1", name: "术语表甲", entry_count: 3 }],
    }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
}

test("HomeApp：契约 id、idle 链、工作流对话框事件契约与交互", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const events = { open: 0, close: 0 };
  dom.window.document.addEventListener(APP_EVENTS.openTranslationWorkflow, () => { events.open += 1; });
  dom.window.document.addEventListener(APP_EVENTS.closeTranslationWorkflow, () => { events.close += 1; });

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  // React 18 的 useSyncExternalStore 订阅落在 passive effect 里；首帧 DOM
  // 提交（上面的 waitFor 已满足）与订阅真正生效之间有一拍时间差——jsdom 下
  // 没有 act() 自动 flush passive effects，这里让出一个宏任务，确保
  // dialog/statusArea 等 store 的订阅已建立，避免下面的首次交互在订阅生效
  // 前触发 store 变更而被错过（表现为「工作流对话框打开」等待超时）。
  await wait(0);

  // ---- DOM 契约:顶层 + 常驻挂载区块逐一存在 ----
  // 注意:"translation-workflow-dialog"及其内部整个 job-form 家族(job-form/
  // ocr_provider/.../status-section/job-status-card)、"app-update-dialog"/
  // "app-update-status"/"app-update-check-btn"、"page-range-dialog"及其内部
  // 契约 id 都不在这个列表里——阶段 C(shadcn 改造)后 TranslationWorkflowDialog/
  // SettingsHubDialog/AppUpdateBanner/PageRangeDialog 换成 Radix Dialog,不
  // forceMount Content,这些 id 挂在各自 Content 子树下,只有对应对话框被
  // 打开过之后才存在于 DOM(此前原生 <dialog> 或 bespoke <div> 是常驻挂载,
  // 只是显示态切换)。它们的存在性挪到下面分别打开对话框后再断言。
  const contractIds = [
    // app-shell
    "app-shell", "developer-btn", "open-output-btn",
    // library 骨架(3b 占位)
    "library-view", "recent-jobs-scroll-body", "recent-jobs-summary", "recent-jobs-empty",
    "library-grid", "recent-jobs-list", "load-more-jobs-btn", "open-query-btn", "library-search-input",
    "library-add-pdf-btn", "app-settings-btn",
  ];
  for (const id of contractIds) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }

  // ---- app-update-* 三个契约 id:"app-update-btn" 挂在 SettingsHubDialog
  //      Content 下(TabsPrimitive.Content 的 forceMount 让"更新"tab 面板即使
  //      非激活也常驻挂载,只是 hidden),打开设置对话框即存在;
  //      "app-update-dialog"/"app-update-status"/"app-update-check-btn" 则是
  //      AppUpdateBanner 自己的详情 dialog 内容(阶段 C 换血后不
  //      forceMount),还需要点一次"检查更新"按钮才会挂载。 ----
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-update-btn"), "设置对话框打开后 app-update-btn 挂载");
  click(byId("app-update-btn"));
  await waitFor(() => byId("app-update-dialog"), "点击检查更新后 app-update-dialog 挂载");
  for (const id of ["app-update-status", "app-update-check-btn"]) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }
  services.settingsHub.dialogStore.close();
  await waitFor(() => byId("app-update-dialog") === null, "关闭设置对话框");

  // ---- 打开:添加按钮 → dispatch openTranslationWorkflow → 对话框开(第一次
  //      打开,同时挂载 job-form 家族 + job-status-card 契约 id) ----
  assert.equal(byId("translation-workflow-dialog"), null, "初始未打开时不挂载");
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "工作流对话框打开");
  let dialog = byId("translation-workflow-dialog");
  assert.equal(events.open, 1, "打开必须经 APP_EVENTS.openTranslationWorkflow(3b 刷新挂起依赖)");
  assert.equal(dialog.dataset.open, "1");
  assert.equal(dialog.classList.contains("is-upload-mode"), true);
  assert.equal(byId("translation-workflow-title").textContent, "添加 PDF");
  assert.equal(byId("translation-workflow-title").classList.contains("sr-only"), true, "上传标题只供无障碍读取");
  assert.equal(byId("translation-workflow-desc"), null, "上传副标题不再渲染");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), true);
  await waitFor(() => byId("library-add-pdf-btn").getAttribute("aria-expanded") === "true", "触发按钮 aria 同步");
  assert.equal(byId("library-add-pdf-btn").dataset.workflowOpen, "1");

  // ---- job-form 家族 + status 区占位契约 id(挂在工作流对话框内部,只有打开
  //      过才存在于 DOM) ----
  const workflowContractIds = [
    "translation-workflow-close-btn", "job-warning",
    "job-form", "ocr_provider", "paddle_token",
    "file", "upload-fill", "credential-gate", "credential-gate-title", "credential-gate-help", "credential-gate-action",
    "upload-glyph", "file-label", "upload-help", "upload-status", "upload-progress-panel", "upload-progress-text",
    "translation-budget-note",
    "ocr-only-toggle", "upload-action-slot",
    "page-range-btn", "store-only-btn", "submit-btn", "error-box-inline",
    "status-section", "job-status-card",
  ];
  for (const id of workflowContractIds) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }

  // ---- 翻译选项是主弹窗内的可展开面板，不再打开第二层 Dialog。点击
  //      #page-range-btn 后挂载，收起按钮点击后卸载。 ----
  assert.equal(byId("page-range-dialog"), null, "初始未打开时不挂载");
  click(byId("page-range-btn"));
  await waitFor(() => byId("page-range-dialog") !== null, "行内翻译选项展开");
  for (const id of [
    "page-range-title", "page-range-limit-text", "page-range-start", "page-range-end", "job-glossary-id",
    "page-range-close-btn", "page-range-clear-btn", "page-range-apply-btn",
  ]) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }
  click(byId("page-range-close-btn"));
  await waitFor(() => byId("page-range-dialog") === null, "收起按钮点击后选项卸载");

  // ---- idle 复位链:上传瓦片回到默认态,提交按钮置灰 ----
  assert.equal(byId("file-label").textContent, "点击选择文件或拖到这里");
  assert.equal(byId("upload-help").textContent, "选择 PDF 后，可选择仅收藏、仅 OCR 或翻译。");
  assert.equal(byId("submit-btn").disabled, true);
  assert.equal(byId("submit-btn").textContent.trim(), "直接翻译");
  assert.equal(byId("job-warning").classList.contains("hidden"), true);
  assert.equal(byId("status-section").classList.contains("hidden"), true);

  // ---- 模式切换只改变工作流，不替换上传说明。长短不同的说明会让
  //      上传卡和外层 Dialog 在翻译 / OCR 间发生 18px 高度抖动。 ----
  const translateModeTab = dom.window.document.querySelector('[role="tab"][aria-label="翻译模式"]');
  const ocrModeTab = dom.window.document.querySelector('[role="tab"][aria-label="仅 OCR 模式"]');
  assert.ok(translateModeTab);
  assert.ok(ocrModeTab);
  click(ocrModeTab);
  await waitFor(() => byId("submit-btn").textContent.trim() === "开始 OCR", "切换到仅 OCR 模式");
  assert.equal(byId("upload-help").textContent, "选择 PDF 后，可选择仅收藏、仅 OCR 或翻译。");
  click(translateModeTab);
  await waitFor(() => byId("submit-btn").textContent.trim() === "直接翻译", "切回翻译模式");
  assert.equal(byId("upload-help").textContent, "选择 PDF 后，可选择仅收藏、仅 OCR 或翻译。");

  // ---- setText("error-box") 通道:inline-error-box 显隐(对话框仍处于打开
  //      状态,元素挂载中) ----
  services.bridge.setText("error-box", "上传通道异常");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === false, "错误盒显示");
  assert.match(byId("error-box-inline").textContent, /上传通道异常/);
  services.bridge.setText("error-box", "-");
  await waitFor(() => byId("error-box-inline").classList.contains("hidden") === true, "错误盒隐藏");

  // ---- 页码区间:上传态就位后展开翻译选项,输入越界被约束 ----
  services.ports.uploadStatePort.setUpload({ uploadId: "u-1", uploadedPageCount: 10 });
  services.features.uploadFeature.renderPageRangeSummary();
  click(byId("page-range-btn"));
  await waitFor(() => byId("page-range-start") !== null, "页码区间显示");
  typeInput(byId("page-range-start"), "99");
  await waitFor(() => byId("page-range-start").value === "10", "起始页被约束到总页数");

  // ---- 状态区可见性 → 对话框模式同步(statusAreaVisibilityChanged 契约,
  //      对话框全程保持打开,不需要重新点击"添加") ----
  services.bridge.setWorkflowSections({ job_id: "job-1", status: "running" });
  await waitFor(() => byId("status-section").classList.contains("hidden") === false, "状态区显示");
  await waitFor(() => dialog.classList.contains("is-status-mode"), "对话框切到状态模式");
  assert.equal(byId("translation-workflow-title").textContent, "任务进度");
  assert.equal(byId("translation-workflow-title").classList.contains("sr-only"), false, "任务进度标题保持可见");
  services.bridge.setWorkflowSections(null);
  await waitFor(() => byId("status-section").classList.contains("hidden") === true, "状态区隐藏");
  await waitFor(() => dialog.classList.contains("is-upload-mode"), "对话框回到上传模式");

  // ---- 状态模式下点 × = 一次点击直接关闭(不再是两段式:不 returnHome、不
  //      弹回上传表单;中止任务由 StatusCard 的"取消任务"按钮负责) ----
  services.bridge.setWorkflowSections({ job_id: "job-2", status: "running" });
  await waitFor(() => dialog.classList.contains("is-status-mode"), "回到状态模式");
  let returnHomeCount = 0;
  dom.window.document.addEventListener(APP_EVENTS.returnHome, () => { returnHomeCount += 1; });
  const closesBefore = events.close;
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "状态模式点 × 直接关闭对话框");
  assert.equal(returnHomeCount, 0, "状态模式关闭不应再走 returnHome(两段式已废除)");
  assert.equal(events.close, closesBefore + 1, "状态模式关闭应 dispatch 一次 closeTranslationWorkflow");
  assert.equal(dom.window.document.documentElement.classList.contains("translation-workflow-open"), false);

  // ---- Escape 关闭路径(重新打开→Escape,验证 Escape 也一次到位、且经
  //      closeTranslationWorkflow 事件,3b 库刷新恢复依赖) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "再次打开(上传态)");
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await waitFor(() => byId("translation-workflow-dialog") === null, "Escape 关闭对话框");
  assert.equal(events.close, closesBefore + 2, "Escape 关闭必须经 APP_EVENTS.closeTranslationWorkflow");

  // ---- 关闭按钮路径(重新打开后走关闭按钮;顺带验证 openUpload 的会话复位) ----
  click(byId("library-add-pdf-btn"));
  await waitFor(() => byId("translation-workflow-dialog") !== null, "再次打开");
  // openUpload 会复位上传会话(uploadId 清空)
  assert.equal(services.ports.uploadStatePort.getSnapshot().uploadId, "");
  dialog = byId("translation-workflow-dialog");
  click(byId("translation-workflow-close-btn"));
  await waitFor(() => byId("translation-workflow-dialog") === null, "关闭按钮关闭对话框");
  assert.equal(events.close, closesBefore + 3);

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp：顶部图书馆/合集/收藏/AI 分栏 + 分类管理对话框", async () => {
  const host = dom.window.document.createElement("div");
  host.id = "home-root-categories";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  await wait(0);

  // ---- 分栏契约:四个 tab 都在,任务入口已移除,默认落在图书馆 ----
  assert.ok(byId("library-top-tab-library"), "契约 id 缺失：#library-top-tab-library");
  assert.ok(byId("library-top-tab-categories"), "契约 id 缺失：#library-top-tab-categories");
  assert.ok(byId("library-top-tab-favorites"), "契约 id 缺失：#library-top-tab-favorites");
  assert.equal(byId("library-top-tab-tasks"), null, "主页顶栏不应再显示任务 tab");
  assert.ok(byId("library-top-tab-ask"), "契约 id 缺失：#library-top-tab-ask");
  assert.ok(byId("library-view"), "默认应停在图书馆视图");
  assert.equal(byId("categories-view"), null, "默认不挂载合集视图");
  assert.equal(byId("favorites-view"), null, "默认不挂载收藏视图");
  assert.equal(byId("task-center-view"), null, "默认不挂载任务中心");
  assert.equal(byId("home-ask-view"), null, "默认不挂载 AI 问答视图");
  assert.ok(byId("library-search-input"), "图书馆 tab 下搜索框应可见");

  // ---- 切到合集:图书馆网格卸载,合集视图挂载,搜索框隐藏 ----
  click(byId("library-top-tab-categories"));
  await waitFor(() => byId("categories-view") !== null, "合集视图挂载");
  assert.equal(byId("library-view"), null, "切到合集后图书馆视图应卸载");
  assert.equal(byId("favorites-view"), null, "合集 tab 下不挂载收藏视图");
  assert.equal(byId("library-search-input"), null, "合集 tab 下搜索框应隐藏");
  assert.ok(byId("categories-create-btn"), "契约 id 缺失：#categories-create-btn");

  // ---- 新建合集对话框:挂载/契约 id/关闭卸载 ----
  assert.equal(byId("collection-manage-dialog"), null, "初始未打开时不挂载");
  click(byId("categories-create-btn"));
  await waitFor(() => byId("collection-manage-dialog") !== null, "合集管理对话框打开");
  for (const id of ["collection-name-input", "collection-manage-close-btn", "collection-save-btn"]) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }
  assert.equal(byId("collection-delete-btn"), null, "新建模式不应有删除按钮");
  click(byId("collection-manage-close-btn"));
  await waitFor(() => byId("collection-manage-dialog") === null, "关闭按钮点击后对话框卸载");

  // ---- 切到收藏:合集卸载,收藏视图挂载,搜索框仍隐藏 ----
  click(byId("library-top-tab-favorites"));
  await waitFor(() => byId("favorites-view") !== null, "收藏视图挂载");
  assert.equal(byId("categories-view"), null, "切到收藏后合集视图应卸载");
  assert.equal(byId("library-view"), null, "收藏 tab 下图书馆视图应卸载");
  assert.equal(byId("library-search-input"), null, "收藏 tab 下搜索框应隐藏");
  // 加载中 / 空态 / 列表 / 错误 四者之一
  await waitFor(
    () => byId("favorites-loading") || byId("favorites-empty") || byId("favorites-list") || byId("favorites-error"),
    "收藏视图应进入 loading/空态/列表/错误之一",
  );

  // ---- 切到 AI 问答:收藏卸载,AI 视图挂载 ----
  click(byId("library-top-tab-ask"));
  await waitFor(() => byId("home-ask-view") !== null, "AI 问答视图挂载");
  assert.equal(byId("favorites-view"), null, "AI tab 下收藏视图应卸载");
  assert.equal(byId("task-center-view"), null, "AI tab 下任务中心应卸载");
  assert.equal(byId("library-view"), null, "AI tab 下图书馆视图应卸载");
  assert.equal(byId("library-search-input"), null, "AI tab 下搜索框应隐藏");

  // ---- 切回图书馆:收藏/AI 卸载,图书馆网格与搜索框恢复 ----
  click(byId("library-top-tab-library"));
  await waitFor(() => byId("library-view") !== null, "切回图书馆");
  assert.equal(byId("categories-view"), null, "切回图书馆后合集视图应卸载");
  assert.equal(byId("favorites-view"), null, "切回图书馆后收藏视图应卸载");
  assert.equal(byId("home-ask-view"), null, "切回图书馆后 AI 视图应卸载");
  assert.ok(byId("library-search-input"), "切回图书馆后搜索框应恢复");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp：分类管理对话框快速切换编辑目标不被迟到响应覆盖(回归)", async () => {
  // 回归覆盖:CollectionManageDialog 的 open-effect 曾经没有 cancelled 守卫——
  // 快速为 A 打开对话框、关闭、再为 B 打开,如果 A 的网络请求比 B 的晚
  // resolve(真实网络下完全可能发生的乱序),会把正在显示 B 的表单勾选状态
  // 覆盖回 A 的旧数据。用可控 resolve 顺序的假 controller 复现这个乱序。
  const host = dom.window.document.createElement("div");
  host.id = "home-root-race";
  dom.window.document.body.appendChild(host);

  const services = createServices();
  services.initialize();

  const memberResolvers = {};
  function deferredMemberIds(collectionId) {
    return new Promise((resolve) => {
      memberResolvers[collectionId] = resolve;
    });
  }
  services.collections.controller.listAllDocuments = () => Promise.resolve([
    { document_id: "doc-1", title: "Doc One" },
  ]);
  services.collections.controller.listCollectionDocumentIds = (collectionId) => deferredMemberIds(collectionId);

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  await wait(0);

  const dialogStore = services.collections.dialogStore;

  dialogStore.open({ collection_id: "col-a", name: "A" });
  await waitFor(() => byId("collection-manage-dialog") !== null, "打开 A");
  await wait(0);

  dialogStore.close();
  await wait(0);
  dialogStore.open({ collection_id: "col-b", name: "B" });
  await waitFor(() => byId("collection-name-input")?.value === "B", "切到 B");
  await wait(0);

  // 乱序 resolve:B(doc-1 不属于 B)先到,A(doc-1 属于 A)后到。
  memberResolvers["col-b"]([]);
  await wait(10);
  const checkboxAfterB = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterB.checked, false, "B 的书目勾选态应该是未勾选(doc-1 不属于 B)");

  memberResolvers["col-a"](["doc-1"]);
  await wait(10);
  const checkboxAfterLateA = dom.window.document.querySelector("#collection-manage-dialog input[type=checkbox]");
  assert.equal(checkboxAfterLateA.checked, false, "A 的迟到响应不应把 B 的勾选态覆盖回勾选");
  assert.equal(byId("collection-name-input").value, "B", "表单标题应该仍是 B,没被 A 的迟到响应带跑");

  root.unmount();
  services.dispose();
  host.remove();
});

test("HomeApp：3b 回调桥接口定型(蓝图 §4)", () => {
  const services = createServices();
  // mountJobRuntimeFeature / status-detail / credentials 接线所需的回调名
  const bridgeContract = [
    "setText",
    "setWorkflowSections",
    "setLinearProgress",
    "updateActionButtons",
    "renderPageRangeSummary",
    "resetUploadProgress",
    "resetUploadedFile",
    "applyWorkflowMode",
    "updateJobWarning",
    "resetEventsList",
    "activateDetailTab",
    "setSubmitBusy",
    "submitForm",
  ];
  for (const name of bridgeContract) {
    assert.equal(typeof services.bridge[name], "function", `bridge.${name} 缺失`);
  }
  // 3b workflow-open-port 注入口
  assert.equal(typeof services.workflowDialog.isOpen, "function");
  assert.equal(services.workflowDialog.isOpen(), false);
  services.dispose();
});
