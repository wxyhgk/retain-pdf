import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  buildReaderPageIdxSearch,
  readerRouteSearchSignature,
} from "../../../../frontend/packages/reader/src/shared/config/page-config.ts";

// 阅读中把当前页同步进 URL：纯函数契约 + hook 行为（防抖 / 值不变不写 /
// 只用 replaceState / 写回不被当成锚点重跳）。

function wait(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("buildReaderPageIdxSearch：page（1 基）→ 0 基 page_idx，仅变化时返回新串", () => {
  assert.equal(buildReaderPageIdxSearch("?job_id=j1", 3), "job_id=j1&page_idx=2");
  assert.equal(buildReaderPageIdxSearch("?job_id=j1&page_idx=2", 3), null);
  // 第 1 页且 URL 本无 page_idx：等价位置，不写
  assert.equal(buildReaderPageIdxSearch("?job_id=j1", 1), null);
  assert.equal(buildReaderPageIdxSearch("?job_id=j1&page_idx=0", 1), null);
  assert.equal(buildReaderPageIdxSearch("?page_idx=4&mock=parallel", 6), "page_idx=5&mock=parallel");
  assert.equal(buildReaderPageIdxSearch("?job_id=j1", 0), null);
  assert.equal(buildReaderPageIdxSearch("?job_id=j1", NaN), null);
});

test("buildReaderPageIdxSearch：block_id 仅在其页仍匹配时保留，否则剔除", () => {
  assert.equal(
    buildReaderPageIdxSearch("?job_id=j1&page_idx=2&block_id=b-1", 3, () => 3),
    null,
    "block 页与当前页一致：保持不变",
  );
  assert.equal(
    buildReaderPageIdxSearch("?job_id=j1&block_id=b-1", 3, () => 3),
    "job_id=j1&block_id=b-1&page_idx=2",
    "page_idx 需补写，block 保留",
  );
  assert.equal(
    buildReaderPageIdxSearch("?job_id=j1&page_idx=2&block_id=b-1", 3, () => 8),
    "job_id=j1&page_idx=2",
    "滚动离开锚点页：剔除陈旧 block_id",
  );
});

test("readerRouteSearchSignature：剔除阅读位置锚点，保留会话身份参数", () => {
  assert.equal(
    readerRouteSearchSignature("?job_id=j1&page_idx=9&block_id=b-1&mock=parallel"),
    "job_id=j1&mock=parallel",
  );
  assert.equal(readerRouteSearchSignature("?document_id=d1&page=3&blockId=b-2"), "document_id=d1");
  assert.equal(readerRouteSearchSignature("?job_id=j1"), "job_id=j1");
});

function setupDom(search) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: `http://localhost/reader.html${search}`,
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Node",
    "MutationObserver",
    "navigator",
    "CustomEvent",
    "Event",
  ]) {
    try {
      Object.defineProperty(globalThis, key, {
        value: dom.window[key] ?? dom.window,
        writable: true,
        configurable: true,
      });
    } catch {
      /* 只读键忽略 */
    }
  }
  Object.defineProperty(globalThis, "location", {
    value: dom.window.location,
    writable: true,
    configurable: true,
  });
  globalThis.window = dom.window;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

