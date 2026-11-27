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
