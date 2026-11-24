// 深色文档：本机存偏好、<html> 上挂属性；样式只给画布反色、叠层换深色纸墨；底栏开关 + 快捷键 D。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  READER_DOC_THEME_ATTR,
  READER_DOC_THEME_STORAGE_KEY,
  applyReaderDocTheme,
  loadReaderDocTheme,
  saveReaderDocTheme,
} from "../../../../frontend/packages/reader/src/shared/state/reader-doc-theme.ts";
import { matchReaderKeyBinding } from "../../../../frontend/packages/reader/src/hooks/reader-keyboard-map.ts";

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, `${v}`), map };
}

test("偏好：默认白底；存了 dark 读回 dark；存储坏了不炸", () => {
  const storage = memoryStorage();
  assert.equal(loadReaderDocTheme(storage), "light");
  saveReaderDocTheme("dark", storage);
  assert.equal(storage.map.get(READER_DOC_THEME_STORAGE_KEY), "dark");
  assert.equal(loadReaderDocTheme(storage), "dark");
  storage.map.set(READER_DOC_THEME_STORAGE_KEY, "weird");
  assert.equal(loadReaderDocTheme(storage), "light");
  const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(loadReaderDocTheme(broken), "light");
  assert.doesNotThrow(() => saveReaderDocTheme("dark", broken));
  assert.equal(loadReaderDocTheme(null), "light");
});

test("属性挂在 <html> 上，关掉时去掉", () => {
  const root = new JSDOM("<!doctype html><html></html>").window.document.documentElement;
  applyReaderDocTheme("dark", root);
  assert.equal(root.getAttribute(READER_DOC_THEME_ATTR), "dark");
  applyReaderDocTheme("light", root);
  assert.equal(root.hasAttribute(READER_DOC_THEME_ATTR), false);
});

test("样式：只反色画布（含换宽度时顶着的旧画布），占位和叠层换深色；进了阅读页样式入口", () => {
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/doc-theme.css", import.meta.url), "utf8");
  assert.match(css, /\[data-reader-doc="dark"\] \.react-pdf__Page__canvas/);
  assert.match(css, /\.reader-react-pdf-kept-paint canvas/);
  assert.match(css, /invert\(0\.9\) hue-rotate\(180deg\)/);
  assert.match(css, /\.reader-react-pdf-page-placeholder/);
  assert.match(css, /--reader-overlay-paper: var\(--reader-doc-dark-paper\)/);
  assert.doesNotMatch(css, /ink-layer|\.reader-ink/, "画笔不反色");
  // react-pdf 页外层内联白底：重画时画布先藏起来，新进视口的页没有旧画面顶着，深色下会闪白（缩放时实测）。
  assert.match(css, /\[data-reader-doc="dark"\] \.react-pdf__Page \{\s*background-color: var\(--reader-doc-dark-paper\) !important;/);
  const entry = readFileSync(new URL("../../../../frontend/packages/reader/styles/entry.css", import.meta.url), "utf8");
  assert.ok(entry.indexOf('"./doc-theme.css"') > entry.indexOf('"./live-translation.css"'), "要排在实时译文样式后面才盖得住");
  const built = readFileSync(new URL("../../dist/css/reader.css", import.meta.url), "utf8");
  assert.match(built, /data-reader-doc=(?:"dark"|dark)/, "构建产物里有深色文档样式");
});

test("快捷键 D、底栏开关都接上了", () => {
  assert.equal(matchReaderKeyBinding("d")?.action, "doc-dark");
  assert.equal(matchReaderKeyBinding("D")?.action, "doc-dark");
  const read = (p) => readFileSync(new URL(`../../../../frontend/packages/reader/src/${p}`, import.meta.url), "utf8");
  assert.match(read("components/react-pdf/ReaderZoomHud.tsx"), /aria-pressed=\{ctx\.docDark/);
  assert.match(read("ReaderAppReactPdf.tsx"), /useReaderDocTheme\(\)/);
  assert.match(read("hooks/use-reader-keyboard.ts"), /binding\.action === "doc-dark"/);
});
