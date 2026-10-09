import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom, typeInput } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

// 书籍详情弹窗(参考 PDF_MD_lib 的 BookDetailModal)组件级测试:点卡片打开、
// 元数据渲染、阅读状态切换走 patchDocument、馆藏/已翻译的动作集不同。
//
// 每个 test 一份全新 JSDOM(同一个 jsdom 第二次 createRoot 会停摆)。

// Radix Tabs Trigger 挂在 mousedown 上，只 dispatch click 不会切 tab
const click = (dom, element) => clickWithMouseDown(dom, element, { cancelable: true });

test("馆藏卡打开书籍详情:元数据 + 阅读状态切换 + 翻译/读原文动作,无对照阅读", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="true"]'),
    "馆藏卡就位",
  );
  const documentId = card.getAttribute("data-document-id");
  click(dom, card);

  const dlg = await waitFor(() => byId("book-detail-dialog"), "书籍详情弹窗打开");
  for (const tab of ["overview", "processing", "artifacts"]) {
    assert.ok(byId(`book-detail-tab-${tab}`), `详情存在 ${tab} Tab`);
    assert.ok(byId(`book-detail-panel-${tab}`), `详情存在 ${tab} 面板`);
  }
  assert.equal(byId("book-detail-tab-translate"), null, "不再用翻译命名整个处理区");
  assert.equal(byId("book-detail-tab-more"), null, "移除含糊的更多 Tab");
  assert.equal(byId("book-detail-tab-manage"), null, "管理能力并入简介，不再占用顶级 Tab");
  // 概览是一块紧凑信息区：页数 / 大小 / 入库 / 翻译一行；不再有重复页签的大卡和「文件」跳转。
  const facts = dlg.querySelector(".book-detail-overview-facts");
  assert.ok(facts, "概览有紧凑信息区");
  assert.match(facts.textContent || "", /88\s*页/, "信息区展示页数");
  assert.equal(dlg.querySelector(".book-detail-overview-hero"), null, "不再有只写页数的大卡");
  assert.equal(byId("book-detail-overview-files-btn"), null, "「文件」已是页签，概览不再重复入口");
  assert.ok(byId("book-detail-overview-process-btn"), "翻译状态可点进「进度」页");
  // 书名 / 作者只在左栏出现，概览不重复
  assert.equal(byId("book-detail-panel-overview").querySelector(".book-detail-title"), null, "概览不重复书名");
  assert.doesNotMatch(byId("book-detail-panel-overview").textContent || "", /未知作者/, "概览不重复作者");
  // 删除在底部单独的危险操作区，不和阅读状态挤在一起
  assert.ok(dlg.querySelector('.book-detail-overview-danger #book-detail-delete-btn'), "删除在危险操作区");
  assert.equal(dlg.querySelector('[data-book-detail-section="management"] #book-detail-delete-btn'), null, "删除不在信息区");
  assert.match(
    dlg.querySelector(".book-detail-cover-identity")?.textContent || "",
    /Group Theory Lecture Notes.*未知作者/,
    "左栏展示文档身份与作者兜底",
  );
  assert.equal(dlg.querySelector(".book-detail-left-reading-card"), null, "左栏不再展示阅读状态");
  for (const kind of ["source", "markdown", "translated", "comparison"]) {
    assert.ok(byId(`book-detail-download-${kind}-btn`), `左栏存在 ${kind} 快捷下载图标`);
  }
  assert.equal(byId("book-detail-download-source-btn").disabled, false, "原始 PDF 可直接下载");
  assert.equal(byId("book-detail-download-markdown-btn").disabled, true, "未生成 Markdown 时入口置灰");
  // 标题默认只读(在左栏),点「编辑信息」才出现输入框
  await waitFor(() => dlg.querySelector(".book-detail-cover-identity h3")?.textContent?.trim(), "标题就位");
  assert.equal(byId("book-detail-title-input"), null, "默认只读,无标题输入框");
  // 书籍详情是按需加载的，任务列表在弹窗出现之后才到：等它，而不是一出现就断言。
  await waitFor(
    () => dlg.querySelector('[data-processing-capability="translation"] .book-detail-status')?.textContent?.includes("未翻译"),
    "馆藏显示未翻译",
  );
  // 未翻译：标题状态 + 紧凑启动行（尚无真实 job，不嵌路线图或完整 StatusCard）
  assert.equal(byId("book-detail-translate-progress"), null, "空闲态不占用进度区域");
  assert.equal(byId("book-detail-stage-flow"), null, "空闲态不展示静态阶段路线图");
  assert.equal(byId("book-detail-job-status-card"), null, "未翻译不嵌 StatusCard");
  // 馆藏:有翻译 + 读原文,无对照阅读
  assert.ok(byId("book-detail-translate-btn"), "馆藏有翻译按钮");
  assert.ok(byId("book-detail-start-ocr-btn"), "馆藏有独立 OCR 按钮");
  assert.ok(byId("book-detail-ocr-progress"), "OCR 使用独立任务状态区");
  assert.ok(dlg.querySelector(".book-detail-ocr-range"), "OCR 指定页码以内联一行提供，不再折叠进选项");
  assert.ok(byId("book-detail-read-source-btn"), "有读原文");
  assert.equal(byId("book-detail-compare-btn"), null, "馆藏没有对照阅读");
  click(dom, byId("book-detail-tab-artifacts"));
  await waitFor(() => byId("book-detail-panel-artifacts").hidden === false, "切到文件 Tab");
  assert.ok(byId("book-detail-open-source-file-btn"), "文件 Tab 展示源 PDF 动作");
  // 点"编辑"进入标题/标签编辑
  click(dom, byId("book-detail-tab-overview"));
  await waitFor(() => byId("book-detail-panel-overview").hidden === false, "回到简介 Tab");
  click(dom, byId("book-detail-edit-btn"));
  await waitFor(() => byId("book-detail-title-input"), "点编辑出现标题输入框");

  // 阅读状态切换 → patchDocument(mock),按钮变激活
  assert.ok(dlg.querySelector('[data-book-detail-section="management"]'), "简介内展示阅读与归档区");
  const { getMockDocument } = await import("@/platform/mock/documents.js");
  const readBtns = dlg.querySelectorAll(".book-detail-reading-btn");
  const doneBtn = Array.from(readBtns).find((b) => b.textContent === "读完");
  click(dom, doneBtn);
  await waitFor(() => doneBtn.classList.contains("is-active"), "读完变激活");
  await waitFor(() => getMockDocument(documentId).reading_status === "done", "patchDocument 落库 reading_status=done");

  root.unmount();
  services.dispose();
  host.remove();
});

