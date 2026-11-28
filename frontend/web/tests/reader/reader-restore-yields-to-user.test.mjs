/** 开书后立刻滚动的人，不该被恢复链拽回去。
 *
 * # 起因
 *
 * 初始恢复链是 `INITIAL_RESTORE_DELAYS_MS = [0, 48, 140, 320, 700, 1200]` ——
 * 开书后 **1.2 秒内**反复把滚动位置钉回存档锚点。重钉本身是有意的：PDF 页高要等
 * 页面真渲染出来才稳，钉一次会落在旧布局上。
 *
 * 但原来**没有任何用户手势能取消它**（`cancelRestoreRef` 只在换文档、切模式或卸载
 * 时被调），而且这期间 `restoringRef` 为 true，scroll 处理器直接 return ——
 * 用户滚到哪里连记都不记。表现：开书、马上滑动、被拽回去好几次，松手后位置也没存。
 *
 * 这里真驱动 hook（jsdom + act），不读源码文本。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { useReadingAnchor } from "../../../../frontend/packages/reader/src/pdf/useReadingAnchor.ts";
import {
  loadReaderViewState,
  saveReaderViewState,
} from "../../../../frontend/packages/reader/src/shared/state/reader-view-state.ts";
import { installReaderDom } from "../helpers/dom.mjs";

// 本文件要模拟键盘与滚轮，额外装 KeyboardEvent / WheelEvent。
const installDom = (url = "http://localhost/reader.html") => installReaderDom({
  url,
  extraKeys: ["KeyboardEvent", "WheelEvent"],
});

/** 一个有 4 页、每页 800px 的壳。 */
function buildShell() {
  const container = document.getElementById("root");
  const shell = document.createElement("div");
  container.appendChild(shell);
  shell.getBoundingClientRect = () => ({
    x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 500, width: 600, height: 500, toJSON() {},
  });
  for (let page = 1; page <= 4; page += 1) {
    const pageNode = document.createElement("div");
    pageNode.setAttribute("data-reader-page", `${page}`);
    pageNode.setAttribute("data-reader-pane", "source");
    pageNode.getBoundingClientRect = () => {
      const top = (page - 1) * 800 - shell.scrollTop;
      return {
        x: 0, y: top, top, left: 0, right: 600, bottom: top + 800,
        width: 600, height: 800, toJSON() {},
      };
    };
    shell.appendChild(pageNode);
  }
  return shell;
}

const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function waitFor(predicate, description) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(10);
  }
  assert.fail(`等待超时：${typeof description === "function" ? description() : description}`);
}

const KEY = "document:restore-yield";

/** 钉到第 N 页顶部时的 scrollTop。
 *
 * `applyPageScrollProgress` 会减去 READER_SCROLL_FOCUS_PX（56）—— 让目标页顶稍微
 * 离开视口上沿，否则页眉贴边很难读。 */
const topOf = (page) => (page - 1) * 800 - 56;

async function mountWithStoredAnchor(shell, anchor) {
  // 用 saveReaderViewState，不手写 JSON：normalizeReaderViewState 要求
  // `schema: "retainpdf_reader_view_v1"`，少了它 loadReaderViewState 返回 null，
  // 恢复就退回第 1 页（nextTop=0），看起来像「根本没滚动」—— 第一版就是这么红的。
  saveReaderViewState(KEY, { anchor });
  assert.deepEqual(
    loadReaderViewState(KEY)?.anchor, anchor,
    "存档锚点没写进去 —— 下面几条会在「恢复退回第 1 页」上空转",
  );
  const mount = document.createElement("div");
  document.getElementById("root").appendChild(mount);
  const root = createRoot(mount);
  let latest = null;
  // **ref 对象必须稳定**：它在那个恢复 effect 的依赖里，每次渲染换一个新对象的话
  // cleanup 会把恢复链掐掉，而重跑又因为 restoredPersistenceKeyRef 已置位直接 return
  // —— 链子彻底不跑。（第一版就是这么写的，五条全在「根本没滚动」上红。）
  const shellRef = { current: shell };
  function Harness() {
    latest = useReadingAnchor(shellRef, {
      primaryPane: "source", mode: "source", enabled: true,
      persistenceKey: KEY, restoreReady: true,
    });
    return null;
  }
  await act(async () => root.render(createElement(Harness)));
  return { root, api: () => latest };
}

