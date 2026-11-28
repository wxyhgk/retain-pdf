/** 窄屏阅读：HUD 不盖 Markdown 面板，手机默认看得清。
 *
 * # 起因（Playwright 实测，开发服务器 + 真实任务）
 *
 * 1. ≤899px 时 dock 面板铺满全宽（assistant-dock.css 的 @media），但底部 HUD 仍按
 *    「PDF 栏中心」定位 —— 压在 Markdown 面板底部「译文/原文/双语」和搜索框上；
 *    375 宽时页码按钮 left=-29，跑到屏幕外。PDF 栏此时整个 visibility:hidden，
 *    HUD 控制的东西根本看不见。
 * 2. 375 宽默认「对照」，每页 163px 宽，正文糊成一片。只切到译文单栏也不够：默认
 *    缩放 50% = 半个阅读区，单栏页宽还是 163px —— 所以窄屏单栏的默认缩放要铺满。
 *
 * # 守住的边界
 *
 * - 只是**默认**：存档里有用户选过的模式 / 缩放时照旧恢复；
 * - 自动套用的默认不写回存档（不然在手机上开过一次，桌面同一本书也变成译文单栏）；
 * - 没有译文（sourceViewOnly）时照旧原文。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import {
  resolveReaderInitialMode,
  shouldPersistReaderMode,
} from "../../../../frontend/packages/reader/src/hooks/reader-initial-mode.ts";
import { defaultZoomForMode } from "../../../../frontend/packages/reader/src/pdf/reader-zoom.ts";
import { useReaderZoom } from "../../../../frontend/packages/reader/src/hooks/use-reader-zoom.ts";
import {
  loadReaderViewState,
  saveReaderViewState,
} from "../../../../frontend/packages/reader/src/shared/state/reader-view-state.ts";
import { installReaderDom } from "../helpers/dom.mjs";

// ---------------------------------------------------------------- HUD

const ASSISTANT_DOCK_CSS = readFileSync(
  new URL("../../../../frontend/packages/reader/styles/assistant-dock.css", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** 取出 `@media (max-width: 899px) { ... }` 的内部（可能有多段，全拼起来）。 */
function mediaBodies(css, query) {
  const bodies = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(query, from);
    if (at < 0) break;
    const open = css.indexOf("{", at);
    let depth = 0;
    let end = open;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    bodies.push(css.slice(open + 1, end));
    from = end;
  }
  return bodies.join("\n");
}

function declarationsFor(css, selector) {
  const found = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim().replace(/\s+/g, " "));
    if (selectors.includes(selector)) found.push(match[2]);
  }
  return found.join(";");
}

test("≤899px 面板铺满中间工作区（盖在书页上），底栏照旧在下面一行、不压面板", () => {
  const narrow = mediaBodies(ASSISTANT_DOCK_CSS, "@media (max-width: 899px)");
  assert.ok(narrow, "assistant-dock.css 里没有 ≤899px 的媒体查询了 —— 前提变了，重看这条测试");
  // 2026-11-28 三行壳层：停靠栏在中间工作区里铺满（absolute inset 0），底栏是工作区下面实占的一行，碰不到面板底部的搜索条。
  // 以前底栏浮在书页上，面板全屏时要把它藏掉，不然压着面板底部的视图切换和搜索框。
  const dock = declarationsFor(narrow, ".reader-dock");
  assert.match(dock, /position\s*:\s*absolute/);
  assert.match(dock, /inset\s*:\s*0/);
  assert.doesNotMatch(ASSISTANT_DOCK_CSS, /reader-react-hud|reader-bottombar[^{]*\{[^}]*display\s*:\s*none/, "面板开着时不该再藏底栏");
});

// ---------------------------------------------------------------- 默认模式

test("窄屏（<720）没有存档模式、有译文时，默认进译文模式，并标记为「自动」", () => {
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: undefined, sourceViewOnly: false, viewportWidth: 375 }),
    { mode: "translated", auto: true },
  );
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: undefined, sourceViewOnly: false, viewportWidth: 719 }),
    { mode: "translated", auto: true },
  );
});

