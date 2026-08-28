import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Kiểm thử thành phần StatusDetailDialog (nhóm hộp thoại Phase 3, Blueprint §1). Bao phủ danh sách kiểm thử mới §1.4
// trong blueprint: chuyển đổi 4 tab + hợp đồng thuộc tính hidden, chiếm chỗ màn hình đầu overview → làm mới hai giai đoạn render,
// xác nhận từng mục StageHistoryList/EventsList (xác nhận mảng đối tượng thay thế xác nhận markup),
// vòng lặp đóng lọc/phân trang/chọn/phát lại của TranslationDebugTab, đường dẫn thành công rerun + tích hợp startPolling.
// Đi qua đường dẫn轮询 mountJobRuntimeFeature thực tế (?mock=failed / ?mock=done),
// không mock fetch — tất cả fetch dành riêng cho status-detail (diagnostics/resume-plan/translation/*) đều đi qua
// nhánh isMockMode() tích hợp trong từng mô-đun (sao chép tiền lệ makeDom của status-card-component.test.mjs).

function makeDom(search) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  // Radix Presence/Tabs (giới thiệu giai đoạn B) cần cancelAnimationFrame trong jsdom
  // (dọn dẹp bộ đếm thời gian hoạt ảnh mount của TabsContent) và getComputedStyle (đọc Presence
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
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`Chờ quá thời gian: ${description}`);
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
  const { createHomeComposition } = await import("../src/pages/home/composition.js");
  const { HomeApp } = await import("../src/pages/home/HomeApp.jsx");

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
  // forceMount Content——job-status-card 嵌在这个对话框内部,只有对话框打开过
  // 才会挂载(同 CredentialsDialog 等阶段 C 第一批对话框的先例)。
  // openStatusDetailDialog() 走的 startPolling 依赖 job-status-card 相关的
  // statusCardStore 消费方就位,这里先打开一次工作流对话框保证挂载。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "job-status-card"), "工作流对话框打开后 job-status-card 挂载");
  await wait(0);

  return { services, root, host };
}

async function openStatusDetailDialog(dom, services) {
  const { getMockJobId } = await import("../src/js/mock/index.js");
  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-detail-btn"), "状态卡详情按钮就绪");
  click(dom, byId(dom, "status-detail-btn"));
  // 阶段 C(shadcn 改造):StatusDetailDialog 换成 Radix Dialog 后不 forceMount
  // Content——对话框关闭时不挂载,断言从"open 属性真假"改为"是否挂载"(同
  // CredentialsDialog 等阶段 C 第一批对话框的先例)。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "详情对话框打开");
  return getMockJobId();
}

test("StatusDetailDialog: chuyển đổi 4 tab + hợp đồng thuộc tính hidden (gắn thường trực không gỡ bỏ)", async () => {
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

test("StatusDetailDialog: chiếm chỗ màn hình đầu overview (đồng bộ) → làm mới hai giai đoạn render (bất đồng bộ bổ sung trường chẩn đoán)", async () => {
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

test("StatusDetailDialog: StageHistoryList/EventsList có cấu trúc JSX render từng mục", async () => {
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

test("StatusDetailDialog: phát lại tab thất bại (rerun) thành công → đóng hộp thoại + tích hợp startPolling", async () => {
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

test("StatusDetailDialog: tab gỡ lỗi dịch —— tóm tắt/lọc/chọn/chuyển trang/phát lại vòng kín", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockTranslationItems, getMockTranslationSummary } = await import("../src/js/mock/translation.js");
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

test("StatusDetailDialog: nguồn dữ liệu độc lập — overview của status-detail không đọc statusCardStore", async () => {
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
