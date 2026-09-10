import test from "node:test";
import assert from "node:assert/strict";
import { computeReaderPaneFlags } from "../../../../frontend/packages/reader/src/hooks/use-reader-pane-model.ts";

const bothAssets = {
  assetsReady: true,
  hasSource: true,
  hasTranslated: true,
};

test("computeReaderPaneFlags: sourceOnly only mounts source, no translated", () => {
  const flags = computeReaderPaneFlags({
    mode: "compare",
    sourceOnly: true,
    ...bothAssets,
  });
  assert.equal(flags.mountSource, true);
  assert.equal(flags.mountTranslated, false);
  assert.equal(flags.showTranslated, false);
  assert.equal(flags.compareMode, false);
  assert.equal(flags.primaryPane, "source");
});

test("computeReaderPaneFlags: compare with both assets enables compareMode", () => {
  const flags = computeReaderPaneFlags({
    mode: "compare",
    sourceOnly: false,
    ...bothAssets,
  });
  assert.equal(flags.mountSource, true);
  assert.equal(flags.mountTranslated, true);
  assert.equal(flags.showSource, true);
  assert.equal(flags.showTranslated, true);
  assert.equal(flags.compareMode, true);
  assert.equal(flags.primaryPane, "source");
});

test("computeReaderPaneFlags: translated mode primaryPane translated, showSource false", () => {
  const flags = computeReaderPaneFlags({
    mode: "translated",
    sourceOnly: false,
    ...bothAssets,
  });
  assert.equal(flags.primaryPane, "translated");
  assert.equal(flags.showSource, false);
  assert.equal(flags.showTranslated, true);
  assert.equal(flags.mountSource, true);
  assert.equal(flags.mountTranslated, true);
  assert.equal(flags.compareMode, false);
});

test("computeReaderPaneFlags: assets not ready → mount false", () => {
  const flags = computeReaderPaneFlags({
    mode: "compare",
    sourceOnly: false,
    assetsReady: false,
    hasSource: true,
    hasTranslated: true,
  });
  assert.equal(flags.mountSource, false);
  assert.equal(flags.mountTranslated, false);
  assert.equal(flags.compareMode, false);
  // visibility still follows mode (CSS / layout), only mount is gated
  assert.equal(flags.showSource, true);
  assert.equal(flags.showTranslated, true);
});

test("computeReaderPaneFlags: missing translated asset blocks compareMode", () => {
  const flags = computeReaderPaneFlags({
    mode: "compare",
    sourceOnly: false,
    assetsReady: true,
    hasSource: true,
    hasTranslated: false,
  });
  assert.equal(flags.mountSource, true);
  assert.equal(flags.mountTranslated, false);
  assert.equal(flags.compareMode, false);
});

test("computeReaderPaneFlags: source mode shows only source", () => {
  const flags = computeReaderPaneFlags({
    mode: "source",
    sourceOnly: false,
    ...bothAssets,
  });
  assert.equal(flags.showSource, true);
  assert.equal(flags.showTranslated, false);
  assert.equal(flags.primaryPane, "source");
  assert.equal(flags.compareMode, false);
});
