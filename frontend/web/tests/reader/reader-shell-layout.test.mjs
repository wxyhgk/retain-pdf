/** 阅读页的三行壳层（2026-11-28）：顶栏、中间工作区、底栏是根节点竖排的三行，两条栏全宽、实占位，书页只在中间那一行里；
 * 中间工作区横排：左栏（钉住时）、书页区、右边停靠栏或给贴右边的提问窗留的空位，谁多宽由 flex 排。
 *
 * 以前是全屏堆叠：顶栏 fixed 盖在书页上，底栏、小球浮在书页底部，书页区用 --reader-stage-left / --reader-stage-right 算让谁，
 * 两条提示按视口宽减面板宽去居中（那时这份测试叫 reader-dock-centering，专门算这些偏移对不对）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const READER = new URL("../../../packages/reader/", import.meta.url);
const read = (path) => readFileSync(new URL(path, READER), "utf8");
const css = (name) => read(`styles/${name}`).replace(/\/\*[\s\S]*?\*\//g, "");

/** 顶层规则里某个选择器的某条声明（后写的赢）。 */
function declaration(files, selector, property) {
  let found = null;
  for (const file of files) {
    const text = css(file);
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "{") {
        if (depth === 0) {
          const prelude = text.slice(start, index).trim();
          const end = text.indexOf("}", index);
          if (!prelude.startsWith("@") && prelude.split(",").map((part) => part.trim()).includes(selector)) {
            const body = text.slice(index + 1, end);
            const hits = [...body.matchAll(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+);`, "g"))];
            if (hits.length) found = hits.at(-1)[1].trim();
          }
        }
        depth += 1;
      } else if (text[index] === "}") {
        depth -= 1;
        if (depth === 0) start = index + 1;
      }
    }
  }
  return found;
}

test("根节点竖排三行：两条栏的高在 CSS 和 JS 里是同一个数（提问窗贴右边时上下让出它们）", async () => {
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "display"), "flex");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "flex-direction"), "column");
  const top = declaration(["react-pdf.css"], ".reader-react-root", "--reader-topbar-h");
  const bottom = declaration(["react-pdf.css"], ".reader-react-root", "--reader-bottombar-h");
  const metrics = await import("../../../packages/reader/src/app/shell-metrics.ts");
  assert.equal(top, `${metrics.READER_TOPBAR_HEIGHT}px`);
  assert.equal(bottom, `${metrics.READER_BOTTOMBAR_HEIGHT}px`);
  assert.deepEqual(metrics.READER_DOCK_INSETS, { top: metrics.READER_TOPBAR_HEIGHT, bottom: metrics.READER_BOTTOMBAR_HEIGHT });
  assert.match(read("src/ask/ReaderAskPanel.tsx"), /dockInsets=\{READER_DOCK_INSETS\}/, "提问窗贴右边没让出两条栏");
});

test("两条栏实占位：不 fixed、不 absolute，高度用变量；中间工作区 flex: 1 撑满、自己裁掉溢出", () => {
  for (const [file, selector, height] of [["chrome.css", ".reader-workspace-bar", "var(--reader-topbar-h, 54px)"], ["hud.css", ".reader-bottombar", "var(--reader-bottombar-h, 36px)"]]) {
    assert.equal(declaration([file], selector, "position"), "relative", `${selector} 又浮起来了`);
    assert.equal(declaration([file], selector, "flex"), "none");
    assert.equal(declaration([file], selector, "height"), height);
  }
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "min-height"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "overflow"), "hidden");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "min-width"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-scroll-shell", "inset"), "0");
});

test("不再拿偏移算谁让谁：样式里没有 --reader-stage-*、--reader-right-inset、托盘留位、底栏留空", () => {
  const dir = fileURLToPath(new URL("styles/", READER));
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".css"))) {
    const text = css(name);
    assert.doesNotMatch(text, /--reader-stage-(?:left|right)|--reader-right-inset|--reader-tray-width|--reader-hud-room/, `${name} 还在算偏移`);
  }
});

test("页面结构：顶栏 → 中间工作区（左栏、书页区、右边停靠栏 / 空位）→ 底栏；书页区里只有书页和它的加载、出错", () => {
  const app = read("src/ReaderAppReactPdf.tsx");
  const order = ["<ReaderWorkspaceTabs", '<div className="reader-workspace">', "<ReaderFinderArea", '<div className="reader-stage">', "<ReaderCompareGrid", "<ReaderReactBoot", '<aside className="reader-dock"', 'className="reader-dock-spacer"', "<ReaderZoomHud"];
  let last = -1;
  for (const part of order) {
    const at = app.indexOf(part);
    assert.ok(at > last, `${part} 不在该在的位置`);
    last = at;
  }
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf('<aside className="reader-dock"'));
  assert.doesNotMatch(stage, /<ReaderZoomHud|<ReaderBarTools/, "书页区里又放了底栏或工具");
  assert.match(app, /<div className="reader-dock-spacer" style=\{\{ width: reserveRight \}\}/, "给贴右边的提问窗留的空位要和它一样宽");
  assert.match(app, /<div className="reader-dock-body" ref=\{setPanelHost\} \/>/, "面板画进停靠栏（api.panelHost）");
  assert.equal(declaration(["assistant-dock.css"], ".reader-dock", "width"), "var(--reader-ai-split-width)");
});

test("书页区里的两条提示：按书页区居中（left: 50% + translateX(-50%)），宽度不超过书页区", () => {
  for (const selector of [".reader-react-error", ".reader-error-notice"]) {
    assert.equal(declaration(["react-pdf.css"], selector, "position"), "absolute");
    assert.equal(declaration(["react-pdf.css"], selector, "left"), "50%");
    assert.match(declaration(["react-pdf.css"], selector, "transform"), /translateX\(-50%\)/);
    assert.match(declaration(["react-pdf.css"], selector, "max-width"), /calc\(100% - 32px\)/);
  }
});
