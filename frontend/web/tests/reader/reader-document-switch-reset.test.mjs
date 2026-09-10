import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

import { useReaderPaneModel } from "../../../../frontend/packages/reader/src/hooks/use-reader-pane-model.ts";
import { useReaderReactController } from "../../../../frontend/packages/reader/src/hooks/use-reader-react-controller.ts";
import { useReadingAnchor } from "../../../../frontend/packages/reader/src/pdf/useReadingAnchor.ts";
import { setReaderAdapters } from "../../../../frontend/packages/reader/src/adapters.ts";
import { readerViewStateStorageKey } from "../../../../frontend/packages/reader/src/shared/state/reader-view-state.ts";

function installDom(url = "http://localhost/reader.html") {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url,
    pretendToBeVisual: true,
  });
  const keys = [
    "window",
    "document",
    "history",
    "location",
    "localStorage",
    "HTMLElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "MutationObserver",
    "getSelection",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "addEventListener",
    "removeEventListener",
    "dispatchEvent",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  for (const key of keys) {
    const value = key === "getSelection"
      ? dom.window.getSelection.bind(dom.window)
      : [
          "requestAnimationFrame",
          "cancelAnimationFrame",
          "addEventListener",
          "removeEventListener",
          "dispatchEvent",
        ].includes(key)
        ? dom.window[key].bind(dom.window)
        : dom.window[key];
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return {
    dom,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
      }
      delete globalThis.IS_REACT_ACT_ENVIRONMENT;
      dom.window.close();
    },
  };
}

