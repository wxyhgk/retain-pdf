import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// artifact-downloads(dialogs 蓝图 §7)组件级测试。本域此前被历轮 agent 跳过——
// ResultActions.jsx/StatusDetailDialog.jsx 的 7 个下载 id 只渲染了裸
// <a href target="_blank">,composition.js 从未 mount 过
// mountArtifactDownloadsFeature,导致点击是纯浏览器跳转（未带 X-API-Key，
// 后端多半 401）而不是 fetchProtected 下载。本文件覆盖两条新增验收测试:
// ① 点击命中 7 个 id 各自触发正确的下载(mock fetchProtected,不是裸导航);
// ② busy 态文案不被父组件重渲染覆盖(蓝图 §7.5 方案二核心机制)。
//
// makeDom/waitFor/bootHomeApp 模式镜像 status-card-component.test.mjs 先例。

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
  // 是阶段 C(TranslationWorkflowDialog/StatusDetailDialog 换 Radix Dialog)
  // 新增的需要——Dialog.Content 的 FocusScope 用它做可聚焦元素树遍历。
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
  // Radix Tabs 的 Trigger 激活逻辑挂在 onMouseDown(不是 onClick)上——阶段 B
  // 迁移 StatusDetailDialog 到 Radix Tabs 后,只 dispatch "click" 不会触发 tab
  // 切换。真实浏览器点击本来就是 mousedown→mouseup→click 全套,这里补上
  // mousedown 让模拟点击更贴近真实交互,而不是放宽任何断言。
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
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
  // forceMount Content——job-status-card/ResultActions 的下载按钮嵌在这个
  // 对话框内部,只有对话框打开过才会挂载(同 CredentialsDialog 等阶段 C 第一批
  // 对话框的先例)。
  services.workflowDialog.openUpload();
  await waitFor(() => byId(dom, "job-status-card"), "工作流对话框打开后 job-status-card 挂载");
  await wait(0);

  return { services, root, host };
}

// jsdom 未实现 URL.createObjectURL/revokeObjectURL(downloads.js#downloadBlob
// 用于把 Blob 交给浏览器保存)——用一个可记录调用的 stub 替换,镜像
// glossaries-dialog-component.test.mjs「CSV 导出」测试的先例。
function stubObjectUrl() {
  const previousURL = globalThis.URL;
  const calls = [];
  globalThis.URL = class extends previousURL {
    static createObjectURL(blob) {
      calls.push(blob);
      return `blob:mock-${calls.length}`;
    }

    static revokeObjectURL() {}
  };
  return {
    calls,
    restore() {
      globalThis.URL = previousURL;
    },
  };
}

