// 阅读页贡献表（packages/reader/src/extensions/，2026-11-27）：登记顺序、出错隔离、扩展自己画的浮层、右键菜单项、快捷键说明、不死循环。
import test from "node:test";
import assert from "node:assert/strict";

import { installReaderDom } from "../helpers/dom.mjs";

const registry = () => import("../../../packages/reader/src/extensions/registry.tsx");

test("贡献表：按第一次登记的顺序，改内容不挪位置，拿掉就没了", async () => {
  const { createContributionStore } = await registry();
  const store = createContributionStore();
  let notified = 0;
  store.subscribe(() => { notified += 1; });
  store.set("a", "甲", { shortcuts: [{ keys: "A", desc: "一" }] });
  store.set("b", "乙", {});
  store.set("a", "甲", { shortcuts: [{ keys: "A", desc: "二" }] });
  assert.deepEqual(store.getSnapshot().map((entry) => entry.id), ["a", "b"]);
  assert.equal(store.getSnapshot()[0].contribution.shortcuts[0].desc, "二");
  const before = store.getSnapshot();
  store.remove("missing");
  assert.equal(store.getSnapshot(), before, "拿掉不存在的不换快照");
  store.remove("a");
  assert.deepEqual(store.getSnapshot().map((entry) => entry.id), ["b"]);
  assert.equal(notified, 4);
});

test("右键菜单项：按扩展顺序、key 前面带扩展名；哪个扩展算菜单出错就跳过它", async () => {
  const { collectMenuItems, collectPageLayers, collectShortcutGroups } = await registry();
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args[0]);
  try {
    const seen = [];
    const contributions = [
      { id: "ask", title: "提问", contribution: { menuItems: (context) => { seen.push(context.page); return [{ key: "x", label: "在这里提问", onSelect() {} }]; } } },
      { id: "broken", title: "坏的", contribution: { menuItems: () => { throw new Error("boom"); } } },
      { id: "notes", title: "笔记", contribution: { menuItems: () => [{ key: "y", label: "记一笔", onSelect() {} }], pageLayer: () => null, shortcuts: [{ keys: "N", desc: "记一笔" }] } },
    ];
    const items = collectMenuItems(contributions, { target: {}, clientX: 1, clientY: 2, page: 7 });
    assert.deepEqual(items.map((item) => [item.key, item.label]), [["ask:x", "在这里提问"], ["notes:y", "记一笔"]]);
    assert.deepEqual(seen, [7]);
    assert.equal(errors.length, 1);
    assert.deepEqual(collectPageLayers(contributions).map((layer) => layer.id), ["notes"]);
    assert.deepEqual(collectShortcutGroups(contributions), [{ title: "笔记", items: [{ keys: "N", desc: "记一笔" }] }]);
  } finally {
    console.error = original;
  }
});

test("挂扩展：扩展画的浮层画出来；一个扩展出错只丢掉它自己；卸下就从表里拿掉；快捷键说明列出扩展那一组；阅读页跟着表重画不带着扩展转圈", async () => {
  const env = installReaderDom();
  const original = console.error;
  console.error = () => {};
  try {
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { act } = React;
    const { createContributionStore, ReaderExtensionOutlets, ReaderExtensionsProvider, useReaderApi, useReaderContribution, useReaderContributionsOf } = await registry();
    const { ReaderShortcutsHelp } = await import("../../../packages/reader/src/components/react-pdf/ReaderShortcutsHelp.tsx");
    const store = createContributionStore();
    const api = { documentId: "doc-1", jobId: "job-1", versionId: null, regions: [], metadata: null, bookmarks: [], pageCount: 3, resetKey: "k", hoveredItemId: () => null, goToPage() {} };
    let notesRenders = 0;
    function Notes() {
      notesRenders += 1;
      const reader = useReaderApi();
      // 每次画都是新的贡献对象（像提问那样跟着自己的状态变）：阅读页因此重画时不能再带着扩展重画，不然停不下来。
      useReaderContribution({ shortcuts: [{ keys: "N", desc: "记一笔" }] });
      return React.createElement("div", { id: "notes-overlay" }, `笔记 · ${reader.documentId}`);
    }
    function Broken() {
      throw new Error("坏了");
    }
    const extensions = [
      { id: "broken", title: "坏的", Component: Broken },
      { id: "notes", title: "笔记", Component: Notes },
    ];
    const root = createRoot(env.dom.window.document.getElementById("root"));
    // 像阅读页那样：读自己建的表，表一变就重画，扩展挂在里面。
    let hostRenders = 0;
    function Host({ list }) {
      hostRenders += 1;
      useReaderContributionsOf(store);
      return React.createElement(ReaderExtensionsProvider, { api, store },
        React.createElement(ReaderShortcutsHelp),
        React.createElement(ReaderExtensionOutlets, { extensions: list }));
    }
    const render = (list) => React.createElement(Host, { list });
    await act(async () => { root.render(render(extensions)); });
    assert.ok(hostRenders < 5 && notesRenders < 5, `重画了 ${hostRenders} / ${notesRenders} 次`);
    const doc = env.dom.window.document;
    assert.equal(doc.getElementById("notes-overlay")?.textContent, "笔记 · doc-1");
    assert.deepEqual(store.getSnapshot().map((entry) => entry.id), ["notes"]);
    await act(async () => { doc.querySelector(".reader-react-shortcuts-btn").click(); });
    const titles = [...doc.querySelectorAll(".reader-react-shortcuts-group h3")].map((node) => node.textContent);
    assert.equal(titles.at(-1), "笔记");
    assert.match(doc.querySelector(".reader-react-shortcuts-body").textContent, /N记一笔/);
    await act(async () => { root.render(render([])); });
    assert.equal(doc.getElementById("notes-overlay"), null);
    assert.deepEqual(store.getSnapshot(), []);
    await act(async () => { root.unmount(); });
  } finally {
    console.error = original;
    env.restore();
  }
});