test("hook：防抖写回 page_idx、值不变不写、只用 replaceState、写入不引发回环", async () => {
  const dom = setupDom("?job_id=job-A&page_idx=0");
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import(
    "../../../../frontend/packages/reader/src/adapters.ts"
  );
  const { useReaderUrlAnchorSync } = await import(
    "../../../../frontend/packages/reader/src/hooks/use-url-anchor-jump.ts"
  );

  // 运行时 adapter 从真实 location 读取锚点，才能验证「写回后不再重跳」。
  setReaderAdapters({
    resolveReaderAnchor: () => {
      const params = new URLSearchParams(dom.window.location.search);
      const raw = params.get("page_idx");
      const blockId = `${params.get("block_id") || ""}`.trim();
      if (raw === null && !blockId) return null;
      const num = raw === null ? NaN : Number(raw);
      return { pageIdx: Number.isFinite(num) ? num : null, blockId };
    },
  });

  const replaces = [];
  const pushes = [];
  const origReplace = dom.window.history.replaceState.bind(dom.window.history);
  const origPush = dom.window.history.pushState.bind(dom.window.history);
  dom.window.history.replaceState = function (...args) {
    replaces.push(args[2]);
    return origReplace(...args);
  };
  dom.window.history.pushState = function (...args) {
    pushes.push(args[2]);
    return origPush(...args);
  };

  const historyLengthBefore = dom.window.history.length;
  const jumpsToFive = [];

  function Harness({ page, numPages }) {
    useReaderUrlAnchorSync({
      enabled: true,
      syncEnabled: true,
      numPages,
      currentPage: page,
      goToPage: (target) => {
        if (target === 5) jumpsToFive.push(target);
      },
      jobId: "job-A",
      documentId: "",
      syncDebounceMs: 100,
    });
    return null;
  }

  try {
    const root = createRoot(dom.window.document.getElementById("root"));
    root.render(React.createElement(Harness, { page: 1, numPages: 10 }));
    // 等锚点重试窗口 + settle（800 + 120ms）+ 防抖
    await wait(1150);
    assert.equal(replaces.length, 0, "初始第 1 页无值变化：不写 URL");

    // 滚动到第 3 页：防抖后写 page_idx=2
    root.render(React.createElement(Harness, { page: 3, numPages: 10 }));
    await wait(260);
    assert.equal(replaces.length, 1);
    assert.match(replaces[0], /page_idx=2/);
    assert.equal(pushes.length, 0, "只用 replaceState，不 push 历史");
    assert.equal(dom.window.history.length, historyLengthBefore, "replaceState 不新增历史项");

    // 同一页重渲染：值不变不写
    root.render(React.createElement(Harness, { page: 3, numPages: 10 }));
    await wait(260);
    assert.equal(replaces.length, 1, "值不变不重复写");

    // 第 5 页 → page_idx=4
    root.render(React.createElement(Harness, { page: 5, numPages: 10 }));
    await wait(260);
    assert.equal(replaces.length, 2);
    assert.match(replaces[1], /page_idx=4/);

    // 回环保守：numPages 变化让锚点 effect 重跑；URL 已是 page_idx=4（第 5 页），
    // 写回值已在 appliedKeyRef 中标记，不应被当成锚点再跳一次。
    assert.equal(jumpsToFive.length, 0, "写回前没有跳第 5 页");
    root.render(React.createElement(Harness, { page: 5, numPages: 11 }));
    await wait(950);
    assert.equal(jumpsToFive.length, 0, "写回的 page_idx 不得触发回环跳页");
    assert.equal(replaces.length, 2, "重跑锚点 effect 不应新增写入");

    root.unmount();
  } finally {
    setReaderAdapters(null);
  }
});

test("hook：只给了 block_id 的锚点，块还没到先不处理（不写回 URL），块到了跳到它所在的页", async () => {
  const dom = setupDom("?job_id=job-B&block_id=p007-b0003");
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
  const { useReaderUrlAnchorSync } = await import("../../../../frontend/packages/reader/src/hooks/use-url-anchor-jump.ts");
  setReaderAdapters({
    resolveReaderAnchor: () => {
      const params = new URLSearchParams(dom.window.location.search);
      const blockId = `${params.get("block_id") || ""}`.trim();
      const raw = params.get("page_idx");
      return raw === null && !blockId ? null : { pageIdx: raw === null ? null : Number(raw), blockId };
    },
  });
  const replaces = [];
  const origReplace = dom.window.history.replaceState.bind(dom.window.history);
  dom.window.history.replaceState = function (...args) {
    replaces.push(args[2]);
    return origReplace(...args);
  };
  const jumps = [];
  function Harness({ regionsSettled }) {
    useReaderUrlAnchorSync({
      enabled: true,
      syncEnabled: true,
      numPages: 20,
      currentPage: 1,
      goToPage: (target) => jumps.push(target),
      // 块到了才知道 p007-b0003 在第 7 页。
      resolveBlockPage: (blockId) => (regionsSettled && blockId === "p007-b0003" ? 7 : null),
      jobId: "job-B",
      documentId: "",
      regionsSettled,
      syncDebounceMs: 50,
    });
    return null;
  }
  try {
    const root = createRoot(dom.window.document.getElementById("root"));
    root.render(React.createElement(Harness, { regionsSettled: false }));
    await wait(1100);
    assert.deepEqual(jumps, [], "块没到：不跳");
    assert.deepEqual(replaces, [], "块没到：不把第 1 页写回 URL、冲掉 block_id");
    root.render(React.createElement(Harness, { regionsSettled: true }));
    await wait(1100);
    assert.ok(jumps.length > 0 && jumps.every((page) => page === 7), `块到了跳到第 7 页：${jumps}`);
    root.unmount();
  } finally {
    dom.window.close();
  }
});
