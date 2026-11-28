/** HTML 页照排版引擎的版面（layout.json，rpr_layout_v1）画（2026-11-28 用户：「为什么这里的 html 渲染和我们自己的 html 排版不一样？
 * 能不能一样？」）：一页一个 SVG，viewBox 是版面的 pt，盖原字的块、字簇按 x 和基线摆、公式塞进盒子。
 * 原型用本地 c8bcf5 那本的 layout.json 和译文 PDF 逐像素比过，见 docs/ops/planning/reader-redesign/20261128-HTML页照版面画-原型.md。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { layoutColor, normalizeRenderLayout } from "../../../packages/reader/src/shared/data/render-layout.ts";
import { LayoutPageLayer, parseMathSvg } from "../../../packages/reader/src/pdf/LayoutPageLayer.tsx";
import { renderLayoutFontFamily } from "../../../packages/reader/src/hooks/use-render-layout.ts";

const READER = new URL("../../../packages/reader/", import.meta.url);
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, READER)), "utf8");

// 照 c8bcf5 那本第 1 页的样子（数字取自真文件）。
const RAW = {
  schema: "rpr_layout_v1",
  pages: [{
    index: 0, width: 607.408, height: 800.901,
    covers: [{ block: "p001-b0014", rect: [46.809, 286.117, 325.743, 432.442], fill: [0.95686, 0.95686, 0.95686] }],
    blocks: [{
      id: "p001-b0014", fontSize: 9.98, weight: "regular", color: [0, 0, 0],
      lines: [{ text: "摘要：MHAT$^{1,2}$", x: 51.544, baseline: 294.827, width: 267.464, justified: true, items: [
        { x: 51.544, t: "摘" },
        { x: 61.822, t: "要" },
        { x: 72.1, t: "MHAT", mode: "dflt" },
        { x: 280.187, tex: "^{1,2}", display: false, w: 0.9865, h: 0.834, d: 0 },
        { x: 290, bogus: true },
      ] }],
    }, { id: "p001-b0001", fontSize: 0, weight: "bold", color: [0, 0, 0], lines: [] }],
  }, { index: -1, width: 1, height: 1, covers: [], blocks: [] }],
};

test("读版面：页码按阅读页的从 1 起；看不懂的项、字号为 0 的块、坏页丢掉；不是 rpr_layout_ 的不认", () => {
  const doc = normalizeRenderLayout(RAW);
  assert.equal(doc.schema, "rpr_layout_v1");
  assert.deepEqual([...doc.pages.keys()], [1]);
  const page = doc.pages.get(1);
  assert.equal(page.covers.length, 1);
  assert.deepEqual(page.blocks.map((block) => block.id), ["p001-b0014"]);
  assert.deepEqual(page.blocks[0].lines[0].items.map((item) => ("tex" in item ? `tex:${item.tex}` : item.mode ? `${item.t}/${item.mode}` : item.t)), ["摘", "要", "MHAT/dflt", "tex:^{1,2}"]);
  assert.equal(normalizeRenderLayout({ schema: "other", pages: [] }), null);
  assert.equal(normalizeRenderLayout(null), null);
});

test("颜色：引擎给的是 0–1，>1 的当 0–255", () => {
  assert.equal(layoutColor([0.95686, 0.95686, 0.95686]), "rgb(244, 244, 244)");
  assert.equal(layoutColor([0, 0, 0]), "rgb(0, 0, 0)");
  assert.equal(layoutColor([255, 128, 0]), "rgb(255, 128, 0)");
});

test("一页一个 SVG：viewBox 是版面的 pt，先画盖原字的块，字簇按 x 和基线摆，每块一个带块 id 的 <g>", () => {
  const page = normalizeRenderLayout(RAW).pages.get(1);
  const html = renderToStaticMarkup(createElement(LayoutPageLayer, { page, width: 776, height: 1023, fontFamily: '"RPR Source Han Serif SC", serif', arrivedAt: 0 }));
  assert.match(html, /<svg class="reader-layout-page" data-html-page="1" viewBox="0 0 607.408 800.901" width="776" height="1023" preserveAspectRatio="none"/);
  assert.match(html, /<rect x="46.809" y="286.117" width="278.93\d*" height="146.32\d*" fill="rgb\(244, 244, 244\)"/);
  assert.match(html, /<g class="reader-layout-block" data-html-block="p001-b0014" fill="rgb\(0, 0, 0\)" font-size="9.98" font-weight="400"/);
  assert.match(html, /<text x="51.544" y="294.827" lang="zh-Hans" style="--i:0">摘<\/text>/);
  assert.match(html, /<text x="72.1" y="294.827" lang="en" style="--i:2">MHAT<\/text>/);
  assert.ok(html.indexOf("<rect") < html.indexOf("<g"), "盖原字的块要先画");
});

test("公式：MathJax 的 SVG 拆成 viewBox 和里面那层，套进版面的盒子（宽 w、高 h + 深 d，按字号的 em；盒子底边在基线下 d）", () => {
  assert.deepEqual(parseMathSvg('<mjx-container class="MathJax"><svg style="vertical-align: 0" viewBox="0 -750 1200 950" width="2ex"><g fill="currentColor"><path d="M0 0"/></g></svg></mjx-container>'), {
    viewBox: "0 -750 1200 950",
    inner: '<g fill="currentColor"><path d="M0 0"/></g>',
  });
  assert.equal(parseMathSvg("<span>没有 svg</span>"), null);
  assert.equal(parseMathSvg(null), null);
  const layer = read("src/pdf/LayoutPageLayer.tsx");
  assert.match(layer, /y=\{line\.baseline - item\.h \* size\}/);
  assert.match(layer, /width=\{Math\.max\(0\.01, item\.w \* size\)\}/);
  assert.match(layer, /height=\{Math\.max\(0\.01, \(item\.h \+ item\.d\) \* size\)\}/);
  // 引擎按非行间公式画（maths.get(tex, false)），这里也一样。
  assert.match(layer, /renderTexToSvg\(tex, false\)/);
});

test("字体：清单里的字族按顺序当后备（和引擎的 FontChain 一样逐字找）；主字体没装全不照版面画", () => {
  assert.equal(renderLayoutFontFamily([
    { family: "RPR Source Han Serif SC", weight: 400, url: "a" },
    { family: "RPR Source Han Serif SC", weight: 700, url: "b" },
    { family: "RPR Libertinus Serif", weight: 400, url: "c" },
  ]), '"RPR Source Han Serif SC", "RPR Libertinus Serif", serif');
  const hook = read("src/hooks/use-render-layout.ts");
  assert.match(hook, /results\.every\(\(\{ font, ok \}\) => ok \|\| font\.family !== primary\)/, "主字体缺字重会被别的字重顶上");
  assert.match(hook, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/, "大字体读断不重试");
});

test("接到 HTML 页上：「画译文」有版面就照版面画，版面里没有的页是原页；没有版面退回按 OCR 的框塞字", () => {
  const ext = read("src/extensions/builtin/html-page.tsx");
  assert.match(ext, /if \(text === "translated" && layout\) \{\s*return \(\s*<LayoutPageHost/);
  assert.match(ext, /\/>\s*\);\s*\}\s*return \(\s*<HtmlPageLayer/);
  // 版面里没有的页什么都不画（看到的是原文页）。
  assert.match(read("src/pdf/LayoutPageLayer.tsx"), /if \(!has \|\| !layoutPage\) return null;/);
  // 后端接口出来之前只有开发时地址上带 ?render_layout= 才读。
  assert.match(read("src/hooks/use-render-layout.ts"), /\.get\("render_layout"\)/);
});

test("HTML 页上选字（2026-11-28 用户：「继续做下面的两个」）：版面层按版面拼——换行、换块、西文补空格、公式整个写成 $LaTeX$；三层都认", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<!doctype html><body><div data-reader-page="5" data-reader-pane="source">
    <svg class="reader-layout-page" viewBox="0 0 600 800">
      <g class="reader-layout-block" data-html-block="b1" font-size="10">
        <text x="50" y="100">寿</text><text x="60" y="100">命</text><text x="70" y="100">为</text>
        <svg class="reader-layout-math" x="80" width="40" data-tex="1.5 \\pm 0.3" data-baseline="100"></svg>
        <text x="125" y="100" lang="en">ps</text><text x="140" y="100">，</text>
        <text x="50" y="114">对</text><text x="60" y="114">应</text>
      </g>
      <g class="reader-layout-block" data-html-block="b2" font-size="10">
        <text x="50" y="140" lang="en">Co-H</text><text x="80" y="140" lang="en">MHAT</text>
      </g>
    </svg></div></body>`);
  const { layoutSelectionText } = await import("../../../packages/reader/src/pdf/page-selection.ts");
  const doc = dom.window.document;
  const svg = doc.querySelector(".reader-layout-page");
  const texts = svg.querySelectorAll("text");
  const range = doc.createRange();
  range.setStart(texts[0].firstChild, 0);
  range.setEnd(texts[texts.length - 1].firstChild, 4);
  assert.equal(layoutSelectionText(range, svg), "寿命为$1.5 \\pm 0.3$ps，\n对应\n\nCo-H MHAT");
  dom.window.close();
  const shared = read("src/pdf/page-selection.ts");
  assert.match(shared, /export const SELECTABLE_LAYER = "\.textLayer, \.reader-layout-page, \.reader-html-page";/);
  // 复制、浮条、提问取出处都走同一份。
  assert.match(read("src/components/react-pdf/ReaderSelectionLayer.tsx"), /const text = selectionCleanText\(selection\);/);
  assert.match(read("src/ask/anchor.ts"), /const text = selectionCleanText\(selection\)\.slice\(0, SELECTION_LIMIT\);/);
  // 照版面画的那页，底下被盖住的 pdf.js 文字层不让选。
  assert.match(read("styles/selection.css"), /\[data-reader-page\]:has\(> \.reader-layout-page\) \.textLayer \{[^}]*user-select: none;[^}]*pointer-events: none;/);
});

test("动效：逐字浮现（菜单开关，按 data-risen 不按 class——重画会把 class 写回去）；点公式分步展开（MathJax 顶层几项依次出来、闪浅蓝）", async () => {
  const layer = read("src/pdf/LayoutPageLayer.tsx");
  assert.match(layer, /entry\.target\.setAttribute\("data-risen", ""\)/);
  assert.doesNotMatch(layer, /classList\.add\("has-risen"\)/, "React 重画会把 class 写回去，浮过的块又藏起来");
  assert.match(layer, /style=\{\{ "--i": charIndex \} as CSSProperties\}/);
  assert.match(layer, /onClick=\{onMathClick\}/);
  const css = read("styles/live-translation.css");
  assert.match(css, /\.reader-layout-block\[data-risen\] :is\(text, \.reader-layout-math\) \{\s*animation: reader-layout-char-rise/);
  assert.match(css, /animation-delay: min\(calc\(var\(--i, 0\) \* 14ms\), 1600ms\);/);
  assert.match(read("src/extensions/builtin/html-page.tsx"), /逐字浮现/);
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(`<!doctype html><svg class="reader-layout-math"><g data-mml-node="math"><g data-mml-node="mrow"><g data-mml-node="mn"></g><g data-mml-node="mo"></g><g data-mml-node="mn"></g></g></g></svg>`);
  const { formulaTerms } = await import("../../../packages/reader/src/pdf/LayoutPageLayer.tsx");
  assert.deepEqual(formulaTerms(dom.window.document.querySelector("svg")).map((term) => term.getAttribute("data-mml-node")), ["mn", "mo", "mn"], "只有一个 mrow 时往下一层拆");
  dom.window.close();
});

test("正式接口（2026-11-28 后端 #241 / #242）：清单 → 版面来源；按页取、公式 SVG、字体都走带授权的 fetch；底图页码对上；字体名加 RPR 前缀", async () => {
  const { loadRenderLayoutFromApi, renderLayoutReason } = await import("../../../packages/reader/src/shared/data/render-layout.ts");
  const calls = [];
  const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(8) });
  const fetcher = async (url, init) => {
    calls.push([url, init?.method || "GET"]);
    if (url === "/api/v1/jobs/job%201/reader/layout") {
      return json({ code: 0, data: {
        available: true, reason: null, schema: "rpr_layout_v1",
        pages: [{ index: 0, width: 607, height: 800, etag: "w/1", url: "/api/v1/jobs/job%201/reader/layout/pages/0" }, { index: 4, width: 607, height: 800, etag: "w/2" }],
        background: { url: "/api/v1/jobs/job%201/reader/layout/background", pages: [0, 4] },
        fonts: [{ key: "serif-regular", family: "Source Han Serif SC", weight: 400, url: "/api/v1/jobs/job%201/reader/layout/fonts/serif-regular.woff2?v=1" }],
        generate: null,
      } });
    }
    if (url.endsWith("/pages/0")) return json({ code: 0, data: RAW.pages[0] });
    if (url.endsWith("/math/abc.svg")) return { ok: true, status: 200, text: async () => '<svg viewBox="0 0 1 1"><g/></svg>' };
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  const manifest = await loadRenderLayoutFromApi("job 1", { fetcher });
  assert.equal(manifest.available, true);
  const source = manifest.source;
  assert.deepEqual([...source.pages], [1, 5], "页码按阅读页的从 1 起");
  assert.deepEqual(source.fonts, [{ key: "serif-regular", family: "RPR Source Han Serif SC", weight: 400, url: "/api/v1/jobs/job%201/reader/layout/fonts/serif-regular.woff2?v=1" }]);
  assert.equal(source.background.pageFor(5), 2, "原文第 5 页是底图第 2 页");
  assert.equal(source.background.pageFor(2), null);
  const page = await source.loadPage(1);
  assert.equal(page.blocks[0].id, "p001-b0014");
  assert.equal(await source.loadPage(3), null, "版面里没有的页");
  assert.equal(await source.loadMath("math/abc.svg"), '<svg viewBox="0 0 1 1"><g/></svg>');
  await source.loadPage(1);
  assert.equal(calls.filter(([url]) => url.endsWith("/pages/0")).length, 1, "同一页只取一次");

  const missing = await loadRenderLayoutFromApi("j", { fetcher: async () => json({ available: false, reason: "something_new", generate: { method: "POST", url: "/api/v1/jobs/j/actions/retry-stage", body: { stage: "render" } } }) });
  assert.equal(missing.source, null);
  assert.equal(missing.reason, "not_kept", "认不得的原因当 not_kept");
  assert.deepEqual(missing.generate, { method: "POST", url: "/api/v1/jobs/j/actions/retry-stage", body: { stage: "render" } });
  assert.equal(renderLayoutReason("not_engine_route"), "not_engine_route");
});

test("版面接进 HTML 页：开了「画译文」才要清单；字体要带授权取字节再装，清单没有字体就不照版面画；没有版面时菜单说为什么、能补排给按钮；底图画在版面底下；字簇按 font 用对应字体、公式先用后端的 SVG", () => {
  const hook = read("src/hooks/use-render-layout.ts");
  assert.match(hook, /new FontFace\(font\.family, await load\(font\), \{ weight: `\$\{font\.weight\}` \}\)/, "FontFace 直接给地址不带授权头");
  assert.match(hook, /return Boolean\(primary\) && results\.every/, "清单没有字体也照版面画了");
  assert.match(hook, /reason: "no_fonts"/);
  assert.match(hook, /body: generate\.body == null \? undefined : JSON\.stringify\(generate\.body\)/, "补排没照原样发");
  const ext = read("src/extensions/builtin/html-page.tsx");
  assert.match(ext, /useRenderLayout\(api\.jobId, text === "translated"\)/);
  assert.match(ext, /生成 HTML 排版/);
  assert.match(ext, /<LayoutPageHost/);
  const layer = read("src/pdf/LayoutPageLayer.tsx");
  assert.match(layer, /<RegionCanvas pdf=\{backgroundPdf\} page=\{backgroundPage\} region=\{FULL_PAGE\}/);
  assert.ok(layer.indexOf("<RegionCanvas pdf={backgroundPdf}") < layer.indexOf("<LayoutPageLayer\n"), "底图要画在版面底下");
  assert.match(layer, /fontFamily=\{item\.font && fontByKey\?\.get\(item\.font\)/);
  assert.match(layer, /if \(!svg \|\| !loadMath\) return mathSvg\(tex\);/);
  assert.match(read("styles/live-translation.css"), /:root\[data-reader-doc="dark"\] \.reader-layout-page \{\s*filter: var\(--reader-doc-dark-filter\);/, "深色文档时版面没跟着反色");
});
