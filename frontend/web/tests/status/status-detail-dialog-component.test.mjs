import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// StatusDetailDialog(Phase 3 dialogs 群,蓝图 §1)组件级测试。覆盖蓝图 §1.4
// 新增测试清单:4 tab 切换 + hidden 属性契约、overview 首屏占位→刷新两段渲染、
// StageHistoryList/EventsList 逐条断言(对象数组断言取代 markup 断言)、
// TranslationDebugTab 过滤/翻页/选中/重放闭环、rerun 成功路径 + startPolling
// 联调。走真实 mountJobRuntimeFeature 轮询链路(?mock=failed / ?mock=done),
// 不 mock fetch——所有 status-detail 专属 fetch(diagnostics/resume-plan/
// translation/*)均走各自模块内建的 isMockMode() 分支(镜像
// status-card-component.test.mjs 的 makeDom 先例)。

function makeDom(search) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "navigator", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
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
  // 是阶段 C(StatusDetailDialog 换 Radix Dialog)新增的需要——Dialog.Content 的
  // FocusScope 用它做可聚焦元素树遍历(@radix-ui/react-focus-scope 的
  // getTabbableCandidates),不是 Tabs 需要的。
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function click(dom, element) {
  // Radix Tabs 的 Trigger 激活逻辑挂在 onMouseDown(不是 onClick)上——阶段 B
  // 迁移到 Radix Tabs 后(StatusDetailDialog 4 个 tab),只 dispatch "click" 不
  // 会触发 tab 切换。真实浏览器点击本来就是 mousedown→mouseup→click 全套,这里
  // 补上 mousedown 让模拟点击更贴近真实交互,而不是放宽任何断言。
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(dom, element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function selectOption(dom, element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
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
  // 主页那张页面级状态卡 #job-status-card 已下线(进度主场是书籍详情的「进度」
  // Tab)。它曾经是本文件打开详情弹窗的入口,所以这里原本要先把它挂出来。
  // 现在不需要了——见下面 openStatusDetailDialog 的说明。
  await wait(0);

  return { services, root, host };
}

async function openStatusDetailDialog(dom, services) {
  const { getMockJobId } = await import("@/platform/mock/index.js");
  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  // 本文件测的是 StatusDetailDialog 本身,入口只是搭便车。原来点的
  // #status-detail-btn 长在主页状态卡上,那张卡已随「进度主场收敛到书籍详情」
  // 一并下线;而那个按钮的 onClick 做的就是下面这一句
  // (见 features/jobs/ui/status-card/use-status-card-model.ts 的 openDetail),
  // 所以直接调 controller 与点按钮等价,不削弱本文件的断言。
  services.statusDetail.controller.openStatusDetailDialog("overview");
  // 阶段 C(shadcn 改造):StatusDetailDialog 换成 Radix Dialog 后不 forceMount
  // Content——对话框关闭时不挂载,断言从"open 属性真假"改为"是否挂载"(同
  // CredentialsDialog 等阶段 C 第一批对话框的先例)。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "详情对话框打开");
  return getMockJobId();
}

test("StatusDetailDialog：4 tab 切换 + hidden 属性契约（常驻挂载不卸载）", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

  const contractIds = [
    "status-detail-dialog", "status-detail-head-icon", "status-detail-job-id",
    "status-detail-head-note", "status-detail-close-btn",
    "detail-tab-overview", "detail-tab-failure", "detail-tab-events", "detail-tab-translation",
    "detail-panel-overview", "detail-panel-failure", "detail-panel-events", "detail-panel-translation",
  ];
  for (const id of contractIds) {
    assert.ok(byId(dom, id), `契约 id 缺失：#${id}`);
  }

  // 默认打开落在 overview,其余三个面板用 hidden 属性隐藏(不卸载)。
  assert.equal(byId(dom, "detail-tab-overview").getAttribute("aria-selected"), "true");
  assert.equal(byId(dom, "detail-panel-overview").hidden, false);
  assert.equal(byId(dom, "detail-panel-failure").hidden, true);
  assert.equal(byId(dom, "detail-panel-events").hidden, true);
  assert.equal(byId(dom, "detail-panel-translation").hidden, true);

  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  assert.equal(byId(dom, "detail-tab-failure").getAttribute("aria-selected"), "true");
  assert.equal(byId(dom, "detail-tab-overview").getAttribute("aria-selected"), "false");
  assert.equal(byId(dom, "detail-panel-overview").hidden, true, "overview 面板隐藏但仍在 DOM 中(不卸载)");
  assert.ok(byId(dom, "runtime-current-stage"), "overview 面板节点仍存在于 DOM(hidden 不是卸载)");

  click(dom, byId(dom, "detail-tab-events"));
  await waitFor(() => byId(dom, "detail-panel-events").hidden === false, "切到事件 tab");

  click(dom, byId(dom, "detail-tab-translation"));
  await waitFor(() => byId(dom, "detail-panel-translation").hidden === false, "切到高级诊断 tab");

  click(dom, byId(dom, "detail-tab-overview"));
  await waitFor(() => byId(dom, "detail-panel-overview").hidden === false, "切回概览 tab");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：overview 首屏占位（同步）→ 刷新两段渲染（异步补齐诊断字段）", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

  // 打开瞬间(同步链内)job-id 已经来自 currentJobStore 的占位快照,不是空白。
  assert.notEqual(byId(dom, "status-detail-job-id").textContent.trim(), "-");
  assert.notEqual(byId(dom, "status-detail-job-id").textContent.trim(), "");

  // 诊断摘要来自专属 fetchJobDiagnostics(与轮询快照分离的第二段异步 fetch),
  // mock 分支返回固定文案——只有 ensureOverviewData 的 fresh fetch 完成后才会
  // 出现在失败 tab 里。
  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(
    () => byId(dom, "failure-summary").textContent.trim() === "任务失败，但这是前端 mock 场景。",
    "失败诊断第二段渲染补齐",
  );
  assert.equal(byId(dom, "failure-category").textContent.trim(), "mock_render_failure");
  assert.equal(byId(dom, "failure-stage").textContent.trim(), "render");
  assert.equal(byId(dom, "failure-root-cause").textContent.trim(), "用于 UI 调试的模拟失败。");
  assert.equal(byId(dom, "failure-suggestion").textContent.trim(), "切换 ?mock=succeeded 查看成功态。");
  assert.equal(byId(dom, "failure-retryable").textContent.trim(), "是");

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：错误日志可展开、滚动阅读并一键复制", async () => {
  const dom = makeDom("?mock=failed");
  const copied = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value) => copied.push(value) },
  });
  Object.defineProperty(dom.window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  const { services, root, host } = await bootHomeApp(dom);
  const jobId = await openStatusDetailDialog(dom, services);

  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(
    () => byId(dom, "failure-summary").textContent.trim() === "任务失败，但这是前端 mock 场景。",
    "失败诊断数据就绪",
  );
  click(dom, byId(dom, "failure-log-btn"));
  await waitFor(() => byId(dom, "failure-log-dialog"), "错误日志弹窗打开");

  const content = byId(dom, "failure-log-content").textContent;
  assert.match(content, new RegExp(`Job ID: ${jobId}`));
  assert.match(content, /阶段: render/);
  assert.match(content, /摘要: 任务失败，但这是前端 mock 场景。/);
  assert.equal(byId(dom, "failure-log-content").getAttribute("tabindex"), "0");

  click(dom, byId(dom, "failure-copy-log-btn"));
  await waitFor(() => byId(dom, "failure-copy-log-status").textContent.includes("已复制"), "复制反馈出现");
  assert.deepEqual(copied, [content]);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：Paddle QueueFull 提供结构化恢复、Trace 复制和立即 OCR 重试", async () => {
  const dom = makeDom("?mock=failed");
  const copied = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value) => copied.push(value) },
  });
  Object.defineProperty(dom.window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);
  await waitFor(
    () => services.statusDetail.store.getSnapshot().overview.failure.summary === "任务失败，但这是前端 mock 场景。",
    "失败概览数据就绪",
  );
  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  services.statusDetail.store.actions.setOverview({
    failureRecovery: {
      kind: "queue_full",
      provider: "paddle",
      providerCode: "10010",
      traceId: "trace-queue-10010",
      attempt: 2,
      maxAttempts: 4,
      retryAtMs: Date.now() + 30_000,
      retryAfterSource: "diagnostics.retry_after",
      retryOcr: {
        available: true,
        enabled: true,
        method: "POST",
        url: `mock://jobs/${originalJobId}/retry-stage`,
        body: { stage: "ocr", ambiguous_request_policy: "block" },
        reason: "",
        requiresDuplicateRisk: false,
      },
      checkpointArtifacts: ["source_pdf"],
      preservesSourcePdf: true,
      statusText: "OCR 服务队列繁忙，等待自动重试（第 2/4 次）",
      preservationText: "原 PDF 会保留并用于重新 OCR。",
      backendGaps: [],
    },
  });
  assert.equal(services.statusDetail.store.getSnapshot().overview.failureRecovery.kind, "queue_full");
  assert.equal(services.statusDetail.store.getSnapshot().overview.ocrAmbiguity.required, false);

  await waitFor(() => byId(dom, "failure-queue-card"), "QueueFull 恢复卡出现");
  assert.match(byId(dom, "failure-queue-card").textContent, /Paddle OCR 队列繁忙/);
  assert.match(byId(dom, "failure-queue-countdown").textContent, /秒后自动重试/);
  assert.match(byId(dom, "failure-preservation").textContent, /原 PDF 会保留/);

  click(dom, byId(dom, "failure-copy-trace-btn"));
  await waitFor(() => byId(dom, "failure-trace-feedback").textContent.includes("已复制"), "Trace ID 复制反馈");
  assert.deepEqual(copied, ["trace-queue-10010"]);

  click(dom, byId(dom, "failure-retry-ocr-btn"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "立即重试 OCR 后关闭详情");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
    "立即重试 OCR 后轮询新任务",
  );
  assert.match(services.features.jobRuntimeFeature.currentJobId(), /^mock-ocr-retry-/);

  root.unmount();
  services.dispose();
  host.remove();
});

