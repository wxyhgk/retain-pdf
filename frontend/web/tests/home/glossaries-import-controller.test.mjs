import test from "node:test";
import assert from "node:assert/strict";
import { mountGlossariesFeature } from "../../src/features/glossaries/domain/controller.js";
import { createGlossariesViewFeature } from "../../src/features/glossaries/domain/glossaries-store.js";

function setup(parse, overrides = {}) {
  const view = createGlossariesViewFeature({ dialogStore: { open() {}, close() {} } });
  view.viewPort.renderEditor({ name: "术语", entries: [{ source: "unfinished", target: "", level: "canonical", context: "biology" }] });
  const feature = mountGlossariesFeature({
    apiPrefix: "/api", viewPort: view.viewPort,
    fetchGlossaries: async () => ({ items: [] }), fetchGlossary: async () => ({}),
    createGlossary: async () => ({}), updateGlossary: async () => ({}), deleteGlossary: async () => ({}),
    exportGlossaryCsv: async () => ({}), parseGlossaryCsv: parse,
    ...overrides,
  });
  feature.bindEvents();
  view.editor.actions.setCsvText("new,新词");
  return { view, feature, handlers: view.handlersRef.current };
}

test("append imports preserve incomplete edits and report duplicates without saving", async () => {
  const { view, handlers } = setup(async () => ({ entries: [{ source: "new", target: "新词" }], entry_count: 1, duplicate_count: 2 }));
  await handlers.applyImport();
  assert.deepEqual(view.editor.getSnapshot().draft.entries.map(e => e.source), ["unfinished", "new"]);
  assert.equal(view.editor.getSnapshot().draft.entries[0].context, "biology");
  assert.match(view.store.getSnapshot().status.message, /2.*重复/);
  assert.notDeepEqual(view.editor.getSnapshot().draft, view.editor.getSnapshot().savedDraft);
});

test("empty and failed parses leave the draft and input intact", async () => {
  for (const parse of [async () => ({ entries: [], entry_count: 0 }), async () => { throw new Error("row 3: missing target"); }]) {
    const { view, handlers } = setup(parse);
    const before = view.editor.getSnapshot().draft;
    await handlers.applyImport("replace");
    assert.deepEqual(view.editor.getSnapshot().draft, before);
    assert.equal(view.editor.getSnapshot().csvText, "new,新词");
    assert.equal(view.store.getSnapshot().status.tone, "error");
  }
});

test("late import results cannot overwrite a newly created glossary", async () => {
  let finish;
  const { view, handlers } = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = handlers.applyImport();
  handlers.createNew();
  finish({ entries: [{ source: "stale", target: "过期" }], entry_count: 1 });
  await pending;
  assert.equal(view.editor.getSnapshot().draft.name, "未命名术语表");
  assert.ok(!view.editor.getSnapshot().draft.entries.some(e => e.source === "stale"));
});

test("saving cannot discard pending import text", async () => {
  const { view, handlers } = setup(async () => ({}));
  view.editor.actions.updateEntryField({ index: 0, field: "target", value: "已填写" });
  const before = view.editor.getSnapshot();
  await handlers.save();
  assert.match(view.store.getSnapshot().status.message, /导入/);
  assert.equal(view.editor.getSnapshot().csvText, before.csvText);
  assert.deepEqual(view.editor.getSnapshot().draft, before.draft);
});

test("late parsing preserves edits made during the request", async () => {
  let finish;
  const { view, handlers } = setup(() => new Promise(resolve => { finish = resolve; }));
  const pending = handlers.applyImport();
  view.editor.actions.setName("编辑中的名称");
  finish({ entries: [{ source: "stale", target: "过期" }], entry_count: 1 });
  await pending;
  assert.equal(view.editor.getSnapshot().draft.name, "编辑中的名称");
  assert.equal(view.editor.getSnapshot().draft.entries[0].source, "unfinished");
  assert.equal(view.editor.getSnapshot().csvText, "new,新词");
  assert.equal(view.store.getSnapshot().status.tone, "error");
});

test("failed selection keeps the loaded glossary selected and can be retried", async () => {
  let fail = true;
  const { view, handlers } = setup(async () => ({}), { fetchGlossary: async id => {
    if (id === "b" && fail) throw new Error("network failure");
    return { glossary_id: id, name: id, entries: [] };
  } });
  await handlers.selectGlossary("a");
  await handlers.selectGlossary("b");
  assert.equal(view.store.getSnapshot().selectedId, "a");
  assert.equal(view.editor.getSnapshot().draft.name, "a");
  fail = false;
  await handlers.selectGlossary("b");
  assert.equal(view.store.getSnapshot().selectedId, "b");
  assert.equal(view.editor.getSnapshot().draft.name, "b");
});

test("initial loading is observable until the detail request completes", async () => {
  let finish;
  const { view, feature } = setup(async () => ({}), {
    fetchGlossaries: async () => ({ items: [{ glossary_id: "a" }] }),
    fetchGlossary: () => new Promise(resolve => { finish = resolve; }),
  });
  const opening = feature.open();
  await Promise.resolve();
  assert.equal(view.store.getSnapshot().loading, true);
  finish({ glossary_id: "a", name: "a", entries: [] });
  await opening;
  assert.equal(view.store.getSnapshot().loading, false);
});

test("initial detail failures remain visible after opening", async () => {
  const { view, feature } = setup(async () => ({}), {
    fetchGlossaries: async () => ({ items: [{ glossary_id: "a" }] }),
    fetchGlossary: async () => { throw new Error("无法读取术语库"); },
  });
  await feature.open();
  assert.equal(view.store.getSnapshot().status.tone, "error");
  assert.match(view.store.getSnapshot().status.message, /无法读取/);
});
