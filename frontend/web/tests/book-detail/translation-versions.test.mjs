// 「译文版本」卡：一本书的几份译文能切换（后端 feat/translation-versions）。
// 下拉第一项「自动（最新）」= version_id null；选了固定版本又翻出新的时提示「有新版本」；改名、隐藏、恢复；
// 只有一份译文的书不显示；每次动作后重读全的列表（连隐藏的）。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { click, makeDom, selectOption, typeInput } from "../helpers/dom.mjs";
import {
  hasVersionChoice,
  newestVersion,
  normalizeVersionLabel,
  versionLabel,
  versionOptions,
} from "../../src/features/book-detail/domain/translation-versions-model.js";

function version(id, extra = {}) {
  return {
    version_id: id, name: `名字 ${id}`, label: "", origin: "translate", base_version_id: null,
    created_at: "2026-11-18T09:05:00", hidden: false, status: "succeeded", job_ids: [`job-${id}`],
    page_ranges: [[1, 10]], whole_book: true, engine: "legacy", model: "m", reviewer_model: "",
    edited_blocks: 0, is_current: false, ...extra,
  };
}

function view(versions, current = null, hasNewer = false) {
  return { document_id: "doc-1", current_version_id: current, has_newer: hasNewer, versions };
}

test("版本模型：下拉先「自动」再新的在上；隐藏的不列（除非正选着）；名字带时间、改过几处、翻译中", () => {
  const v = view([
    version("tv-a", { edited_blocks: 3 }),
    version("tv-b", { hidden: true }),
    version("tv-c", { status: "running", name: "精翻 · haiku（第 3–5 页）" }),
  ]);
  assert.deepEqual(versionOptions(v).map((o) => o.value), ["", "tv-c", "tv-a"]);
  assert.equal(versionLabel(v.versions[0]), "名字 tv-a · 11月18日 09:05 · 改过 3 处");
  assert.equal(versionLabel(v.versions[2]), "精翻 · haiku（第 3–5 页） · 11月18日 09:05 · 翻译中");
  // 选中的版本后来被隐藏了：仍然列出来，下拉不空
  assert.deepEqual(versionOptions({ ...v, current_version_id: "tv-b" }).map((o) => o.value), ["", "tv-c", "tv-b", "tv-a"]);
});

test("版本模型：只有一份、没选过不显示；有新版本取最后一份没隐藏的；改名去空白、最多 80 字", () => {
  assert.equal(hasVersionChoice(null), false);
  assert.equal(hasVersionChoice(view([version("tv-a")])), false);
  assert.equal(hasVersionChoice(view([version("tv-a")], "tv-a")), true);
  assert.equal(hasVersionChoice(view([version("tv-a"), version("tv-b")])), true);
  assert.equal(newestVersion(view([version("tv-a"), version("tv-b")], "tv-a", false)), null);
  assert.equal(newestVersion(view([version("tv-a"), version("tv-b"), version("tv-c", { hidden: true })], "tv-a", true)).version_id, "tv-b");
  assert.equal(normalizeVersionLabel("  第一版  "), "第一版");
  assert.equal([...normalizeVersionLabel("译".repeat(90))].length, 80);
});

