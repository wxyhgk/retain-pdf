import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// useRecentJobCover(蓝图 §6 新增测试⑩)。覆盖:
// - 缓存复用(image-loader.js 的模块级 Map,同一 URL+cacheVersion 只发一次
//   fetch,第二张卡片直接命中缓存);
// - 竞态防护(token):item 快速切换时,只有最后一次请求的结果会写进 state;
// - 卸载不 revoke(蓝图风险 §8.3):hook 卸载后不得调用 URL.revokeObjectURL——
//   objectURL 缓存的生命周期只归 image-loader.js 的 invalidateRecentJobImages
//   管,React 卸载绝不能提前吊销别的卡片可能还在用的同一个 URL。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { useRecentJobCover } = await import("../../src/features/library/ui/display/useRecentJobCover.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(10);
  }
  assert.fail(`等待超时：${description}`);
}

function installFetchAndObjectUrlMocks() {
  const fetchCalls = [];
  const revokeCalls = [];
  const createCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    return {
      ok: true,
      blob: async () => ({ __mockBlob: url }),
    };
  };
  globalThis.URL.createObjectURL = (blob) => {
    const objectUrl = `blob:mock-${createCalls.length}-${blob.__mockBlob}`;
    createCalls.push(objectUrl);
    return objectUrl;
  };
  globalThis.URL.revokeObjectURL = (url) => {
    revokeCalls.push(url);
  };
  return { fetchCalls, revokeCalls, createCalls };
}

function HookHost({ item, onUpdate }) {
  const coverUrl = useRecentJobCover(item);
  React.useEffect(() => {
    onUpdate(coverUrl);
  }, [coverUrl, onUpdate]);
  return null;
}

test("useRecentJobCover：同一 URL+cacheVersion 命中模块级缓存,不重复 fetch", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const item = {
    job_id: "cover-job-1",
    thumbnail_url: "https://example.test/cover-a.png",
    updated_at: "2026-01-01T00:00:00Z",
    status: "succeeded",
  };

  const seenA = [];
  const seenB = [];
  React.startTransition(() => {
    root.render(React.createElement(React.Fragment, null,
      React.createElement(HookHost, { item, onUpdate: (url) => seenA.push(url) }),
      React.createElement(HookHost, { item: { ...item }, onUpdate: (url) => seenB.push(url) }),
    ));
  });

  await waitFor(() => seenA.some(Boolean) && seenB.some(Boolean), "两张卡片都拿到封面 URL");
  assert.equal(fetchCalls.length, 1, "两张卡片共享同一模块级缓存,只应发一次 fetch");
  assert.equal(seenA.at(-1), seenB.at(-1), "两张卡片拿到同一个 objectURL");

  root.unmount();
  host.remove();
});

test("useRecentJobCover：运行中进度变化不重复拉取封面(卡片不闪烁回归)", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const seen = [];
  const running1 = {
    job_id: "run-cover-flicker",
    thumbnail_url: "https://example.test/run-cover-flicker.png",
    status: "running",
    updated_at: "2026-01-01T00:00:00Z",
    progress: { current: 1, total: 10, percent: 10 },
  };
  root.render(React.createElement(HookHost, { item: running1, onUpdate: (url) => seen.push(url) }));
  await waitFor(() => seen.some(Boolean), "运行中首帧封面到达");
  const fetchesAfterFirst = fetchCalls.length;
  assert.equal(fetchesAfterFirst, 1, "首次应拉取一次封面");

  // 模拟一次轮询补丁:进度、updated_at 都变了,但任务仍是 running——封面不该
  // 因此重新拉取(否则每一拍 <img> src 一换就闪一下)。
  const running2 = { ...running1, updated_at: "2026-01-01T00:00:05Z", progress: { current: 5, total: 10, percent: 50 } };
  root.render(React.createElement(HookHost, { item: running2, onUpdate: (url) => seen.push(url) }));
  await wait(60);
  assert.equal(fetchCalls.length, fetchesAfterFirst, "运行中仅进度/时间戳变化不应重新拉取封面");

  // 到终态:应 bust 一次,取可能已更新的成品封面。
  const done = { ...running1, status: "succeeded", updated_at: "2026-01-01T00:00:10Z" };
  root.render(React.createElement(HookHost, { item: done, onUpdate: (url) => seen.push(url) }));
  await waitFor(() => fetchCalls.length === fetchesAfterFirst + 1, "终态应重新拉取一次封面(bust)");

  root.unmount();
  host.remove();
});

test("useRecentJobCover：item 快速切换时 token 防竞态,只有最后一次请求写 state", async () => {
  const { fetchCalls } = installFetchAndObjectUrlMocks();
  // 让第一次请求刻意慢于第二次,模拟"旧请求后到达"的竞态
  let resolveFirst;
  const firstGate = new Promise((resolve) => { resolveFirst = resolve; });
  const originalFetch = globalThis.fetch;
  let callIndex = 0;
  globalThis.fetch = async (url) => {
    const index = callIndex;
    callIndex += 1;
    if (index === 0) {
      await firstGate;
    }
    return originalFetch(url);
  };

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const seen = [];
  function Wrapper({ item }) {
    return React.createElement(HookHost, { item, onUpdate: (url) => seen.push(url) });
  }

  const itemSlow = { job_id: "race-job", thumbnail_url: "https://example.test/slow.png", updated_at: "v1" };
  const itemFast = { job_id: "race-job", thumbnail_url: "https://example.test/fast.png", updated_at: "v2" };

  root.render(React.createElement(Wrapper, { item: itemSlow }));
  await wait(20);
  root.render(React.createElement(Wrapper, { item: itemFast }));
  await waitFor(() => seen.some((url) => url && url.includes("fast")), "快请求(最新 item)已经写入");

  resolveFirst();
  await wait(50);

  assert.ok(!seen.at(-1)?.includes("slow"), "慢请求(旧 item)不应覆盖最新状态(token 防竞态)");
  assert.equal(fetchCalls.length, 2);

  root.unmount();
  host.remove();
  globalThis.fetch = originalFetch;
});

test("useRecentJobCover：卸载不 revoke objectURL(风险 §8.3)", async () => {
  const { revokeCalls } = installFetchAndObjectUrlMocks();
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);

  const item = {
    job_id: "cover-job-unmount",
    thumbnail_url: "https://example.test/cover-unmount.png",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const seen = [];
  root.render(React.createElement(HookHost, { item, onUpdate: (url) => seen.push(url) }));
  await waitFor(() => seen.some(Boolean), "封面 URL 到达");

  root.unmount();
  await wait(30);

  assert.equal(revokeCalls.length, 0, "卸载不得 revoke——objectURL 缓存只归 invalidateRecentJobImages 管");

  host.remove();
});
