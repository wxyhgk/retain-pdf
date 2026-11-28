/** HTML 页（2026-11-28 用户：「纯 html 渲染整个 pdf……后续就能增加更多的功能，比如在文字里面增加动效，以及增加 3d 的场景」，
 * 选了「照原样摆」；「开始不用做的特别完美，我们不是有 ocr 的框以及 ocr 的结果吗」）：原文页上按 OCR 的框把字用 HTML 画上去。
 * 真机（VP ≠ VNP 那篇）量过的在 docs/ops/planning/reader-redesign/20261128-HTML页.md。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { htmlBlockContent, regionsByPage } from "../../../packages/reader/src/pdf/HtmlPageLayer.tsx";

const READER = new URL("../../../packages/reader/", import.meta.url);
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, READER)), "utf8");

const box = (page, text) => ({ page, bbox: [10, 10, 100, 40], unit: "pdf_point", origin: "top_left", text });
const region = (over) => ({
  itemId: "b1",
  source: box(2, "The full proofs are in the appendix."),
  translated: box(2, "完整证明见附录。"),
  markdown: "完整证明见 $\\mathrm{Lean}$ 附录。",
  regionType: "paragraph",
  status: "done",
  assetIds: [],
  assetUrls: [],
  ...over,
});

test("画什么：译文取译文的 Markdown（带公式），原文取 source.text（块里的 markdown 是译文）；跨页续段取这一截", () => {
  assert.deepEqual(htmlBlockContent(region(), "translated"), { kind: "paragraph", content: "完整证明见 $\\mathrm{Lean}$ 附录。" });
  assert.deepEqual(htmlBlockContent(region(), "source"), { kind: "paragraph", content: "The full proofs are in the appendix." });
  assert.equal(htmlBlockContent(region({ translatedBlockText: "这一截" }), "translated").content, "这一截");
});

test("行间公式画 LaTeX；图、表、空的块不画（留原页的像素）", () => {
  const formula = region({ regionType: "formula", markdown: "$$a^2+b^2=c^2$$", source: box(2, "$$a^2+b^2=c^2$$") });
  assert.deepEqual(htmlBlockContent(formula, "source"), { kind: "display_formula", content: "$$a^2+b^2=c^2$$" });
  assert.equal(htmlBlockContent(region({ regionType: "image", assetUrls: ["/a.png"] }), "translated"), null);
  assert.equal(htmlBlockContent(region({ regionType: "table", markdown: "<table><tr><td>1</td></tr></table>" }), "translated"), null);
  assert.equal(htmlBlockContent(region({ markdown: "", translated: box(2, ""), source: box(2, "") }), "translated"), null);
});

test("按页分好块（整本书只分一次）", () => {
  const map = regionsByPage([region({ itemId: "a" }), region({ itemId: "b", source: box(3, "x") }), region({ itemId: "c" })]);
  assert.deepEqual([...map.keys()], [2, 3]);
  assert.deepEqual(map.get(2).map((entry) => entry.itemId), ["a", "c"]);
});

test("作为内置扩展接上：右缘竖条一颗按钮，点开 关 / 画译文 / 画原文；只画在原文栏；开着时在看译文就切到原文", () => {
  assert.match(read("src/extensions/builtin.ts"), /readerHtmlPageExtension\]/);
  const ext = read("src/extensions/builtin/html-page.tsx");
  assert.match(ext, /label: "HTML 页"/);
  assert.match(ext, /\{ value: "translated", label: "画译文"/);
  assert.match(ext, /\{ value: "source", label: "画原文"/);
  assert.match(ext, /if \(!active \|\| pane !== "source"\) return null;/, "画到了别的栏");
  assert.match(ext, /if \(next && visibleMode === "translated"\) setWorkspace\("source"\);/);
  // 每块是一个带块 id 的 DOM 元素：以后的动效、3D 挂在这上面。
  const layer = read("src/pdf/HtmlPageLayer.tsx");
  assert.match(layer, /data-html-block=\{item\.itemId\}/);
  assert.match(layer, /data-html-kind=\{item\.kind\}/);
});

test("盖得实：HTML 页那一层自己定义纸色、墨色（实时译文的变量只在它那一层里），深色文档跟着换", () => {
  const css = read("styles/live-translation.css");
  const block = css.slice(css.indexOf(".reader-html-page {"), css.indexOf("}", css.indexOf(".reader-html-page {")));
  assert.match(block, /--reader-overlay-paper: #fff;/, "纸色没定义，盖不住原来的字");
  assert.match(css, /\.reader-html-page \.reader-live-translation-item \{\s*background: var\(--reader-overlay-paper\);/);
  assert.match(read("styles/doc-theme.css"), /:root\[data-reader-doc="dark"\] \.reader-html-page \{/);
});
