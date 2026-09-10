import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeReaderAiSplitLayout } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderAiSplitResizeHandle.tsx";

test("AI split layout defaults to 50:50 and clamps both panes", () => {
  assert.deepEqual(normalizeReaderAiSplitLayout(null), {
    "reader-document": 50,
    "reader-assistant": 50,
  });
  assert.deepEqual(normalizeReaderAiSplitLayout({ "reader-assistant": 10 }), {
    "reader-document": 70,
    "reader-assistant": 30,
  });
  assert.deepEqual(normalizeReaderAiSplitLayout({ "reader-assistant": 90 }), {
    "reader-document": 35,
    "reader-assistant": 65,
  });
});

test("assistant dock uses the library-owned resizable split", async () => {
  const [component, app, css, dockCss, manifest] = await Promise.all([
    readFile(new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderAiSplitResizeHandle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/styles/assistant-dock.css", import.meta.url), "utf8"),
    readFile(new URL("../../../../frontend/packages/reader/package.json", import.meta.url), "utf8"),
  ]);

  assert.match(component, /from "react-resizable-panels"/);
  assert.match(component, /<Group[\s\S]*?<Panel[\s\S]*?<Separator[\s\S]*?<Panel/);
  assert.match(component, /onLayoutChanged=\{handleLayoutChanged\}/);
  assert.match(component, /meta\.isUserInteraction/);
  assert.doesNotMatch(component, /onPointerMove|setPointerCapture|pointermove/);
  assert.match(app, /assistantOpen \? <ReaderAiSplitResizeHandle \/>/);
  assert.match(app, /is-workspace-\$\{workspaceView\}/);
  assert.match(css, /\.reader-ai-split-separator/);
  assert.match(dockCss, /\.reader-react-root\.is-assistant-open \.reader-react-scroll-shell[\s\S]*?right:\s*var\(--reader-ai-split-width\)/);
  assert.match(css, /\.reader-ai-split-separator[\s\S]*?cursor:\s*col-resize/);
  assert.match(css, /\.reader-ai-split-resizer \[data-panel\][\s\S]*?pointer-events:\s*none/);
  assert.equal(JSON.parse(manifest).dependencies["react-resizable-panels"], "4.12.1");
});
