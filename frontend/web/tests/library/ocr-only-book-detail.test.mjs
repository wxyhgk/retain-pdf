import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { buildTranslateBookCardAction } from "../../src/features/library/domain/actions/translate.js";
import { deriveBookDetailCoverState } from "../../src/features/book-detail/ui/use-book-detail-cover.js";

const OCR_DONE_ITEM = {
  job_id: "job-ocr-detail",
  active_job_id: "job-ocr-detail",
  document_id: "doc-ocr-detail",
  workflow: "ocr",
  job_type: "ocr",
  library_only: false,
  status: "succeeded",
  display_stage: "done",
  title: "OCR 详情文档",
  page_count: 42,
};

function makeDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/index.html?mock=parallel",
  });
  for (const key of [
    "window",
    "document",
    "DocumentFragment",
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLFormElement",
    "HTMLInputElement",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "Node",
    "MutationObserver",
    "NodeFilter",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
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
    const value = predicate();
    if (value) return value;
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function click(dom, element) {
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    button: 0,
  }));
  element.dispatchEvent(new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  }));
}

test("详情派生区分 OCR、翻译成功和馆藏，OCR 翻译 action 仍可用", () => {
  const ocr = deriveBookDetailCoverState({ item: OCR_DONE_ITEM });
  assert.deepEqual(ocr.status, { label: "OCR 完成", tone: "done" });
  assert.equal(ocr.readPresentation.label, "查看 OCR");
  assert.equal(ocr.readPresentation.target, "job");
  assert.equal(ocr.readerAvailable, true);
  assert.equal(ocr.canTranslate, true);

  const translated = deriveBookDetailCoverState({
    item: { ...OCR_DONE_ITEM, workflow: "book", job_type: "book" },
  });
  assert.deepEqual(translated.status, { label: "已完成", tone: "done" });
  assert.equal(translated.readPresentation.label, "对照阅读");
  assert.equal(translated.canTranslate, false);

  const libraryOnly = deriveBookDetailCoverState({
    item: {
      job_id: "doc:doc-source",
      document_id: "doc-source",
      library_only: true,
      status: "",
    },
  });
  assert.deepEqual(libraryOnly.status, { label: "未翻译", tone: "muted" });
  assert.equal(libraryOnly.readPresentation.target, "source");
  assert.equal(libraryOnly.readerAvailable, false);
  assert.equal(libraryOnly.canTranslate, true);

  const onTranslate = () => {};
  assert.equal(buildTranslateBookCardAction(OCR_DONE_ITEM, { onTranslate }).length, 1);
  assert.equal(buildTranslateBookCardAction({
    ...OCR_DONE_ITEM,
    workflow: "book",
    job_type: "book",
  }, { onTranslate }).length, 0);
});

test("OCR-only 成功详情：OCR 状态、job reader 主操作和继续翻译闭环一致", async () => {
  const dom = makeDom();
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
  const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();
  // 本测试只验证详情语义；禁止进度轮询的 mock book payload 把 OCR workflow
  // 覆盖成普通翻译 job。
  services.library.actions.attachJobProgress = () => {};

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp 首帧渲染");

  // 独立 document_id 避免 initialize 的异步 mock 书库刷新按文档身份将其
  // 替换成内置馆藏卡。
  services.library.recentJobsStore.actions.setItems([OCR_DONE_ITEM]);

  const card = await waitFor(
    () => dom.window.document.querySelector('[data-book-card="true"][data-job-id="job-ocr-detail"]'),
    "OCR 卡片就位",
  );
  click(dom, card);

  const dialog = await waitFor(
    () => dom.window.document.getElementById("book-detail-dialog"),
    "OCR 详情打开",
  );
  await waitFor(
    () => dialog.querySelector('[data-processing-capability="ocr"] .book-detail-status')?.textContent?.includes("已完成"),
    "详情状态显示 OCR 完成",
  );

  const ocrButton = dom.window.document.getElementById("book-detail-ocr-btn");
  assert.ok(ocrButton, "OCR 成功详情提供查看 OCR 主操作");
  assert.equal(ocrButton.textContent.trim(), "查看 OCR");
  assert.equal(dom.window.document.getElementById("book-detail-compare-btn"), null);
  assert.ok(dom.window.document.getElementById("book-detail-translate-btn"), "OCR 完成后仍可继续翻译");
  assert.ok(dialog.querySelector('[data-ocr-reuse="true"]'), "翻译区明确提示复用已有 OCR");
  assert.match(
    dialog.querySelector('[data-processing-capability="translation"]')?.textContent || "",
    /复用已有 OCR，直接翻译/,
  );
  assert.ok(dom.window.document.getElementById("book-detail-open-ocr-file-btn"), "文件区提供 OCR 结果入口");
  assert.doesNotMatch(dialog.textContent, /已翻译完成|对照阅读/);

  let translatePayload = null;
  // 统一提交入口：hook 调 actions.submitDocument（按 workflow 分流到 translate）
  services.library.actions.submitDocument = async (_documentId, payload) => {
    translatePayload = payload;
    return null;
  };
  click(dom, dom.window.document.getElementById("book-detail-translate-btn"));
  await waitFor(() => translatePayload, "OCR 完成后提交复用翻译请求");
  assert.deepEqual(translatePayload, {
    workflow: "translate",
    source: { artifact_job_id: "job-ocr-detail" },
    translation: { page_ranges: [] },
  });
  assert.equal("ocr" in translatePayload, false, "复用请求不再提交 OCR 配置");
  await waitFor(
    () => dom.window.document.getElementById("book-detail-translate-btn")?.disabled === false,
    "复用翻译提交结束",
  );

  let readerDetail = null;
  dom.window.document.addEventListener(APP_EVENTS.openReaderRequested, (event) => {
    readerDetail = event.detail;
  });
  click(dom, dom.window.document.getElementById("book-detail-ocr-btn"));
  await waitFor(() => readerDetail?.jobId === "job-ocr-detail", "查看 OCR 保留 job reader 上下文");
  assert.equal(readerDetail.documentId, "doc-ocr-detail", "Reader 路由保留稳定文档身份");

  root.unmount();
  services.dispose();
  host.remove();
});
