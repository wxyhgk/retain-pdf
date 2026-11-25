/** 阅读页第二栏（@retainpdf/reader 的 sidePane 口子，contracts/side-pane.ts）：
 * 宿主加一个页签，阅读器只给「按锚点跳」「页边小圆点」「现在第几页」三样，不认识里面是什么。
 * 设计见 docs/ops/planning/learning-system/20261125-学习页签接进阅读器.md。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement, act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";

import { installReaderDom } from "../helpers/dom.mjs";
import {
  resolveMarginMarkers,
  useReaderSidePane,
} from "../../../packages/reader/src/hooks/use-reader-side-pane.ts";
import { marginMarkerTops, MarginMarkerLayer } from "../../../packages/reader/src/pdf/MarginMarkerLayer.tsx";
import { ReaderWorkspaceTabs } from "../../../packages/reader/src/components/react-pdf/ReaderWorkspaceTabs.tsx";
import { ReaderSidePane } from "../../../packages/reader/src/components/react-pdf/ReaderSidePane.tsx";
import { READER_ADAPTER_KEYS } from "../../../packages/reader/src/adapters.ts";

const box = (page, text) => ({ page, bbox: [50, 100, 500, 140], text });
const region = (itemId, page, text, translatedPage = page) => ({
  itemId,
  source: box(page, text),
  translated: box(translatedPage, `译：${text}`),
  markdown: text,
  regionType: "paragraph",
  status: "translated",
  assetIds: [],
  assetUrls: [],
});

const REGIONS = [
  region("p129-b0", 129, "3.1.2 The Fock Operator"),
  region("p151-b3", 151, "3.4.2 Introduction of a Basis: The Roothaan Equations", 152),
];

test("页边小圆点：按块编号、按原文、只给页码都落得到；页码不对的丢掉", () => {
  const byPage = resolveMarginMarkers(REGIONS, [
    { key: "fock", label: "Fock 算符", tone: "ok", anchor: { page: 129, itemId: "p129-b000" } },
    { key: "roothaan", label: "Roothaan", tone: "danger", anchor: { page: 151, quote: "Introduction of a Basis: The Roothaan Equations" } },
    { key: "scf", label: "SCF", tone: "muted", hollow: true, anchor: { page: 160 } },
    { key: "bad", label: "坏的", tone: "warn", anchor: { page: 0 } },
  ], "source");
  assert.deepEqual([...byPage.keys()].sort((a, b) => a - b), [129, 151, 160]);
  assert.equal(byPage.get(129)[0].itemId, "p129-b0", "p129-b000 和 p129-b0 是同一块");
  assert.equal(byPage.get(151)[0].itemId, "p151-b3", "没给块编号时按这一页上的原文找");
  assert.deepEqual(byPage.get(160)[0], { key: "scf", page: 160, itemId: null, tone: "muted", hollow: true, label: "SCF" });

  const translated = resolveMarginMarkers(REGIONS, [
    { key: "roothaan", label: "Roothaan", tone: "danger", anchor: { page: 151, itemId: "p151-b3" } },
  ], "translated");
  assert.ok(translated.has(152), "译文栏按译文里的页码画");
});

test("同一块上的几个点往下错开；找不到块的画在页顶", () => {
  const markers = [
    { key: "a", page: 1, itemId: "x", tone: "ok", hollow: false, label: "a" },
    { key: "b", page: 1, itemId: "x", tone: "danger", hollow: false, label: "b" },
    { key: "c", page: 1, itemId: null, tone: "muted", hollow: true, label: "c" },
  ];
  const tops = marginMarkerTops(markers, [{ itemId: "x", rect: { top: 100, height: 20 } }]);
  assert.equal(tops[0], 104);
  assert.ok(tops[1] > tops[0] + 12, "第二个点不压在第一个上");
  assert.equal(tops[2], 12);

  const html = renderToStaticMarkup(createElement(MarginMarkerLayer, { markers, targets: [] }));
  assert.match(html, /class="reader-margin-marker is-ok"/);
  assert.match(html, /class="reader-margin-marker is-muted is-hollow"/);
  assert.match(html, /aria-label="c"/);
});

test("顶栏：宿主给了第二栏才多一个页签；开着时原文 / 对照 / 译文都不算选中", () => {
  const base = { mode: "compare", documentReady: true, sourceViewOnly: false, onModeChange: () => {} };
  const none = renderToStaticMarkup(createElement(ReaderWorkspaceTabs, base));
  assert.doesNotMatch(none, /data-reader-side-tab/);

  const closed = renderToStaticMarkup(createElement(ReaderWorkspaceTabs, { ...base, sidePane: { label: "学习", active: false, onSelect: () => {} } }));
  assert.match(closed, /data-reader-side-tab/);
  assert.match(closed, /aria-label="对照"[^>]*aria-selected="true"|aria-selected="true"[^>]*aria-label="对照"/);

  const open = renderToStaticMarkup(createElement(ReaderWorkspaceTabs, { ...base, sidePane: { label: "学习", active: true, onSelect: () => {} } }));
  assert.equal((open.match(/aria-selected="true"/g) || []).length, 1, "只有「学习」选中");
  assert.match(open, /reader-workspace-tab--side is-active/);
});

test("adapters 登记了 sidePane（可选）", () => {
  assert.ok(READER_ADAPTER_KEYS.includes("sidePane"));
});

async function mount(element, holder) {
  const root = createRoot(holder);
  await act(async () => root.render(element));
  return root;
}

test("hook：关着不给 api、不画点；开着跳转转成阅读器的锚点；这本书没有就不出；宿主出错当作没有", async () => {
  const env = installReaderDom();
  try {
    const jumps = [];
    let latest = null;
    const port = { label: "学习", isAvailableFor: ({ documentId }) => documentId === "doc-1", render: () => null };
    function Harness(props) {
      latest = useReaderSidePane({
        port: props.port ?? port,
        open: props.open,
        documentId: props.documentId,
        jobId: "job-1",
        currentPage: 3,
        regions: REGIONS,
        pane: "source",
        jumpToAnchor: (target) => {
          jumps.push(target);
          return "block";
        },
        close: () => {},
      });
      return null;
    }
    const holder = document.getElementById("root");
    const root = await mount(createElement(Harness, { open: false, documentId: "doc-1" }), holder);
    assert.equal(latest.available, true);
    assert.equal(latest.api, null, "没打开不给宿主能力");

    await act(async () => root.render(createElement(Harness, { open: true, documentId: "doc-1" })));
    assert.equal(latest.api.currentPage, 3);
    assert.equal(latest.api.navigateToAnchor({ page: 129, itemId: "p129-b000", quote: "The Fock Operator" }), "block");
    assert.deepEqual(jumps.at(-1), { block_id: "p129-b000", page: 129, snippet: "The Fock Operator" });

    const selected = [];
    await act(async () => latest.api.setMarginMarkers([
      { key: "fock", label: "Fock", tone: "ok", anchor: { page: 129, itemId: "p129-b0" } },
    ], (key) => selected.push(key)));
    assert.equal(latest.markersByPage.get(129).length, 1);
    latest.selectMarker("fock");
    assert.deepEqual(selected, ["fock"]);

    await act(async () => root.render(createElement(Harness, { open: false, documentId: "doc-1" })));
    assert.equal(latest.markersByPage.size, 0, "关掉第二栏，原文 / 对照 / 译文里不画点");

    await act(async () => root.render(createElement(Harness, { open: true, documentId: "doc-2" })));
    assert.equal(latest.available, false, "这本书宿主说没有");
    assert.equal(latest.api, null);

    const broken = { label: "坏", isAvailableFor: () => { throw new Error("boom"); }, render: () => null };
    await act(async () => root.render(createElement(Harness, { open: true, documentId: "doc-1", port: broken })));
    assert.equal(latest.available, false, "宿主判断出错当作没有，不带崩阅读页");
    await act(async () => root.unmount());
  } finally {
    env.restore();
  }
});

test("宿主内容出错只在第二栏里说一句，不把阅读页带崩", async () => {
  const env = installReaderDom();
  const originalError = console.error;
  console.error = () => {};
  try {
    const api = { documentId: "d", jobId: "j", currentPage: 1, navigateToAnchor: () => "none", setMarginMarkers: () => {}, close: () => {} };
    const port = { label: "学习", isAvailableFor: () => true, render: () => createElement(() => { throw new Error("宿主炸了"); }) };
    const holder = document.getElementById("root");
    const root = await mount(createElement(ReaderSidePane, { port, api }), holder);
    const alert = holder.querySelector(".reader-side-pane-error");
    assert.ok(alert, "有错误提示");
    assert.match(alert.textContent, /宿主炸了/);
    assert.equal(holder.querySelector("#reader-side-pane").getAttribute("aria-label"), "学习");
    await act(async () => root.unmount());
  } finally {
    console.error = originalError;
    env.restore();
  }
});