test("宽屏没有存档时不动（保持会话默认的对照）", () => {
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: undefined, sourceViewOnly: false, viewportWidth: 720 }),
    { mode: null, auto: false },
  );
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: undefined, sourceViewOnly: false, viewportWidth: 1280 }),
    { mode: null, auto: false },
  );
});

test("存档里有用户选过的模式时，窄屏也尊重它", () => {
  for (const savedMode of ["compare", "source", "translated"]) {
    assert.deepEqual(
      resolveReaderInitialMode({ savedMode, sourceViewOnly: false, viewportWidth: 375 }),
      { mode: savedMode, auto: false },
    );
  }
});

test("没有译文时照旧原文（窄屏也不进译文模式）", () => {
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: undefined, sourceViewOnly: true, viewportWidth: 375 }),
    { mode: "source", auto: false },
  );
  assert.deepEqual(
    resolveReaderInitialMode({ savedMode: "translated", sourceViewOnly: true, viewportWidth: 375 }),
    { mode: "source", auto: false },
  );
});

test("自动套用的默认模式不写回存档；用户换过模式之后照常写", () => {
  assert.equal(shouldPersistReaderMode("translated", "translated"), false);
  assert.equal(shouldPersistReaderMode("compare", "translated"), true);
  assert.equal(shouldPersistReaderMode("compare", null), true);
});

// ---------------------------------------------------------------- 默认缩放

test("窄屏单栏默认缩放铺满阅读区；对照和宽屏照旧 50%", () => {
  assert.equal(defaultZoomForMode("translated", 375), 1);
  assert.equal(defaultZoomForMode("source", 375), 1);
  assert.equal(defaultZoomForMode("compare", 375), 0.5);
  assert.equal(defaultZoomForMode("translated", 1280), 0.5);
  assert.equal(defaultZoomForMode("translated", 720), 0.5);
  // 不传视口宽度时是旧行为
  assert.equal(defaultZoomForMode("translated"), 0.5);
});

function setViewport(dom, width) {
  Object.defineProperty(dom.window, "innerWidth", { value: width, configurable: true });
}

async function mountZoom(initialMode, key) {
  const mount = document.createElement("div");
  document.getElementById("root").appendChild(mount);
  const root = createRoot(mount);
  let latest = null;
  function Harness({ mode }) {
    latest = useReaderZoom(mode, undefined, key);
    return null;
  }
  await act(async () => root.render(createElement(Harness, { mode: initialMode })));
  return {
    root,
    api: () => latest,
    setMode: (mode) => act(async () => root.render(createElement(Harness, { mode }))),
  };
}

test("窄屏：用户没选过缩放时，模式从对照换到译文，缩放跟着换成铺满；且不写进存档", async () => {
  const env = installReaderDom();
  try {
    setViewport(env.dom, 375);
    const key = "job:narrow-zoom";
    const { root, api, setMode } = await mountZoom("compare", key);
    assert.equal(api().userZoom, 0.5);
    await setMode("translated");
    assert.equal(api().userZoom, 1, "窄屏译文单栏还停在 50%，页宽只有半屏");
    assert.equal(loadReaderViewState(key)?.zoom, undefined, "自动默认缩放被写进了存档");
    root.unmount();
  } finally {
    env.restore();
  }
});

test("窄屏：存档里有用户选过的缩放时，换模式不动它", async () => {
  const env = installReaderDom();
  try {
    setViewport(env.dom, 375);
    const key = "job:narrow-zoom-saved";
    saveReaderViewState(key, { zoom: 0.7 });
    const { root, api, setMode } = await mountZoom("compare", key);
    assert.equal(api().userZoom, 0.7);
    await setMode("translated");
    assert.equal(api().userZoom, 0.7);
    root.unmount();
  } finally {
    env.restore();
  }
});

test("窄屏：用户在本次会话里手动调过缩放后，换模式也不动它", async () => {
  const env = installReaderDom();
  try {
    setViewport(env.dom, 375);
    const key = "job:narrow-zoom-manual";
    const { root, api, setMode } = await mountZoom("compare", key);
    await act(async () => api().onZoomChange(0.6));
    await setMode("translated");
    assert.equal(api().userZoom, 0.6);
    root.unmount();
  } finally {
    env.restore();
  }
});
