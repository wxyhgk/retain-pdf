import test from "node:test";
import assert from "node:assert/strict";

import { mountGlossariesFeature } from "../../src/features/glossaries/domain/controller.js";

function createGlossariesFeature({
  createdId = "glossary-created",
  refreshCalls = [],
  view = {},
  viewPort,
} = {}) {
  const resolvedView = {
    readGlossaryEditorPayload: () => ({
      name: "Terms",
      entries: [
        {
          source: "DFT",
          target: "密度泛函理论",
          level: "canonical",
          match_mode: "case_insensitive",
        },
      ],
      skippedMissingTarget: [],
    }),
    renderGlossaryList: () => {},
    renderGlossaryEditor: () => {},
    setGlossaryStatus: () => {},
    ...view,
  };
  // controller.js 不再自带默认 viewPort(旧 DOM 直写实现已随 cutover 删除),
  // 测试用最小 stub 桥接 view 覆盖项,不依赖真实 DOM/glossary-view-port.js。
  const resolvedViewPort = viewPort || {
    addEntryRow: () => {},
    bindEvents: () => {},
    clearCsvText: () => "",
    closeDialog: () => {},
    openDialog: () => {},
    readCsvText: () => "",
    readEditorPayload: resolvedView.readGlossaryEditorPayload,
    renderEditor: resolvedView.renderGlossaryEditor,
    renderList: resolvedView.renderGlossaryList,
    setImportVisible: () => {},
    setStatus: resolvedView.setGlossaryStatus,
  };
  return mountGlossariesFeature({
    apiPrefix: "/api",
    fetchGlossaries: async () => ({
      items: [
        { glossary_id: createdId, name: "Terms", entry_count: 1 },
      ],
    }),
    fetchGlossary: async (glossaryId) => ({
      glossary_id: glossaryId,
      name: "Terms",
      entries: [],
    }),
    createGlossary: async () => ({
      glossary_id: createdId,
    }),
    updateGlossary: async () => ({
      glossary_id: createdId,
    }),
    deleteGlossary: async () => ({}),
    exportGlossaryCsv: async () => ({}),
    parseGlossaryCsv: async () => ({ entries: [] }),
    refreshWorkflowGlossaries: async (options) => {
      refreshCalls.push(options);
    },
    view: resolvedView,
    viewPort: resolvedViewPort,
  });
}

test("glossary save refreshes workflow glossary options through port", async () => {
  const refreshCalls = [];
  const previousDocument = globalThis.document;
  let directDeveloperSelectLookup = false;
  globalThis.document = {
    getElementById(id) {
      if (id === "developer-glossary-id") {
        directDeveloperSelectLookup = true;
      }
      return null;
    },
  };
  try {
    const feature = createGlossariesFeature({ refreshCalls });
    await feature.save();

    assert.deepEqual(refreshCalls, [
      { force: true, selectedId: "glossary-created" },
    ]);
    assert.equal(directDeveloperSelectLookup, false);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("glossary controller routes dialog operations through view port", async () => {
  const calls = [];
  const feature = createGlossariesFeature({
    refreshCalls: [],
    viewPort: {
      addEntryRow: () => calls.push("add-row"),
      bindEvents: (handlers) => {
        calls.push("bind");
        handlers.createNew();
      },
      openDialog: () => calls.push("open"),
      closeDialog: () => calls.push("close"),
      readEditorPayload: () => ({
        name: "Terms",
        entries: [],
        skippedMissingTarget: [],
      }),
      renderEditor: () => calls.push("render-editor"),
      renderList: () => calls.push("render-list"),
      setImportVisible: (visible) => calls.push(`import:${visible}`),
      setStatus: (message = "") => calls.push(`status:${message}`),
    },
  });

  feature.bindEvents();
  await feature.open();

  assert.equal(calls.includes("bind"), true);
  assert.equal(calls.includes("add-row"), true);
  assert.equal(calls.includes("open"), true);
  assert.equal(calls.includes("render-list"), true);
  assert.equal(calls.includes("render-editor"), true);
});
