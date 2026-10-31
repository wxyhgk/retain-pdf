import test from "node:test";
import assert from "node:assert/strict";
import { makeDom, DOM_GLOBAL_KEYS, click, byId, typeInput, selectOption } from "../helpers/dom.mjs";
import { wait, waitFor } from "../helpers/async.mjs";
const dom = makeDom("", { keys: [...DOM_GLOBAL_KEYS, "HTMLTextAreaElement", "HTMLSelectElement"] });
const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { GlossariesDialog } = await import("../../src/features/glossaries/ui/GlossariesDialog.jsx");
const { createGlossariesViewFeature } = await import("../../src/features/glossaries/domain/glossaries-store.js");
const { mountGlossariesFeature } = await import("../../src/features/glossaries/domain/controller.js");

async function mount(t) {
  let closes = 0;
  const dialogStore = { open() {}, close() { closes++; } };
  const view = createGlossariesViewFeature({ dialogStore });
  const feature = mountGlossariesFeature({
    apiPrefix: "/api", viewPort: view.viewPort,
    fetchGlossaries: async () => ({ items: [{ glossary_id: "a", name: "化学", entry_count: 2 }, { glossary_id: "b", name: "物理", entry_count: 0 }] }),
    fetchGlossary: async id => ({ glossary_id: id, name: id === "a" ? "化学" : "物理", entries: id === "a" ? [{ source: "water", target: "水" }, { source: "atom", target: "原子" }] : [] }),
    createGlossary: async () => ({}), updateGlossary: async () => ({}), deleteGlossary: async () => ({}), exportGlossaryCsv: async () => ({}),
    parseGlossaryCsv: async (_prefix, text) => {
      assert.equal(text, "source,target,note,level,match_mode,context\r\nnew,新词,,,,");
      return { entries: [{ source: "new", target: "新词" }], entry_count: 1, duplicate_count: 0 };
    },
  });
  feature.bindEvents();
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  root.render(createElement(GlossariesDialog, { feature, view, open: true, dialogStore }));
  t.after(() => { root.unmount(); host.remove(); });
  await waitFor(() => byId(dom, "glossary-name")?.value === "化学", "glossary loaded");
  return { view, get closes() { return closes; } };
}

test("selecting a CSV file fills import text and appends entries after applying", async t => {
  const { view } = await mount(t);
  click(dom, byId(dom, "glossary-import-btn")); await wait(0);
  const input = byId(dom, "glossary-import-file");
  assert.ok(input, "file chooser is available");
  Object.defineProperty(input, "files", { value: [new File(["new,新词"], "词库.csv")] });
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await waitFor(() => byId(dom, "glossary-csv-text").value === "new,新词", "file decoded");
  assert.match(byId(dom, "glossary-import-panel").textContent, /词库.csv/);
  click(dom, byId(dom, "glossary-import-apply-btn"));
  await waitFor(() => view.editor.getSnapshot().draft.entries.length === 3, "append imported entries");
  assert.deepEqual(view.editor.getSnapshot().draft.entries.map(e => e.source), ["water", "atom", "new"]);
});

test("dropping a TSV file allows explicit replacement", async t => {
  const { view } = await mount(t);
  click(dom, byId(dom, "glossary-import-btn")); await wait(0);
  const event = new dom.window.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [new File(["new,新词"], "terms.tsv")] } });
  byId(dom, "glossary-import-panel").dispatchEvent(event);
  await waitFor(() => byId(dom, "glossary-csv-text").value === "new,新词", "drop decoded");
  selectOption(dom, byId(dom, "glossary-import-mode"), "replace"); await wait(0);
  click(dom, byId(dom, "glossary-import-apply-btn"));
  await waitFor(() => view.editor.getSnapshot().draft.entries[0]?.source === "new", "replace imported entries");
  assert.equal(view.editor.getSnapshot().draft.entries.length, 1);
});

test("searching entries retains original edit/delete indexes and library search filters names", async t => {
  const { view } = await mount(t);
  const search = byId(dom, "glossary-entry-search"); assert.ok(search);
  typeInput(dom, search, "atom"); await wait(0);
  const row = byId(dom, "glossary-entries").querySelector("tr");
  assert.equal(byId(dom, "glossary-entries").querySelectorAll("tr").length, 1);
  typeInput(dom, row.querySelector(".glossary-entry-target"), "原子改译"); await wait(0);
  assert.equal(view.editor.getSnapshot().draft.entries[1].target, "原子改译");
  click(dom, row.querySelector(".glossary-entry-remove")); await wait(0);
  assert.deepEqual(view.editor.getSnapshot().draft.entries.map(e => e.source), ["water"]);
  typeInput(dom, byId(dom, "glossary-list-search"), "物理"); await wait(0);
  assert.equal(byId(dom, "glossary-list").querySelectorAll("button").length, 1);
  assert.match(byId(dom, "glossary-list").textContent, /物理/);
});

test("unsaved edits require confirmation before closing or switching libraries", async t => {
  const setup = await mount(t);
  typeInput(dom, byId(dom, "glossary-name"), "未保存名称"); await wait(0);
  click(dom, byId(dom, "glossary-close-btn")); await wait(0);
  assert.equal(setup.closes, 0);
  assert.ok(byId(dom, "glossary-discard-confirm"));
  const cancel = [...byId(dom, "glossary-discard-confirm").querySelectorAll("button")].find(b => b.textContent === "继续编辑");
  click(dom, cancel); await wait(20);
  click(dom, byId(dom, "glossary-list").querySelectorAll("button")[1]); await wait(0);
  assert.equal(byId(dom, "glossary-name").value, "未保存名称");
  click(dom, byId(dom, "glossary-discard-confirm-confirm"));
  await waitFor(() => byId(dom, "glossary-name").value === "物理", "confirmed navigation");
});

test("loading prevents file import and editing until the glossary is ready", async t => {
  const { view } = await mount(t);
  view.store.actions.setLoading(true); await wait(0);
  for (const id of ["glossary-import-btn", "glossary-save-btn", "glossary-new-btn", "glossary-name", "glossary-import-file"]) {
    assert.equal(byId(dom, id).disabled, true, id);
  }
  view.store.actions.setLoading(false); await wait(0);
  assert.equal(byId(dom, "glossary-import-btn").disabled, false);
});

test("context can be edited and filtered bulk deletion removes only selected rows", async t => {
  const { view } = await mount(t);
  const context = document.querySelector(".glossary-entry-context");
  assert.ok(context, "context editor is visible");
  typeInput(dom, context, "chemistry"); await wait(0);
  assert.equal(view.viewPort.readEditorPayload().entries[0].context, "chemistry");
  typeInput(dom, byId(dom, "glossary-entry-search"), "atom"); await wait(0);
  click(dom, document.querySelector('[aria-label="选择全部可见词条"]')); await wait(0);
  click(dom, byId(dom, "glossary-delete-selected")); await wait(0);
  assert.equal(view.editor.getSnapshot().draft.entries.length, 2, "confirmation precedes deletion");
  click(dom, byId(dom, "glossary-delete-entries-confirm-confirm")); await wait(0);
  assert.deepEqual(view.editor.getSnapshot().draft.entries.map(e => e.source), ["water"]);
  assert.equal(view.editor.getSnapshot().draft.entries[0].context, "chemistry");
});