test("文字层标记（textMarks）：几个扩展的合在一起，重叠的先到的赢，只认 data-* 属性，搜索词照旧在段里高亮，转义", async () => {
  const { renderMarkedText } = await import("../../../packages/reader/src/shared/content/reader-text-marks.ts");
  const { collectTextMarks } = await registry();
  const text = "see Figure 2 and <x> Eq 3";
  const marks = collectTextMarks([
    { id: "xrefs", title: "引用", contribution: { textMarks: () => [{ start: 4, end: 12, className: "reader-xref", attrs: { "data-xref": "figure:2", onclick: "x()" } }] } },
    { id: "other", title: "别的", contribution: { textMarks: () => [{ start: 8, end: 14, className: "other" }, { start: 21, end: 25, className: "eq" }] } },
    { id: "broken", title: "坏的", contribution: { textMarks: () => { throw new Error("boom"); } } },
  ]);
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(
      renderMarkedText(text, marks(text), "and"),
      'see <mark class="reader-xref" data-xref="figure:2">Figure 2</mark> <mark class="reader-find-mark">and</mark> &lt;x&gt; <mark class="eq">Eq 3</mark>',
    );
  } finally {
    console.error = original;
  }
  assert.equal(collectTextMarks([{ id: "a", title: "", contribution: {} }]), null, "没人给就不改文字层");
  assert.equal(renderMarkedText("a<b", [], ""), "a&lt;b");
});

test("画笔扩展的贡献：小球按钮跟着画笔开没开亮、点了进出画笔；画笔模式占着指针；离视口远的页不画笔迹；右键菜单里那一排", async () => {
  const { inkContribution } = await import("../../../packages/reader/src/extensions/builtin/ink.tsx");
  const { collectMenuSections, pointerTakenBy } = await registry();
  let tool = null;
  const ink = (current) => ({ tool: current, color: "ok", strokes: [], setTool: (next) => { tool = next; }, setColor() {}, add() {}, erase() {}, undo() {}, clearPage() {} });
  const off = inkContribution(ink(null));
  assert.equal(off.toolbarItems[0].key, "ink");
  assert.equal(off.toolbarItems[0].pressed, false);
  off.toolbarItems[0].onClick();
  assert.equal(tool, "pen", "点了进画笔");
  assert.equal(off.takesPointer, false);
  const on = inkContribution(ink("pen"));
  assert.equal(on.toolbarItems[0].pressed, true);
  on.toolbarItems[0].onClick();
  assert.equal(tool, null, "再点退出");
  assert.equal(on.takesPointer, true);
  assert.equal(on.pageLayer({ page: 1, width: 100, height: 140, pane: "source", active: false }), null, "没画的页不画笔迹");
  assert.ok(on.pageLayer({ page: 1, width: 100, height: 140, pane: "compare", active: true }), "画着的页有笔迹层");
  const entries = [{ id: "ask", title: "提问", contribution: {} }, { id: "ink", title: "画笔", contribution: on }];
  assert.deepEqual(collectMenuSections(entries).map((section) => section.id), ["ink"]);
  assert.equal(pointerTakenBy(entries), "ink");
  assert.equal(pointerTakenBy([{ id: "ink", title: "画笔", contribution: off }]), null);
});
