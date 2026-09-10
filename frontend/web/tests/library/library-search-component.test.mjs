import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// React 组件级测试:经 tests/helpers/jsx-loader.mjs 的 esbuild 钩子直接加载 .jsx

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node", "MutationObserver"]) {
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

const { mountLibrarySearchApp } = await import("../../src/features/library/ui/island/library-search-app.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("库检索面板:渲染命中高亮与文档行,状态切换调用 PATCH", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const patchCalls = [];
  let deliverQuery = null;
  const ports = {
    subscribeQuery: (subscriber) => {
      deliverQuery = subscriber;
      subscriber("");
      return () => {};
    },
    searchLibrary: async (q) => ({
      hits: [{
        document_id: "doc-a",
        job_id: "job-a",
        page_idx: 4,
        block_id: "b-1",
        source_snippet: `hit for [${q}] here`,
        translated_snippet: "",
      }],
    }),
    fetchDocumentList: async () => ({
      documents: [{
        document_id: "doc-a",
        title: "测试文档",
        source_filename: "test.pdf",
        page_count: 8,
        active_job_id: "job-a",
        reading_status: "unread",
        tags: ["测试"],
      }],
    }),
    patchDocument: async (documentId, payload) => {
      patchCalls.push([documentId, payload]);
      return {};
    },
    openReader: () => {},
  };

  const app = mountLibrarySearchApp(host, ports);
  // 并行跑测时进程负载不定,固定短等待会在 subscribe 尚未发生时拿到 null;
  // 轮询直到岛屿完成订阅(deliverQuery 就绪)再继续。
  {
    const deadline = Date.now() + 3000;
    while (typeof deliverQuery !== "function" && Date.now() < deadline) {
      await wait(20);
    }
  }
  assert.equal(typeof deliverQuery, "function", "岛屿已订阅查询端口");
  assert.equal(host.querySelector(".lib-search-panel"), null, "空查询不渲染面板");

  deliverQuery("测试");
  // 搜索有防抖 + 异步取数;满载并发时固定 400ms 不够。轮询直到命中片段真渲染出来
  // (面板 div 会先出、命中内容后填,只等面板不够)。
  {
    const deadline = Date.now() + 3000;
    while (!host.querySelector(".lib-search-snippet mark") && Date.now() < deadline) {
      await wait(20);
    }
  }

  assert.ok(host.querySelector(".lib-search-panel"), "面板已渲染");
  assert.equal(host.querySelector(".lib-search-snippet mark")?.textContent, "测试");
  assert.equal(host.querySelector(".lib-search-doc-title")?.textContent, "测试文档");
  assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "未读");

  host.querySelector(".lib-search-doc-status").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true }),
  );
  {
    // 等乐观更新(setState + 重渲)真正把状态文字变成"在读",而不是猜固定毫秒。
    const deadline = Date.now() + 3000;
    while (host.querySelector(".lib-search-doc-status")?.textContent !== "在读" && Date.now() < deadline) {
      await wait(20);
    }
  }
  assert.deepEqual(patchCalls, [["doc-a", { reading_status: "reading" }]]);
  assert.equal(host.querySelector(".lib-search-doc-status")?.textContent, "在读", "乐观更新生效");

  app.unmount();
  host.remove();
});
