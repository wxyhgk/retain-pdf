import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readerDockTabs } from "../../../../frontend/packages/reader/src/components/react-pdf/reader-dock-tabs.ts";
import {
  loadReaderViewState,
  normalizeReaderViewState,
  readerViewStateScope,
  saveReaderViewState,
} from "../../../../frontend/packages/reader/src/shared/state/reader-view-state.ts";

function readerSource(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("reader view state persists reading mode alongside anchor/zoom", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const scope = readerViewStateScope({ documentId: "doc-mode" });
  saveReaderViewState(scope, {
    anchor: { page: 4, fraction: 0.2 },
    zoom: 0.7,
    mode: "translated",
  }, storage);
  assert.deepEqual(loadReaderViewState(scope, storage), {
    schema: "retainpdf_reader_view_v1",
    anchor: { page: 4, fraction: 0.2 },
    zoom: 0.7,
    mode: "translated",
    updatedAt: loadReaderViewState(scope, storage).updatedAt,
  });

  saveReaderViewState(scope, { mode: "compare" }, storage);
  const reloaded = loadReaderViewState(scope, storage);
  assert.equal(reloaded.mode, "compare");
  assert.deepEqual(reloaded.anchor, { page: 4, fraction: 0.2 });
});

test("reader view state rejects unknown modes and keeps legacy payloads clean", () => {
  assert.deepEqual(normalizeReaderViewState({
    schema: "retainpdf_reader_view_v1",
    mode: "side-by-side",
    updatedAt: 5,
  }), {
    schema: "retainpdf_reader_view_v1",
    updatedAt: 5,
  });
  assert.equal(normalizeReaderViewState({
    schema: "retainpdf_reader_view_v1",
    mode: "source",
    updatedAt: 0,
  }).mode, "source");
  assert.equal(normalizeReaderViewState({
    schema: "retainpdf_reader_view_v1",
    updatedAt: 0,
  }).mode, undefined);
});

test("原来 FAB 菜单里的东西一个都没丢", () => {
  // READER_TOOLS 这张表连同 FAB 一起删了；能证明「没丢」的是它们现在都在
  // 唯一那个启动器的清单里，而不是某个文件里还留着字符串。
  //
  // 当年那份菜单里有 Markdown 和 AI 问答两样。AI 问答面板后来整个删了（阅读页
  // 只留一扇 AI 的门，就是终端里的 agent），所以这里只能要求 Markdown ——
  // 把已经删掉的功能写进「没丢」的清单，守的是一个不存在的东西。
  const ids = readerDockTabs(() => true).map((tab) => tab.id);
  assert.ok(ids.includes("markdown"), `markdown 不在启动器清单里: ${ids}`);
});

test("ReaderAppReactPdf restores and persists reading mode with a sourceViewOnly guard", () => {
  const app = readerSource(
    "../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx",
  );
  assert.match(app, /modeScopeRef/);
  // 「存档优先 + sourceViewOnly 只许原文 + 窄屏默认译文」收进了 resolveReaderInitialMode，
  // 行为本身见 reader-narrow-viewport.test.mjs；这里只守 App 确实经它恢复。
  assert.match(app, /resolveReaderInitialMode\(\{\s*savedMode: saved\?\.mode,\s*sourceViewOnly,/);
  const initialMode = readerSource(
    "../../../../frontend/packages/reader/src/hooks/reader-initial-mode.ts",
  );
  assert.match(initialMode, /if \(input\.sourceViewOnly\) return \{ mode: "source"/);
  assert.match(app, /saveReaderViewState\(c\.viewStateKey, \{ mode: c\.mode \}\)/);
});

test("compare column width and reversed panes dead links are removed", () => {
  const shell = readerSource(
    "../../../../frontend/packages/reader/src/hooks/use-reader-shell.ts",
  );
  const grid = readerSource(
    "../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx",
  );
  const controller = readerSource(
    "../../../../frontend/packages/reader/src/hooks/use-reader-react-controller.ts",
  );
  const app = readerSource(
    "../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx",
  );
  assert.doesNotMatch(shell, /compareColWidth|onWidthChange|comparePaneWidth/);
  assert.doesNotMatch(grid, /compareColWidth|reversePanes|is-reversed/);
  assert.doesNotMatch(controller, /compareColWidth/);
  assert.doesNotMatch(app, /compareColWidth|reversePanes/);
});