test("artifact-downloads：真实轮询(mock=done)驱动 ResultActions 三个下载按钮就绪且可点击", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "准备中", "真实任务数据到达");

  const markdownBtn = byId(dom, "status-markdown-bundle-btn");
  const sourcePdfBtn = byId(dom, "source-pdf-btn");
  const pdfBtn = byId(dom, "pdf-btn");

  for (const [label, el] of [["status-markdown-bundle-btn", markdownBtn], ["source-pdf-btn", sourcePdfBtn], ["pdf-btn", pdfBtn]]) {
    assert.ok(el, `${label} 应存在`);
    assert.equal(el.getAttribute("aria-disabled"), "false", `${label} 应处于可点击态`);
    assert.match(el.dataset.url || "", /^mock:\/\//, `${label} 的 data-url 应指向后端受保护资源(而非空/'#')`);
    assert.equal(el.classList.contains("disabled"), false, `${label} 不应带 disabled 类`);
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：点击 ResultActions 的 3 个受保护下载按钮触发 fetchProtected 下载流程(不是裸导航)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "准备中", "真实任务数据到达");
    await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "下载按钮就绪");

    const startHref = dom.window.location.href;
    const cases = [
      // status-markdown-bundle-btn 无 preferSuggestedName,文件名来自
      // fileNameFromDisposition 兜底 `${jobId}-markdown.zip`(mock 响应没有
      // content-disposition 头)。
      ["status-markdown-bundle-btn", /-markdown\.zip$/],
      // source-pdf-btn/pdf-btn 都 preferSuggestedName,文件名来自
      // resolveSourcePdfDownloadName/resolveTranslatedPdfDownloadName——按
      // .pdf 后缀断言即可,不依赖 mock job 是否能推出原始文件名。
      ["source-pdf-btn", /\.pdf$/],
      ["pdf-btn", /\.pdf$/],
    ];

    for (const [id, expectedNamePattern] of cases) {
      const before = urlStub.calls.length;
      const link = byId(dom, id);
      assert.equal(link.getAttribute("aria-disabled"), "false", `${id} 点击前应可用`);
      click(dom, link);
      // 点击瞬间应同步 preventDefault,不发生真实页面跳转(document 级委托点击
      // 在 handleProtectedArtifactClick 顶部就调用了 event.preventDefault())。
      assert.equal(dom.window.location.href, startHref, `${id} 点击不应触发页面导航`);
      await waitFor(() => urlStub.calls.length > before, `${id} 点击应经 fetchProtected→saveResponseDownload 触发一次 downloadBlob`);
      const blob = urlStub.calls[urlStub.calls.length - 1];
      assert.ok(blob.size > 0, `${id} 下载到的 Blob 应有实际字节(证明真的走了 mock fetch,不是空占位)`);
      // download-toast(DownloadToastHost.jsx)应反映正确的文件名——证明走的
      // 是 downloads.js 的真实响应处理链路,不是随手拼的假数据。
      await waitFor(
        () => expectedNamePattern.test(byId(dom, "download-toast-title")?.textContent || ""),
        `${id} 下载完成后 toast 标题应包含预期文件名`,
      );
      // 下载完成后 busy 态应清空,按钮恢复可用(controller.js 的 finally 分支)。
      await waitFor(() => byId(dom, id).getAttribute("aria-disabled") === "false", `${id} 下载完成后应恢复可点击`);
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：StatusDetailDialog 概览面板的 markdown-bundle-btn 同样接入下载流程", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-detail-btn"), "状态卡详情按钮就绪");
    click(dom, byId(dom, "status-detail-btn"));
    // 阶段 C(shadcn 改造):StatusDetailDialog 换成 Radix Dialog 后不 forceMount
  // Content——断言从"open 属性真假"改为"是否挂载"。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "详情对话框打开");

    await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "概览面板下载按钮就绪(读 statusCardStore)");
    const link = byId(dom, "markdown-bundle-btn");
    assert.match(link.dataset.url || "", /^mock:\/\/bundle\.zip/);

    const before = urlStub.calls.length;
    click(dom, link);
    await waitFor(() => urlStub.calls.length > before, "点击概览面板下载按钮触发 downloadBlob");
    await waitFor(() => byId(dom, "markdown-bundle-btn").getAttribute("aria-disabled") === "false", "下载完成后恢复可点击");
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：document 级委托覆盖全部 7 个契约 id(含当前无 UI 消费点的 3 个)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const { DOWNLOAD_ACTION_IDS } = await import("@/platform/contracts/download-action-contract.js");
  const urlStub = stubObjectUrl();

  try {
    services.features.jobRuntimeFeature.startPolling(getMockJobId());
    await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "准备中", "真实任务数据到达");

    // download-btn/markdown-btn/markdown-raw-btn 当前没有任何 React 组件渲染
    // (recent-jobs 承建方判定为死代码清单之外),但 controller.js 的
    // document 级委托点击是纯 id 选择器匹配,与谁渲染了按钮无关——用合成节点
    // 验证这 3 个 id 同样被正确接管，证明 7 个契约 id 全部生效，不是只接了
        // 4 个已渲染的。
    const syntheticIds = [
      DOWNLOAD_ACTION_IDS.BUNDLE,
      DOWNLOAD_ACTION_IDS.MARKDOWN_JSON,
      DOWNLOAD_ACTION_IDS.MARKDOWN_RAW,
    ];
    const urlByAction = {
      [DOWNLOAD_ACTION_IDS.BUNDLE]: "mock://bundle.zip",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_JSON]: "mock://markdown.json",
      [DOWNLOAD_ACTION_IDS.MARKDOWN_RAW]: "mock://markdown.raw",
    };
    for (const id of syntheticIds) {
      const link = dom.window.document.createElement("a");
      link.id = id;
      link.href = urlByAction[id];
      link.dataset.url = urlByAction[id];
      dom.window.document.body.appendChild(link);

      const before = urlStub.calls.length;
      click(dom, link);
      await waitFor(() => urlStub.calls.length > before, `合成节点 #${id} 点击应命中同一个 document 级委托处理器`);
      link.remove();
    }
  } finally {
    urlStub.restore();
  }

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：busy 态文案不被父组件(StatusCard)重渲染覆盖(蓝图 §7.5 方案二核心保障)", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-ring-value").textContent.trim() !== "准备中", "真实任务数据到达");
  await waitFor(() => byId(dom, "pdf-btn").getAttribute("aria-disabled") === "false", "下载按钮就绪");

  const { DOWNLOAD_ACTION_IDS } = await import("@/platform/contracts/download-action-contract.js");
  const actionId = DOWNLOAD_ACTION_IDS.PDF; // "pdf-btn"

  // 模拟 controller.js 在下载中途调用 viewPort.setLinkBusy(link, true, "37%")
  // ——不直改 DOM,只写 busy store。
  services.artifactDownloads.busyStore.setBusy(actionId, true, "37%");
  await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "37%", "busy 态文案立即生效");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true", "下载中应视为不可再次点击");

  // 制造一次与下载无关的父组件(StatusCard)重渲染——镜像
  // status-card-component.test.mjs「无关的 store 通知不应重置手动选择」先例，
  // 这里验证的是下载 busy 文案不应被同款重渲染打回原始 label(旧世界直改 DOM
  // 会在这里被虚拟 DOM diff 吃掉，方案二应该扛住)。
  for (let i = 0; i < 5; i += 1) {
    services.statusCard.store.actions.setCancelDisabled(i % 2 === 0);
  }
  await wait(30);
  assert.equal(
    byId(dom, actionId).querySelector("span").textContent,
    "37%",
    "父组件(StatusCard)因无关 store 变化重渲染后，下载中文案应保持不变(不被打回'下载 PDF')",
  );
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "true");

  // 下载结束(controller.js finally 分支 setLinkBusy(link, false))——文案应
  // 恢复原始 label 且重新可点击。
  services.artifactDownloads.busyStore.setBusy(actionId, false);
  await waitFor(() => byId(dom, actionId).querySelector("span").textContent === "下载 PDF", "busy 结束后文案恢复");
  assert.equal(byId(dom, actionId).getAttribute("aria-disabled"), "false");

  root.unmount();
  services.dispose();
  host.remove();
});