test("正对照：没人动的时候，恢复链确实把位置钉到存档锚点", async () => {
  const env = installDom();
  try {
    const shell = buildShell();
    const { root } = await mountWithStoredAnchor(shell, { page: 3, fraction: 0 });
    await waitFor(() => shell.scrollTop > 0, () => `恢复链应当滚动过，实际 scrollTop=${shell.scrollTop}`);
    assert.equal(shell.scrollTop, topOf(3), "没钉到第 3 页 —— 下面几条就不是在守「让位」了");
    root.unmount();
  } finally {
    localStorage.clear();
    env.restore();
  }
});

test("滑动滚轮之后，恢复链不再把位置拽回去", async () => {
  const env = installDom();
  try {
    const shell = buildShell();
    const { root } = await mountWithStoredAnchor(shell, { page: 3, fraction: 0 });
    await waitFor(() => shell.scrollTop === topOf(3), "初次钉到存档锚点");

    // 用户自己滑到第 1 页顶部。
    shell.dispatchEvent(new WheelEvent("wheel", { deltaY: -400, bubbles: true }));
    shell.scrollTop = 0;
    await act(async () => { shell.dispatchEvent(new Event("scroll")); });

    // 恢复链最后一棒在 1200ms，等它彻底跑完。
    await wait(1400);
    assert.equal(
      shell.scrollTop, 0,
      "滚轮之后又被拽回去了 —— 开书立刻滑动的人会被连拽好几次",
    );
    root.unmount();
  } finally {
    localStorage.clear();
    env.restore();
  }
});

test("滚轮之后用户滚到哪里就记哪里 —— 原来这期间连记都不记", async () => {
  const env = installDom();
  try {
    const shell = buildShell();
    const { root } = await mountWithStoredAnchor(shell, { page: 3, fraction: 0 });
    await waitFor(() => shell.scrollTop === topOf(3), "初次钉到存档锚点");

    shell.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true }));
    shell.scrollTop = 3200;  // 第 4 页
    await act(async () => { shell.dispatchEvent(new Event("scroll")); });

    await waitFor(() => {
      return loadReaderViewState(KEY)?.anchor?.page === 4;
    }, () => `用户滚到第 4 页该被记下来，实际存着 ${JSON.stringify(loadReaderViewState(KEY)?.anchor)}`);
    root.unmount();
  } finally {
    localStorage.clear();
    env.restore();
  }
});

test("导航键也算用户接手；带修饰键的组合不算", async () => {
  const env = installDom();
  try {
    const shell = buildShell();
    const { root, api } = await mountWithStoredAnchor(shell, { page: 3, fraction: 0 });
    await waitFor(() => shell.scrollTop === topOf(3), "初次钉到存档锚点");
    // 冻结状态是这件事唯一不依赖时序的观测点 —— 不去赌「下一棒什么时候来」。
    assert.equal(api().isRestoring(), true, "正对照：钉完之后恢复期还没结束");

    // Cmd+↓ 是「跳到末尾」之类的意图，不是翻页 —— 不该取消恢复。
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", metaKey: true, bubbles: true }));
    assert.equal(
      api().isRestoring(), true,
      "带修饰键的组合也被当成翻页了 —— Cmd+↓ 会把恢复误取消，页高稳定前的重钉就没了",
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
    assert.equal(api().isRestoring(), false, "按了 PageDown 还在冻结 —— 用户滚到哪里都不记");

    shell.scrollTop = 800;
    await act(async () => { shell.dispatchEvent(new Event("scroll")); });
    await wait(1400);
    assert.equal(shell.scrollTop, 800, "按了 PageDown 还被拽回去");
    root.unmount();
  } finally {
    localStorage.clear();
    env.restore();
  }
});

test("scroll 本身不算用户手势 —— 恢复链自己产生的就是 scroll", async () => {
  // 拿 scroll 当信号等于让恢复取消自己，第一次钉完就不再重钉，而页高还没稳。
  const env = installDom();
  try {
    const shell = buildShell();
    const { root } = await mountWithStoredAnchor(shell, { page: 3, fraction: 0 });
    await waitFor(() => shell.scrollTop === topOf(3), "初次钉到存档锚点");
    // 模拟「页面渲染完，页高变了」：有人把 scrollTop 挪走但没有任何用户手势。
    shell.scrollTop = 0;
    await act(async () => { shell.dispatchEvent(new Event("scroll")); });
    await wait(1400);
    assert.equal(
      shell.scrollTop, topOf(3),
      "只有 scroll 事件就放弃了恢复 —— 页高稳定之前的那几棒重钉全失效了",
    );
    root.unmount();
  } finally {
    localStorage.clear();
    env.restore();
  }
});
