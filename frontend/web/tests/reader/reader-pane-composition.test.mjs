import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveReaderPaneComposition,
  resolveLiveTranslationVisibleOnWorkspaceChange,
} from "../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx";

// 可见台面的单一真源：paneComposition 判别联合。
// 矩阵输入沿用 (mode, sourceViewOnly, liveAvailable, liveVisible, assistantOpen, hasTranslated)。
// sourceViewOnly 由 sourceOnly/translatedUrl 派生，这里显式声明以便断言两者一致。
function compose({
  mode = "source",
  sourceViewOnly = false,
  liveAvailable = false,
  liveVisible = true,
  assistantOpen = false,
  hasTranslated = true,
}) {
  // sourceViewOnly 由 sourceOnly=无 job 或 translatedUrl 缺失达成：
  // hasTranslated 为假时用空 URL；为真时用 sourceOnly 表达「无 job」。
  const sourceOnly = sourceViewOnly && hasTranslated;
  const translatedUrl = hasTranslated ? "http://reader.local/translated.pdf" : "";
  return resolveReaderPaneComposition({
    mode,
    sourceOnly,
    translatedUrl,
    overlayContentAvailable: liveAvailable,
    liveTranslationVisible: liveVisible,
    assistantOpen,
  });
}

function paneVisibility(composition) {
  return {
    compareMode: composition.compareMode,
    showSource: composition.showSource,
    showTranslated: composition.showTranslated,
    overlayOnSource: composition.overlayOnSource,
    visibleMode: composition.visibleMode,
  };
}

test("pane composition matrix collapses to a single discriminated union", () => {
  const cases = [
    {
      name: "source-only: no translation, no live",
      input: { mode: "source", sourceViewOnly: true, hasTranslated: false },
      expected: {
        kind: "source-only",
        sourceViewOnly: true,
        panes: { compareMode: false, showSource: true, showTranslated: false, overlayOnSource: false, visibleMode: "source" },
      },
    },
    {
      name: "final-compare: mode compare with final translated artifact",
      input: { mode: "compare", sourceViewOnly: false, hasTranslated: true },
      expected: {
        kind: "final-compare",
        sourceViewOnly: false,
        panes: { compareMode: true, showSource: true, showTranslated: true, overlayOnSource: false, visibleMode: "compare" },
      },
    },
    {
      name: "translated-only: mode translated with artifact",
      input: { mode: "translated", sourceViewOnly: false, hasTranslated: true },
      expected: {
        kind: "translated-only",
        sourceViewOnly: false,
        panes: { compareMode: false, showSource: false, showTranslated: true, overlayOnSource: false, visibleMode: "translated" },
      },
    },
    {
      name: "live overlay wins when no final artifact (single source pane)",
      input: { mode: "source", sourceViewOnly: true, hasTranslated: false, liveAvailable: true, liveVisible: true },
      expected: {
        kind: "live-overlay",
        sourceViewOnly: true,
        panes: { compareMode: false, showSource: true, showTranslated: false, overlayOnSource: true, visibleMode: "source" },
      },
    },
    {
      name: "live overlay requires user intent (liveVisible false falls back)",
      input: { mode: "compare", sourceViewOnly: true, hasTranslated: false, liveAvailable: true, liveVisible: false },
      expected: {
        // 这条原来的期望是 `compareMode: true, showTranslated: true`，注释写着
        // 「保留既有行为：右栏无最终译文不挂载」—— 那句话自己描述的就是 bug：
        // 栅格按 compareMode 排两列，右栏却没东西挂，用户看到的是**半屏纯白**。
        // 而这是翻译期间点「对照」的默认路径。
        //
        // 现在 showTranslated 要看有没有最终译文；没有就退成单栏原文。
        kind: "final-compare",
        sourceViewOnly: true,
        panes: { compareMode: false, showSource: true, showTranslated: false, overlayOnSource: false, visibleMode: "compare" },
      },
    },
    {
      name: "assistant open suppresses live overlay and degrades compare to source",
      input: { mode: "compare", sourceViewOnly: false, hasTranslated: true, liveAvailable: true, liveVisible: true, assistantOpen: true },
      expected: {
        kind: "source-only",
        sourceViewOnly: false,
        panes: { compareMode: false, showSource: true, showTranslated: false, overlayOnSource: false, visibleMode: "source" },
      },
    },
    {
      name: "no job forces sourceViewOnly and source-only",
      input: { mode: "source", sourceViewOnly: true, hasTranslated: true },
      expected: {
        kind: "source-only",
        sourceViewOnly: true,
        panes: { compareMode: false, showSource: true, showTranslated: false, overlayOnSource: false, visibleMode: "source" },
      },
    },
  ];

  for (const testCase of cases) {
    const composition = compose(testCase.input);
    assert.equal(composition.kind, testCase.expected.kind, testCase.name);
    assert.equal(
      composition.sourceViewOnly,
      testCase.expected.sourceViewOnly,
      `${testCase.name} sourceViewOnly`,
    );
    assert.deepEqual(paneVisibility(composition), testCase.expected.panes, testCase.name);
  }
});