test("artifact-downloads：StatusDetailDialog 概览下载按钮的 busy 态同样不被翻页/tab 切换等重渲染覆盖", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom);
  const { getMockJobId } = await import("@/platform/mock/index.js");

  services.features.jobRuntimeFeature.startPolling(getMockJobId());
  await waitFor(() => byId(dom, "status-detail-btn"), "状态卡详情按钮就绪");
  click(dom, byId(dom, "status-detail-btn"));
  // 阶段 C(shadcn 改造):StatusDetailDialog 换成 Radix Dialog 后不 forceMount
  // Content——断言从"open 属性真假"改为"是否挂载"。
  await waitFor(() => byId(dom, "status-detail-dialog") !== null, "详情对话框打开");
  await waitFor(() => byId(dom, "markdown-bundle-btn")?.getAttribute("aria-disabled") === "false", "概览面板下载按钮就绪");

  services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", true, "下载中...");
  await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "下载中...", "busy 文案生效");

  // 切 tab 再切回来(overview 常驻挂载不卸载,但会触发 StatusDetailDialog 整体
  // 重渲染)——busy 文案应保持。
  click(dom, byId(dom, "detail-tab-events"));
  await waitFor(() => byId(dom, "detail-panel-events").hidden === false, "切到事件 tab");
  click(dom, byId(dom, "detail-tab-overview"));
  await waitFor(() => byId(dom, "detail-panel-overview").hidden === false, "切回概览 tab");
  assert.equal(byId(dom, "markdown-bundle-btn").textContent, "下载中...", "切 tab 不应打回下载中文案");

  services.artifactDownloads.busyStore.setBusy("markdown-bundle-btn", false);
  await waitFor(() => byId(dom, "markdown-bundle-btn").textContent === "下载 Markdown ZIP", "busy 结束后文案恢复");

  root.unmount();
  services.dispose();
  host.remove();
});