test("已翻译卡打开书籍详情:有对照阅读,无翻译按钮", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  // mock 里 att-001/scl-002 等合成 book 是 succeeded 的已翻译文档
  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="false"][data-status="succeeded"]'),
    "已翻译卡就位",
  );
  click(dom, card);

  const dlg = await waitFor(() => byId("book-detail-dialog"), "书籍详情弹窗打开");
  assert.equal(
    byId("book-detail-tab-overview")?.getAttribute("data-state"),
    "active",
    "点击已翻译书籍卡仍默认进入概览",
  );
  // 默认在「简介」：不应弹出工作流对话框
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "打开书籍详情不得自动打开工作流弹窗",
  );
  // 已完成：一行摘要 +「重新处理」，三步进度和历史流程大卡都不占位置。
  await waitFor(
    () => dlg.querySelector("[data-processing-unified-status]")?.textContent?.includes("已完成"),
    "显示已完成",
  );
  assert.equal(byId("book-detail-job-status-card"), null, "完成态不展示历史流程大卡");
  assert.equal(byId("book-detail-translate-progress"), null, "完成态不占用进度区域");
  assert.equal(dlg.querySelector('[data-translation-process="true"]'), null, "完成态收起三步进度");
  const reprocessToggle = await waitFor(() => byId("book-detail-reprocess-toggle"), "「重新处理」开关");
  assert.equal(byId("book-detail-retry-render-btn"), null, "清单默认收起");
  click(dom, reprocessToggle);
  // 仍然不得弹工作流
  assert.equal(
    services.stores.dialog.getSnapshot().open,
    false,
    "切换进度 Tab / 加载进度后仍不打开工作流弹窗",
  );
  assert.ok(byId("book-detail-compare-btn"), "已翻译有对照阅读");
  assert.equal(byId("book-detail-translate-btn"), null, "已翻译没有翻译按钮");
  const retryTranslationButton = await waitFor(
    () => byId("book-detail-retry-translation-btn"),
    "后端阶段动作加载重新翻译按钮",
  );
  const retryRenderButton = await waitFor(
    () => {
      const button = byId("book-detail-retry-render-btn");
      return button && !button.disabled ? button : null;
    },
    "后端阶段动作加载可用的重新渲染按钮",
  );
  assert.ok(retryTranslationButton, "已完成任务可以复用 OCR 重新翻译");
  assert.ok(retryRenderButton, "已有译文可以单独重新渲染");
  assert.ok(byId("book-detail-read-source-btn"), "仍可读原文");

  const sourceDocumentId = services.bookDetail.dialogStore.getState().payload.document_id;
  click(dom, retryRenderButton);
  await waitFor(
    () => `${services.bookDetail.dialogStore.getState().payload.active_job_id || ""}`.startsWith("mock-render-retry-"),
    "重新渲染创建新任务并接入详情",
  );
  assert.equal(
    services.bookDetail.dialogStore.getState().payload.document_id,
    sourceDocumentId,
    "阶段重试继续绑定原文档",
  );
  // 重新渲染是渲染任务：各站只说自己——翻译站「已完成」，正在跑的那一站「处理中」。
  // （以前每站都拿整本书的状态，翻译站也写「处理中」。）
  await waitFor(
    () => [...dlg.querySelectorAll('[data-translation-process="true"] .book-detail-status')]
      .some((node) => node.textContent?.includes("处理中")),
    "重新渲染后三步进度立即展开，正在跑的那一站处理中",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("书籍详情:后台轮询换 item 引用不覆盖正在编辑的标题", async () => {
  const dom = makeDom("?mock=parallel");
  const byId = (id) => dom.window.document.getElementById(id);
  const { services, root, host } = await bootHomeApp(dom);

  const card = await waitFor(
    () => dom.window.document.querySelector('#recent-jobs-list .recent-job-item[data-library-only="true"]'),
    "馆藏卡就位",
  );
  const documentId = card.getAttribute("data-document-id");
  click(dom, card);
  await waitFor(() => byId("book-detail-dialog"), "详情弹窗打开");

  click(dom, byId("book-detail-edit-btn"));
  const input = await waitFor(() => byId("book-detail-title-input"), "编辑输入框就位");
  typeInput(dom, input, "用户正在输入的标题");

  // 模拟后台轮询：同一卡片换一个新对象引用（内容不变）。
  const items = services.library.recentJobsStore.getSnapshot().items || [];
  const row = items.find((item) => `${item.document_id || ""}`.trim() === `${documentId || ""}`.trim());
  assert.ok(row, "前置：store 里有该文档行");
  services.library.recentJobsStore.actions.replaceItem({ ...row });
  await wait(30);

  assert.equal(
    byId("book-detail-title-input")?.value,
    "用户正在输入的标题",
    "后台换 item 引用不得重置正在编辑的标题",
  );

  root.unmount();
  services.dispose();
  host.remove();
});

test("进度 Tab：运行中的真实 OCR 任务提供取消，派生 OCR 不提供", async () => {
  const dom = makeDom();
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { BookDetailProcessingTab } = await import(
    "../../src/features/book-detail/ui/tabs/BookDetailProcessingTab.jsx"
  );

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const cancelCalls = [];
  const translation = {
    item: {},
    status: { label: "尚未翻译", tone: "muted" },
    isActive: false,
    canTranslate: true,
    rangeOn: false,
    startPage: "1",
    endPage: "",
    onRangeOnChange() {},
    onStartPageChange() {},
    onEndPageChange() {},
    onTranslate() {},
    onRetryStage: async () => {},
  };
  const render = (ocrJob) => root.render(React.createElement(BookDetailProcessingTab, {
    ocr: {
      job: ocrJob,
      pending: false,
      cancelling: false,
      error: "",
      rangeOn: false,
      startPage: "1",
      endPage: "",
      onRangeOnChange() {},
      onStartPageChange() {},
      onEndPageChange() {},
      onOcr() {},
      onCancel: (id) => cancelCalls.push(id),
    },
    translation,
  }));

  render({ job_id: "job-ocr-run", workflow: "ocr", status: "running" });
  await waitFor(() => dom.window.document.getElementById("book-detail-cancel-ocr-btn"), "真实 OCR 运行中显示取消");
  const cancelBtn = dom.window.document.getElementById("book-detail-cancel-ocr-btn");
  assert.equal(cancelBtn.disabled, false);
  click(dom, cancelBtn);
  assert.deepEqual(cancelCalls, ["job-ocr-run"], "取消按钮带真实 OCR job_id");

  // 翻译派生的合成 OCR（ocr_status_derived）job_id 指向翻译任务，不能提供取消
  render({ job_id: "job-translation", workflow: "ocr", status: "running", ocr_status_derived: true });
  await wait(20);
  assert.equal(
    dom.window.document.getElementById("book-detail-cancel-ocr-btn"),
    null,
    "派生 OCR 不提供取消按钮",
  );

  root.unmount();
  host.remove();
});

test("详情右栏:defaultTab 变化会切到对应 Tab", async () => {
  const dom = makeDom();
  const byId = (id) => dom.window.document.getElementById(id);
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { BookDetailRightTabs } = await import(
    "../../src/features/book-detail/ui/tabs/BookDetailRightTabs.jsx"
  );

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const render = (defaultTab) => root.render(
    React.createElement(BookDetailRightTabs, {
      open: true,
      resetKey: "doc-1",
      defaultTab,
      overviewTab: React.createElement("div", { id: "tab-overview-content" }),
      processingTab: React.createElement("div", { id: "tab-processing-content" }),
      artifactsTab: React.createElement("div", { id: "tab-artifacts-content" }),
    }),
  );

  render("overview");
  await waitFor(() => byId("book-detail-panel-overview"), "概览面板就位");
  assert.equal(byId("book-detail-tab-overview").getAttribute("data-state"), "active", "初始在概览");

  render("processing");
  await waitFor(
    () => byId("book-detail-tab-processing").getAttribute("data-state") === "active",
    "defaultTab 变化后切到进度 Tab",
  );

  root.unmount();
  host.remove();
});
