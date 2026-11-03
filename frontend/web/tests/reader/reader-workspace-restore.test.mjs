/** （2026-11-03 起面板只剩 Markdown：RetainPDF 自己的 AI 终端删了，下面的例子从 terminal 换成 markdown。）
 * 阅读页的工作台：存下来的面板要真的回来。
 *
 * ## 这里守的三件事，以及它们各自是怎么被实测出来的
 *
 * 起开发栈、种一条 localStorage、真开阅读页量出来的（不是推断）：
 *
 * 1. 种 `{mode:"compare", assistantPanel:"markdown"}` → 刷新后 dock 是空的，
 *    而 storage 里那条**一直安然无恙**。也就是说存了，只是永远没人读。成因是
 *    恢复函数第一行判的是**当前**会话 mode，而有译文的书默认 mode 就是
 *    "compare"（reader-mode.ts）—— 翻译过的书必然中招。
 * 2. 种 `{mode:"translated", assistantPanel:"markdown"}` → dock 同样是空的，
 *    而且 storage 里那条**在 200ms 内被改写成 null**。恢复 mode 触发重渲染 →
 *    持久化 effect 跟着跑 → 把刚被丢弃的 null 写回去。不是少恢复一次，是删数据。
 * 3. 1440 宽、有译文的书上开一个终端 → 右栏让给面板，顶栏选中项从「对照」跳到
 *    「源文件」。顶栏原来有一条「辅助面板占了右半边…」的提示，用户要求删掉了；
 *    这里只守 composition 本身的取舍。
 *
 * ## 为什么第 2 条要真渲染
 *
 * 它是 effect 执行顺序的问题，源码门禁和纯函数测试都看不见。同 use-reader-
 * annotations 那条键迁移门禁，harness 也照抄它的。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  resolveReaderPaneComposition,
} from "../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx";
import { READER_ASSISTANT_PANEL_IDS } from "../../../../frontend/packages/reader/src/shared/types/reader-assistant-panels.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/reader.html",
  pretendToBeVisual: true,
});
for (const key of ["window", "document", "HTMLElement", "Element", "Event", "Node", "MouseEvent"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** 自己的 localStorage，为的是**记下每一次写**。
 *
 * 不给 jsdom 那个打补丁：它的 Storage 是个 Proxy，`localStorage.setItem = fn`
 * 会被当成「存一个叫 setItem 的键」，补丁一行不生效而测试照样绿 —— 这条门禁
 * 差点就是这么假掉的。 */
const writes = [];
const store = new Map();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { writes.push([key, `${value}`]); store.set(key, `${value}`); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  },
  writable: true,
  configurable: true,
});

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const {
  resolveInitialAssistantPanel,
  useReaderAssistantPanel,
} = await import("../../../../frontend/packages/reader/src/hooks/use-reader-assistant-panel.ts");

const KEY = (scope) => `retainpdf:reader:view:v1:${scope}`;
// 这几条门禁要看的是「这一帧有没有被写过错的值」，只看最后一次的话，
// 靠重渲染兜回来的那次会把中间的错写整个遮掉。
const writesTo = (scope) => writes
  .filter(([key]) => key === KEY(scope))
  .map(([, value]) => JSON.parse(value).assistantPanel);

const seed = (scope, patch) => localStorage.setItem(KEY(scope), JSON.stringify({
  schema: "retainpdf_reader_view_v1",
  updatedAt: 1,
  ...patch,
}));
const stored = (scope) => {
  const raw = localStorage.getItem(KEY(scope));
  return raw ? JSON.parse(raw) : null;
};

// ------------------------------------------------- 1. 恢复：纯函数真值表

test("恢复只看存下来的东西 —— 存的 mode 是哪个都不影响", () => {
  const savedModes = [undefined, "source", "compare", "translated"];
  const checked = [];
  for (const mode of savedModes) {
    for (const panel of READER_ASSISTANT_PANEL_IDS) {
      const saved = {
        schema: "retainpdf_reader_view_v1",
        updatedAt: 1,
        assistantPanel: panel,
        ...(mode ? { mode } : {}),
      };
      assert.equal(
        resolveInitialAssistantPanel(saved),
        panel,
        `saved.mode=${mode} 时 ${panel} 没恢复`,
      );
      checked.push(`${mode}/${panel}`);
    }
  }
  // 清单是从真源 map 出来的，漏登记一个面板这里的组合数会掉。
  assert.equal(checked.length, savedModes.length * READER_ASSISTANT_PANEL_IDS.length);
  assert.ok(READER_ASSISTANT_PANEL_IDS.length >= 1, "面板清单疑似漏登记");

  // 这条就是病 1 本身：有译文的书默认 mode 就是 compare。
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1",
    mode: "compare",
    assistantPanel: "markdown",
    updatedAt: 1,
  }), "markdown");
});