test("live overlay is a single source pane with the live translation on top", () => {
  const composition = compose({
    mode: "source",
    sourceViewOnly: true,
    hasTranslated: false,
    liveAvailable: true,
    liveVisible: true,
  });
  assert.equal(composition.kind, "live-overlay");
  assert.equal(composition.overlayOnSource, true);
  assert.equal(composition.compareMode, false);
  assert.equal(composition.showSource, true);
  assert.equal(composition.showTranslated, false);

  // Grid 消费方：source 栏在 overlayOnSource 时挂 liveTranslation + 叠加；
  // 不再有 pair / 双栏实时画布。
  const grid = readFileSync(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url),
    "utf8",
  );
  assert.match(grid, /liveTranslation=\{overlayOnSource \? liveTranslation : undefined\}/);
  assert.match(grid, /showLiveTranslation=\{overlayOnSource\}/);
  assert.doesNotMatch(grid, /liveTranslationPair/);
});

test("live overlay in compare keeps the right translated pane plus a source badge", () => {
  const composition = compose({
    mode: "compare",
    sourceViewOnly: false,
    hasTranslated: true,
    liveAvailable: true,
    liveVisible: true,
  });
  // 对照态叠加不再「消栏」：右栏保留，只在源栏叠加。
  assert.equal(composition.kind, "live-overlay");
  assert.equal(composition.overlayOnSource, true);
  assert.equal(composition.compareMode, true);
  assert.equal(composition.showSource, true);
  assert.equal(composition.showTranslated, true);
  assert.equal(composition.visibleMode, "compare");

  const grid = readFileSync(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url),
    "utf8",
  );
  assert.match(grid, /reader-source-overlay-badge/);
  assert.match(grid, /原文\+实时译文叠加/);
  assert.doesNotMatch(grid, /mountTranslated && !overlayOnSource/);
});

test("final-compare keeps source left and translated right without live overlay", () => {
  const composition = compose({
    mode: "compare",
    sourceViewOnly: false,
    hasTranslated: true,
  });
  assert.equal(composition.kind, "final-compare");
  assert.equal(composition.overlayOnSource, false);
  assert.deepEqual(paneVisibility(composition), {
    compareMode: true,
    showSource: true,
    showTranslated: true,
    overlayOnSource: false,
    visibleMode: "compare",
  });
});

test("源栏提供「译文」开关，直接叠在原文 PDF 上（不再另开窗口）", () => {
  // 2026-11-27 起叠层的状态和开关在 app/use-live-translation-overlay，App 把 sourcePaneAction 交给 Grid。
  const app = readFileSync(
    new URL("../../../../frontend/packages/reader/src/app/use-live-translation-overlay.tsx", import.meta.url),
    "utf8",
  );
  const root = readFileSync(
    new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url),
    "utf8",
  );
  // 开关按钮 + 内容可用判定 + 传给 Grid 的源栏动作
  assert.match(app, /className=\{`reader-live-translation-toggle/);
  assert.match(root, /sourcePaneAction=\{sourcePaneAction\}/);
  assert.match(app, /hasOverlayContent/);
  // 叠加仍叠在 source 栏，且由用户意图 liveTranslationVisible 控制
  assert.match(app, /overlayContentAvailable: hasOverlayContent/);

  const grid = readFileSync(
    new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url),
    "utf8",
  );
  assert.match(grid, /props\.sourcePaneAction/);
  assert.match(grid, /reader-source-overlay-badge/);
  assert.doesNotMatch(grid, /ReaderTranslatedPreview/);
});

test("任务到终态自动取消「实时译文」选中", () => {
  const app = readFileSync(
    new URL("../../../../frontend/packages/reader/src/app/use-live-translation-overlay.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /jobTerminal\)\s*setLiveTranslationVisible\(false\)/);
});

test("切换到对照不自动选中已完成的实时译文", () => {
  // 进行中（available）：切对照自动打开叠加
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("compare", true), true);
  // 已完成（available=false，残留已提交页）：保持不动，不自动选中
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("compare", false), null);
  // 离开对照：关闭
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("source", true), false);
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("source", false), false);
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("translated", true), false);
  assert.equal(resolveLiveTranslationVisibleOnWorkspaceChange("translated", false), false);

  // changeWorkspace 必须用 available（最终译文未就绪）而非残留内容做自动打开判定
  const app = readFileSync(
    new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /resolveLiveTranslationVisibleOnWorkspaceChange\(next, c\.liveTranslationAvailable\)/);
  assert.doesNotMatch(app, /next === "compare" && hasOverlayContent/);
});