// 渲染/翻译类失败：后端 stage-actions 给了可续跑的阶段，面板必须把它们渲染出来
// 并标清会复用什么、重跑什么——而不是像泛化前那样只认 OCR、把这些任务甩给一句
// 「当前没有可识别的专门恢复状态。」
test("StatusDetailDialog：失败面板渲染后端给的任意阶段恢复动作并能重试", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);
  await waitFor(
    () => services.statusDetail.store.getSnapshot().overview.failure.summary === "任务失败，但这是前端 mock 场景。",
    "失败概览数据就绪",
  );
  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  const stageAction = (stage, label, willReuse, willRerun, recommended) => ({
    stage,
    label,
    action: {
      available: true,
      enabled: true,
      method: "POST",
      url: `mock://jobs/${originalJobId}/retry-stage`,
      body: { stage, ambiguous_request_policy: "block" },
      reason: "",
      requiresDuplicateRisk: false,
    },
    willReuse,
    willRerun,
    preservesSourcePdf: willReuse.includes("source_pdf"),
    preservationText: `原 PDF 会保留；恢复时将复用 ${willReuse.join("、")}。`,
    recommended,
    noteText: `${recommended ? "推荐：" : ""}原 PDF 会保留；恢复时将复用 ${willReuse.join("、")}。将重跑：${willRerun.join("、")}。`,
  });
  services.statusDetail.store.actions.setOverview({
    failureRecovery: {
      ...services.statusDetail.store.getSnapshot().overview.failureRecovery,
      kind: "generic",
      resumeFrom: "render",
      recoveryHint: "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。",
      statusText: "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。",
      stages: [
        stageAction("render", "重新渲染", ["source_pdf", "ocr_result", "translation_result"], ["render"], true),
        stageAction("translation", "重试翻译", ["source_pdf", "ocr_result"], ["translation", "render"], false),
      ],
    },
  });

  await waitFor(() => byId(dom, "failure-stage-retry-render"), "渲染阶段恢复入口出现");
  assert.match(byId(dom, "failure-recovery-hint").textContent, /只需重跑渲染/);
  assert.equal(byId(dom, "failure-stage-retry-render").textContent.trim(), "重新渲染");
  assert.match(byId(dom, "failure-stage-note-render").textContent, /推荐：/);
  assert.match(byId(dom, "failure-stage-note-render").textContent, /translation_result/);
  assert.match(byId(dom, "failure-stage-note-render").textContent, /将重跑：render。/);
  assert.ok(byId(dom, "failure-stage-retry-translation"), "翻译阶段恢复入口一并渲染");
  assert.match(byId(dom, "failure-stage-note-translation").textContent, /将重跑：translation、render。/);

  click(dom, byId(dom, "failure-stage-retry-render"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "阶段重试后关闭详情");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
    "阶段重试后轮询新任务",
  );
  assert.match(services.features.jobRuntimeFeature.currentJobId(), /^mock-render-retry-/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：切换 OCR 服务只打开接口设置，不自动修改 provider", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);
  await waitFor(
    () => services.statusDetail.store.getSnapshot().overview.failure.summary === "任务失败，但这是前端 mock 场景。",
    "失败概览数据就绪",
  );
  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  services.statusDetail.store.actions.setOverview({
    failureRecovery: {
      ...services.statusDetail.store.getSnapshot().overview.failureRecovery,
      kind: "queue_full",
      provider: "paddle",
      providerCode: "10010",
      statusText: "OCR 服务队列繁忙，等待服务自动重试；也可立即重试",
      preservationText: "原 PDF 会保留并用于重新 OCR。",
    },
  });
  assert.equal(services.statusDetail.store.getSnapshot().overview.failureRecovery.kind, "queue_full");
  await waitFor(() => byId(dom, "failure-switch-provider-btn"), "切换 OCR 服务入口出现");

  click(dom, byId(dom, "failure-switch-provider-btn"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "任务详情关闭");
  await waitFor(() => byId(dom, "app-settings-dialog"), "接口设置打开");
  assert.equal(
    services.statusDetail.store.getSnapshot().overview.failureRecovery.provider,
    "paddle",
    "入口只导航，不改写 provider",
  );
  assert.equal(services.features.jobRuntimeFeature.currentJobId(), originalJobId);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：StageHistoryList/EventsList 结构化 JSX 逐条渲染", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);

  await waitFor(() => byId(dom, "overview-stage-list").querySelectorAll(".stage-history-item").length > 0, "阶段时间线渲染出条目");
  const stageItems = byId(dom, "overview-stage-list").querySelectorAll(".stage-history-item");
  assert.equal(byId(dom, "overview-stage-empty").classList.contains("hidden"), true);
  // 逐条断言结构(索引/标题/耗时三个子节点都在),取代旧世界的 markup 字符串断言。
  stageItems.forEach((item, index) => {
    assert.equal(item.querySelector(".stage-history-index").textContent.trim(), `${index + 1}`);
    assert.ok(item.querySelector(".stage-history-title").textContent.trim().length > 0);
    assert.ok(item.querySelector(".stage-history-duration"));
  });

  click(dom, byId(dom, "detail-tab-events"));
  // fetchJobEvents 走真实轮询链路 fetch,不是静态 getMockJobEvents() 快照
  // (二者返回的事件流不保证逐字节一致);从 store 读取本次实际拉到的
  // eventsPayload 作为期望值,断言 DOM 与自身数据源一致。
  await waitFor(() => services.statusDetail.store.getSnapshot().overview.eventsPayload?.items?.length > 0, "事件流数据到达 store");
  const expectedEventCount = services.statusDetail.store.getSnapshot().overview.eventsPayload.items.length;
  await waitFor(() => byId(dom, "events-list").querySelectorAll(".event-item").length === expectedEventCount, "事件流逐条渲染完成");
  assert.equal(byId(dom, "events-status").textContent.trim(), `最近 ${expectedEventCount} 条`);
  const eventItems = byId(dom, "events-list").querySelectorAll(".event-item");
  eventItems.forEach((item) => {
    assert.ok(item.querySelector(".event-badge"));
    assert.ok(item.querySelector(".event-title"));
  });

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：失败 tab 重放（rerun）成功 → 关闭对话框 + startPolling 联调", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);

  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "failure-rerun-btn").disabled === false, "resumePlan.can_resume=true 驱动按钮可用");
  assert.match(byId(dom, "failure-rerun-status").textContent, /可从 render 恢复/);

  click(dom, byId(dom, "failure-rerun-btn"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "rerun 成功后对话框关闭");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
    "rerun 成功后 startPolling 切换到新 job",
  );
  assert.match(services.features.jobRuntimeFeature.currentJobId(), /^mock-rerun-/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：OCR 请求不明确时二次确认风险并切换到恢复任务", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);

  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  services.statusDetail.store.actions.setOverview({
    ocrAmbiguity: {
      required: true,
      status: "",
      jobId: originalJobId,
      descriptor: {
        status: "ambiguous",
        provider: "mineru",
        operation: "apply_upload_url",
        resolution_revision: 4,
        allowed_resolutions: ["bind_existing_receipt", "accept_duplicate_risk"],
        receipt_fields: [
          { name: "batch_id", label: "Batch ID", required: true, secret: false },
          { name: "upload_url", label: "Upload URL", required: true, secret: true },
          { name: "trace_id", label: "Trace ID", required: false, secret: false },
        ],
      },
    },
  });
  await waitFor(() => byId(dom, "failure-ocr-ambiguity-btn"), "OCR ambiguity 恢复入口出现");
  assert.match(byId(dom, "failure-ocr-ambiguity-status").textContent, /MinerU 返回结果不明确/);

  click(dom, byId(dom, "failure-ocr-ambiguity-btn"));
  await waitFor(() => byId(dom, "failure-ocr-ambiguity-confirm"), "风险确认弹窗出现");
  assert.match(byId(dom, "failure-ocr-ambiguity-confirm").textContent, /可能造成重复处理或计费/);

  click(dom, byId(dom, "failure-ocr-ambiguity-confirm-confirm"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "恢复任务创建后关闭详情");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
    "恢复成功后切换轮询任务",
  );
  assert.match(services.features.jobRuntimeFeature.currentJobId(), /^mock-live-/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：按后端 receipt_fields 渲染绑定表单且关闭后清除敏感输入", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  const originalJobId = await openStatusDetailDialog(dom, services);

  click(dom, byId(dom, "detail-tab-failure"));
  await waitFor(() => byId(dom, "detail-panel-failure").hidden === false, "切到失败 tab");
  services.statusDetail.store.actions.setOverview({
    ocrAmbiguity: {
      required: true,
      status: "",
      jobId: originalJobId,
      descriptor: {
        status: "ambiguous",
        provider: "mineru",
        operation: "apply_upload_url",
        resolution_revision: 4,
        allowed_resolutions: ["bind_existing_receipt", "accept_duplicate_risk"],
        receipt_fields: [
          { name: "batch_id", label: "Batch ID", required: true, secret: false },
          { name: "upload_url", label: "Upload URL", required: true, secret: true },
          { name: "trace_id", label: "Trace ID", required: false, secret: false },
        ],
      },
    },
  });
  await waitFor(() => byId(dom, "failure-ocr-bind-btn"), "绑定已有任务入口出现");
  click(dom, byId(dom, "failure-ocr-bind-btn"));
  await waitFor(() => byId(dom, "failure-ocr-bind-dialog"), "绑定回执弹窗出现");

  const batchInput = byId(dom, "failure-ocr-bind-dialog-batch_id");
  const uploadInput = byId(dom, "failure-ocr-bind-dialog-upload_url");
  assert.equal(uploadInput.type, "password", "后端标记 secret 的字段使用遮罩输入");
  assert.equal(byId(dom, "failure-ocr-bind-dialog-task_id"), null, "不渲染后端未声明字段");
  typeInput(dom, batchInput, "batch-private");
  typeInput(dom, uploadInput, "https://signed.example/private");

  click(dom, byId(dom, "failure-ocr-bind-dialog").querySelector('[data-slot="dialog-close-button"]'));
  await waitFor(() => byId(dom, "failure-ocr-bind-dialog") === null, "关闭绑定弹窗");
  click(dom, byId(dom, "failure-ocr-bind-btn"));
  await waitFor(() => byId(dom, "failure-ocr-bind-dialog"), "重新打开绑定弹窗");
  assert.equal(byId(dom, "failure-ocr-bind-dialog-batch_id").value, "");
  assert.equal(byId(dom, "failure-ocr-bind-dialog-upload_url").value, "");

  typeInput(dom, byId(dom, "failure-ocr-bind-dialog-batch_id"), "batch-ready");
  typeInput(dom, byId(dom, "failure-ocr-bind-dialog-upload_url"), "https://signed.example/ready");
  click(dom, byId(dom, "failure-ocr-bind-dialog-submit"));
  await waitFor(() => byId(dom, "status-detail-dialog") === null, "绑定成功后关闭详情");
  await waitFor(
    () => services.features.jobRuntimeFeature.currentJobId() !== originalJobId,
    "绑定成功后切换到恢复任务",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：翻译调试 tab —— 摘要/筛选/选中/翻页/重放闭环", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockTranslationItems, getMockTranslationSummary } = await import("@/platform/mock/translation.js");
  const jobId = await openStatusDetailDialog(dom, services);
  const summary = getMockTranslationSummary(jobId).summary;
  const allItems = getMockTranslationItems(jobId, {}).items;

  click(dom, byId(dom, "detail-tab-translation"));
  await waitFor(() => services.statusDetail.store.getSnapshot().translation.summary, "翻译摘要数据到达 store");
  await waitFor(() => byId(dom, "translation-debug-content").classList.contains("hidden") === false, "翻译调试内容渲染");
  await wait(0);

  assert.equal(byId(dom, "translation-count-translated").textContent.trim(), `${summary.status_summary.translated}`);
  assert.equal(byId(dom, "translation-count-kept-origin").textContent.trim(), `${summary.status_summary.kept_origin}`);
  assert.equal(byId(dom, "translation-provider-family").textContent.trim(), summary.provider_family);

  await waitFor(() => byId(dom, "translation-items-list").querySelectorAll(".translation-item-card").length === allItems.length, "item 列表渲染完成");
  // 默认自动选中首条 item。
  await waitFor(() => byId(dom, "translation-item-detail").classList.contains("hidden") === false, "首条 item 详情自动加载");
  assert.match(byId(dom, "translation-item-meta").textContent, new RegExp(allItems[0].item_id));

  // 分页契约:mock 数据量小于 limit(20),prev/next 均应 disabled。
  assert.equal(byId(dom, "translation-items-prev").disabled, true);
  assert.equal(byId(dom, "translation-items-next").disabled, true);

  // 筛选:切到 kept_origin,列表收窄为该分类数量。
  const keptOriginItems = allItems.filter((item) => item.final_status === "kept_origin");
  selectOption(dom, byId(dom, "translation-filter-final-status"), "kept_origin");
  click(dom, byId(dom, "translation-filter-apply"));
  await waitFor(
    () => byId(dom, "translation-items-list").querySelectorAll(".translation-item-card").length === keptOriginItems.length,
    "筛选 kept_origin 后列表收窄",
  );

  // 选中列表中的一条 item,断言详情面板切换。
  const secondCard = byId(dom, "translation-items-list").querySelectorAll(".translation-item-card")[
    keptOriginItems.length > 1 ? 1 : 0
  ];
  const targetItemId = secondCard.dataset.translationItemId;
  click(dom, secondCard);
  await waitFor(() => byId(dom, "translation-item-meta").textContent.includes(targetItemId), "点击选中另一条 item 更新详情");

  // 重放当前 item。
  click(dom, byId(dom, "translation-item-replay"));
  await waitFor(() => byId(dom, "translation-replay-result").classList.contains("hidden") === false, "重放结果渲染");
  assert.match(byId(dom, "translation-replay-status").textContent, /重放完成|重放返回错误/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("StatusDetailDialog：数据源独立——status-detail 的 overview 不读 statusCardStore", async () => {
  const dom = makeDom("?mock=failed");
  const { services, root, host } = await bootHomeApp(dom);
  await openStatusDetailDialog(dom, services);
  await wait(30);

  const detailSnapshot = services.statusDetail.store.getSnapshot();
  const cardSnapshot = services.statusCard.store.getSnapshot();
  // 两个 store 是不同的实例(蓝图 §1.0 数据源铁律),各自持有 job 字段。
  assert.notEqual(services.statusDetail.store, services.statusCard.store);
  assert.ok(detailSnapshot.overview.job, "status-detail 自行持有 job 原始数据");
  assert.ok(cardSnapshot.snapshot.job, "statusCardStore 也持有 job(并行读路径,互不依赖)");

  root.unmount();
  services.dispose();
  host.remove();
});