test("same mounted pane model drops document A page counts and stale callbacks when switching to B", async () => {
  const env = installDom();
  const root = createRoot(document.getElementById("root"));
  let latest = null;

  function Harness({ identity }) {
    latest = useReaderPaneModel({
      mode: "source",
      sourceOnly: false,
      assetsReady: true,
      sourceUrl: `/${identity}.pdf`,
      translatedUrl: "",
      sourceFile: null,
      translatedFile: null,
    }, { identityKey: identity, userZoom: 1, shellWidth: 800 });
    return null;
  }

  try {
    await act(async () => root.render(createElement(Harness, { identity: "document-a" })));
    await act(async () => latest.onNumPages(12, "source"));
    assert.equal(latest.numPagesByPane.source, 12);
    assert.equal(latest.hudNumPages, 12);
    const stalePageCallback = latest.onNumPages;
    const staleMetricsCallback = latest.onMetrics;

    await act(async () => {
      staleMetricsCallback();
      root.render(createElement(Harness, { identity: "document-b" }));
    });
    assert.deepEqual(latest.numPagesByPane, { source: 0, translated: 0 });
    assert.equal(latest.hudNumPages, 0);
    assert.equal(latest.metricsTick, 0);

    await act(async () => {
      stalePageCallback(99, "source");
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    assert.equal(latest.numPagesByPane.source, 0, "document A callback must not repopulate B");
    assert.equal(latest.metricsTick, 0, "document A metrics timer must not advance B");

    await act(async () => latest.onNumPages(3, "source"));
    assert.equal(latest.numPagesByPane.source, 3);
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test("same mounted reading anchor sends a new document without saved state to page one", async () => {
  const env = installDom();
  const container = document.getElementById("root");
  const shell = document.createElement("div");
  container.appendChild(shell);
  shell.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 600,
    bottom: 500,
    width: 600,
    height: 500,
    toJSON() {},
  });
  for (let page = 1; page <= 2; page += 1) {
    const pageNode = document.createElement("div");
    pageNode.setAttribute("data-reader-page", `${page}`);
    pageNode.setAttribute("data-reader-pane", "source");
    pageNode.getBoundingClientRect = () => {
      const top = (page - 1) * 800 - shell.scrollTop;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        right: 600,
        bottom: top + 800,
        width: 600,
        height: 800,
        toJSON() {},
      };
    };
    shell.appendChild(pageNode);
  }

  const shellRef = { current: shell };
  const mount = document.createElement("div");
  container.appendChild(mount);
  const root = createRoot(mount);
  let latest = null;

  function Harness({ identity }) {
    latest = useReadingAnchor(shellRef, {
      primaryPane: "source",
      mode: "source",
      enabled: true,
      persistenceKey: identity,
      restoreReady: true,
    });
    return null;
  }

  const waitFor = async (predicate, description) => {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    assert.fail(`等待超时：${description}`);
  };

  try {
    await act(async () => root.render(createElement(Harness, { identity: "document:a" })));
    await waitFor(() => latest && !latest.isRestoring(), "document A anchor restore");
    shell.scrollTop = 900;
    await act(async () => {
      shell.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => {
      const stored = localStorage.getItem(readerViewStateStorageKey("document:a"));
      return stored && JSON.parse(stored).anchor.page === 2;
    }, "document A anchor persistence");
    const storedA = JSON.parse(localStorage.getItem(readerViewStateStorageKey("document:a")));
    assert.equal(storedA.anchor.page, 2);

    await act(async () => root.render(createElement(Harness, { identity: "document:b" })));
    await waitFor(() => shell.scrollTop === 0, "document B page-one reset");
    assert.equal(
      shell.scrollTop,
      0,
      "document B has no saved anchor and must not inherit document A's scrollTop",
    );
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test("same mounted Reader clears document A selection and highlight when its identity changes to B", async () => {
  const env = installDom("http://localhost/reader.html?job_id=job-a");
  const root = createRoot(document.getElementById("root"));
  let currentJobId = "job-a";
  let latest = null;
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

  const regionFor = (jobId) => ({
    item_id: `${jobId}-formula`,
    source: {
      page: 1,
      bbox: [10, 20, 90, 60],
      unit: "pdf_point",
      origin: "top_left",
      text: "$$x^2$$",
    },
    translated: {
      page: 1,
      bbox: [10, 20, 90, 60],
      unit: "pdf_point",
      origin: "top_left",
      text: "",
    },
    region_type: "display_formula",
  });

  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => currentJobId,
    resolveReaderDocumentId: () => "",
    resolveReaderSourcePdf: (manifest) => manifest.source_url,
    resolveReaderTranslatedPdfUrl: () => "",
    resolveReaderArtifactUrl: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    defaultReaderDataPort: {
      fetchProtected: async () => ({
        ok: true,
        arrayBuffer: async () => pdfBytes.buffer.slice(0),
      }),
      loadReaderPayload: async (jobId) => ({
        jobPayload: { job_id: jobId, status: "succeeded", workflow: "ocr" },
        manifestPayload: { source_url: `/${jobId}.pdf` },
        regionsPayload: { items: [regionFor(jobId)] },
        readerMetadata: {
          source: { pages: [{ page: 1, width: 100, height: 200 }] },
          translated: null,
        },
      }),
    },
  });

  function Harness() {
    latest = useReaderReactController();
    return null;
  }

  const waitFor = async (predicate, description) => {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    assert.fail(`等待超时：${description}`);
  };

  try {
    await act(async () => root.render(createElement(Harness)));
    await waitFor(
      () => latest?.session.assetsReady && latest.session.jobId === "job-a",
      "document A ready",
    );
    const region = latest.session.regions[0];
    await act(async () => {
      latest.jumpToAnchor({ block_id: region.itemId });
      latest.selectRegion({
        selectionType: "region",
        region,
        pane: "source",
        kind: "formula",
        page: 1,
        rect: { left: 10, top: 20, width: 80, height: 40 },
      });
    });
    assert.equal(latest.activeRegion?.itemId, "job-a-formula");
    assert.equal(latest.selection?.selectionType, "region");

    currentJobId = "job-b";
    await act(async () => {
      history.pushState({}, "", "/reader.html?job_id=job-b");
    });
    await waitFor(
      () => latest?.session.assetsReady && latest.session.jobId === "job-b",
      "document B ready",
    );
    assert.equal(latest.activeRegion, null);
    assert.equal(latest.selection, null);
    assert.deepEqual(latest.panes.numPagesByPane, { source: 0, translated: 0 });
  } finally {
    await act(async () => root.unmount());
    setReaderAdapters(null);
    env.restore();
  }
});