async function mountHarness(api) {
  const dom = makeDom("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLSelectElement", "HTMLFormElement", "Element", "Event", "MouseEvent", "Node", "MutationObserver"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useTranslationVersions } = await import("../../src/features/book-detail/ui/use-translation-versions.js");
  const { TranslationVersionsPanel } = await import("../../src/features/book-detail/ui/panels/overview/TranslationVersionsPanel.jsx");
  const jobs = [{ job_id: "job-1", status: "succeeded" }];
  function Harness() {
    const versions = useTranslationVersions({ open: true, documentId: "doc-1", jobs, api });
    return React.createElement(TranslationVersionsPanel, {
      view: versions.view, busy: versions.busy, error: versions.error,
      onSelect: versions.select, onRename: versions.rename, onSetHidden: versions.setHidden,
    });
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  return { dom, doc: dom.window.document, root };
}

test("版本卡：切换走 PUT（自动 = null）、有新版本可以一键回到自动；动作后重读连隐藏的列表", async () => {
  let state = view([version("tv-a"), version("tv-b")], "tv-a", true);
  const calls = [];
  const api = {
    list: async (documentId) => { calls.push(["list", documentId]); return state; },
    select: async (documentId, versionId) => {
      calls.push(["select", documentId, versionId]);
      state = view(state.versions, versionId, versionId === "tv-a");
      return { ...state, versions: state.versions.filter((v) => !v.hidden) };
    },
    patch: async () => state,
  };
  const { dom, doc, root } = await mountHarness(api);
  await waitFor(() => doc.querySelector("[data-book-detail-section='versions']"), "版本卡");
  const select = doc.querySelector("#book-detail-translation-version");
  assert.equal(select.value, "tv-a");
  assert.match(doc.querySelector("[data-versions-newer]").textContent, /有新版本：名字 tv-b/);

  selectOption(dom, select, "tv-b");
  await waitFor(() => calls.some((c) => c[0] === "select" && c[2] === "tv-b"), "PUT tv-b");
  await waitFor(() => !doc.querySelector("[data-versions-newer]"), "选了最新就不提示");

  selectOption(dom, doc.querySelector("#book-detail-translation-version"), "");
  await waitFor(() => calls.some((c) => c[0] === "select" && c[2] === null), "自动 = null");
  await waitFor(() => doc.querySelector("#book-detail-translation-version").value === "", "下拉回到自动");
  assert.match(doc.querySelector(".book-detail-versions-hint").textContent, /新译文翻完自动换上/);
  // 每次切换后都重读一次全的列表
  assert.equal(calls.filter((c) => c[0] === "list").length, 3);
  root.unmount();
});

test("版本卡：改名（去空白）、隐藏、恢复走 PATCH；失败就地说原因；只有一份译文时不画", async () => {
  let state = view([version("tv-a"), version("tv-b")]);
  const patches = [];
  let failNext = false;
  const api = {
    list: async () => state,
    select: async () => state,
    patch: async (documentId, versionId, payload) => {
      if (failNext) { failNext = false; throw new Error("这个版本不存在"); }
      patches.push([versionId, payload]);
      state = view(state.versions.map((v) => (v.version_id === versionId
        ? { ...v, ...("label" in payload ? { label: payload.label, name: payload.label || v.name } : {}), ...("hidden" in payload ? { hidden: payload.hidden } : {}) }
        : v)));
      return state;
    },
  };
  const { dom, doc, root } = await mountHarness(api);
  await waitFor(() => doc.querySelector("[data-book-detail-section='versions']"), "版本卡");
  const item = (id) => doc.querySelector(`[data-version-id="${id}"]`);

  click(dom, item("tv-a").querySelector('[data-version-action="rename"]'));
  const input = await waitFor(() => item("tv-a").querySelector("input"), "改名输入框");
  typeInput(dom, input, "  初版  ");
  item("tv-a").querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(() => patches.length === 1, "PATCH label");
  assert.deepEqual(patches[0], ["tv-a", { label: "初版" }]);
  await waitFor(() => /初版/.test(item("tv-a").textContent) && !item("tv-a").querySelector("input"), "改名后显示新名字");

  click(dom, item("tv-b").querySelector('[data-version-action="hide"]'));
  await waitFor(() => item("tv-b").dataset.hidden === "true", "隐藏");
  assert.deepEqual(patches[1], ["tv-b", { hidden: true }]);
  assert.match(item("tv-b").textContent, /已隐藏/);
  // 隐藏的不进下拉
  assert.deepEqual([...doc.querySelectorAll("#book-detail-translation-version option")].map((o) => o.value), ["", "tv-a"]);

  failNext = true;
  click(dom, item("tv-b").querySelector('[data-version-action="unhide"]'));
  await waitFor(() => doc.querySelector(".book-detail-versions-error"), "失败提示");
  assert.match(doc.querySelector(".book-detail-versions-error").textContent, /这个版本不存在/);
  click(dom, item("tv-b").querySelector('[data-version-action="unhide"]'));
  await waitFor(() => !item("tv-b").dataset.hidden, "恢复");
  assert.deepEqual(patches[2], ["tv-b", { hidden: false }]);
  assert.equal(doc.querySelector(".book-detail-versions-error"), null);
  root.unmount();

  // 只有一份译文：不画
  const single = await mountHarness({ list: async () => view([version("tv-a")]), select: async () => null, patch: async () => null });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(single.doc.querySelector("[data-book-detail-section='versions']"), null);
  single.root.unmount();
});