test("没存 / 存坏了 / 显式关着 都回 null，旧两栏布局按迁移规则读一次", () => {
  assert.equal(resolveInitialAssistantPanel(null), null);
  assert.equal(resolveInitialAssistantPanel(undefined), null);
  assert.equal(resolveInitialAssistantPanel({ schema: "retainpdf_reader_view_v1", updatedAt: 1 }), null);
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1", assistantPanel: null, updatedAt: 1,
  }), null);
  // 不认识的 id（上一个版本存的、或者手改的）不能原样恢复 —— 那会开出一个
  // 没有内容的面板。
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1", assistantPanel: "wormhole", updatedAt: 1,
  }), null);
  // 旧两栏布局里右栏是 AI 的：那个面板已经不存在，所以不开任何面板。迁到终端
  // 更糟 —— 会恢复出一个用户没要过的 agent 会话。
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1", splitLayout: { left: "source", right: "ai" }, updatedAt: 1,
  }), null);
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1", splitLayout: { left: "markdown", right: "source" }, updatedAt: 1,
  }), "markdown");
  assert.equal(resolveInitialAssistantPanel({
    schema: "retainpdf_reader_view_v1", splitLayout: { left: "source", right: "translated" }, updatedAt: 1,
  }), null);
});

// ----------------------------------------- 2. 恢复 / 持久化：真渲染

function mountPanel(viewStateKey) {
  const host = document.createElement("div");
  const root = createRoot(host);
  const seen = { api: null };
  function Probe({ scope }) {
    seen.api = useReaderAssistantPanel(scope);
    return null;
  }
  act(() => root.render(React.createElement(Probe, { scope: viewStateKey })));
  return {
    seen,
    rerender: (next) => act(() => root.render(React.createElement(Probe, { scope: next }))),
    set: (value) => act(() => seen.api.setPanel(value)),
    unmount: () => act(() => root.unmount()),
  };
}

test("存着 Markdown 面板的书，重开阅读页把它开回来", () => {
  localStorage.clear();
  writes.length = 0;
  seed("document:D1", { mode: "compare", assistantPanel: "markdown" });
  const view = mountPanel("document:D1");
  assert.equal(view.seen.api.panel, "markdown");
  // 写回的自始至终是它 —— 一次都不许写成 null。病 2 就是这么把它删掉的。
  assert.deepEqual([...new Set(writesTo("document:D1"))], ["markdown"]);
  view.unmount();
});

test("真实时序：viewStateKey 从空串 → job: → document:，存着的那条要活下来", () => {
  // 实测顺序（起开发栈量的）：第一帧 key 还是空串，随后 documentId 到了。
  localStorage.clear();
  writes.length = 0;
  seed("document:D2", { mode: "translated", assistantPanel: "markdown" });
  const view = mountPanel("");
  view.rerender("job:J2");
  view.rerender("document:D2");
  assert.equal(view.seen.api.panel, "markdown", "迁到 document: 之后没恢复");
  // 中间任何一帧都不许往 document 键上写别的 —— 那一瞬关掉页面就永久丢了。
  assert.deepEqual([...new Set(writesTo("document:D2"))], ["markdown"]);
  view.unmount();
});

test("键从 job: 迁到 document: 时，两个键都不会被对方的值盖掉（一帧都不行）", () => {
  localStorage.clear();
  writes.length = 0;
  seed("document:D3", { assistantPanel: "markdown" });
  const view = mountPanel("job:J3");
  assert.equal(view.seen.api.panel, null);
  view.set("markdown");
  assert.equal(stored("job:J3").assistantPanel, "markdown");

  // documentId 到了：按新键存的东西重新恢复。
  view.rerender("document:D3");
  assert.equal(view.seen.api.panel, "markdown", "新 scope 存的面板没恢复");
  assert.equal(view.seen.api.scope, "document:D3");
  assert.equal(stored("document:D3").assistantPanel, "markdown");
  assert.equal(stored("job:J3").assistantPanel, "markdown", "旧键被新 scope 的值盖了");

  // 要害在这条：迁移那一帧，新键**被写过一次** "markdown" 也不行。
  // 只看最后一次的话，下一帧的重渲染会把它改回 "markdown"，错写被完全遮住。
  assert.deepEqual(
    [...new Set(writesTo("document:D3"))],
    ["markdown"],
    "新键在迁移那一帧被旧 scope 的值写过",
  );
  assert.ok(writesTo("job:J3").includes("markdown"), "旧键根本没被写过，这条门禁是空的");
  view.unmount();
});

test("用户关掉面板就存 null —— 否则关了也白关", () => {
  localStorage.clear();
  writes.length = 0;
  seed("document:D4", { assistantPanel: "markdown" });
  const view = mountPanel("document:D4");
  assert.equal(view.seen.api.panel, "markdown");
  view.set(null);
  assert.equal(stored("document:D4").assistantPanel, null);
  view.unmount();
});

// --------------------------------------------- 3. 面板占了右栏时的台面

const compose = (patch) => resolveReaderPaneComposition({
  mode: "compare",
  sourceOnly: false,
  translatedUrl: "http://reader.local/translated.pdf",
  overlayContentAvailable: false,
  liveTranslationVisible: false,
  assistantOpen: false,
  assistantPdfPane: null,
  ...patch,
});

test("开着面板时对照退成单栏；从选区问 AI 锁哪一栏就留哪一栏", () => {
  const degraded = compose({ assistantOpen: true });
  assert.equal(degraded.visibleMode, "source");
  assert.equal(degraded.showTranslated, false, "右栏确实让给了面板");

  const locked = compose({ assistantOpen: true, assistantPdfPane: "translated" });
  assert.equal(locked.visibleMode, "translated");

  assert.equal(compose({}).visibleMode, "compare", "没开面板就还是对照");
});
