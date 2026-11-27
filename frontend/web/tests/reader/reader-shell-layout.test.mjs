/** 阅读页的三行壳层（2026-11-28）：顶栏、中间工作区、底栏是根节点竖排的三行，两条栏全宽、实占位，书页只在中间那一行里；
 * 中间工作区横排：左栏（钉住时）、书页区、右边停靠栏（Markdown 或贴右边的提问窗，11-28 起提问窗也画进这一栏），谁多宽由 flex 排。
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

test("页面结构：顶栏 → 中间工作区（左栏、书页区、右边停靠栏）→ 底栏；书页区里只有书页和它的加载、出错", () => {
  const app = read("src/ReaderAppReactPdf.tsx");
  const order = ["<ReaderWorkspaceTabs", '<div className="reader-workspace">', "<ReaderFinderArea", '<div className="reader-stage">', "<ReaderCompareGrid", "<ReaderReactBoot", "<aside", 'className="reader-dock"', 'className="reader-dock-body"', "<ReaderZoomHud"];
  let last = -1;
  for (const part of order) {
    const at = app.indexOf(part);
    assert.ok(at > last, `${part} 不在该在的位置`);
    last = at;
  }
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf('className="reader-dock"'));
  assert.doesNotMatch(stage, /<ReaderZoomHud|<ReaderBarTools/, "书页区里又放了底栏或工具");
  // 2026-11-28：提问窗贴右边也画进这一栏（和 Markdown 共用），停靠栏照它的宽度；不再另留空位。
  assert.match(app, /style=\{!assistantOpen && reserveRight \? \(\{ "--reader-dock-width": `\$\{reserveRight\}px` \} as CSSProperties\) : undefined\}/, "提问窗贴右边时停靠栏和它一样宽");
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

test("收口回黑白纸墨（2026-11-28）：左栏一进来收着、待改个数不用黄色；顶栏按钮一套平的 32px；底栏书签、收藏带轻字", () => {
  // 左栏：打开阅读页总是收着（上次钉住、开着也一样），点开关或 ⌘F 才展开。
  assert.match(read("src/app/use-reader-finder.ts"), /useState<ReaderFinderTab \| null>\(null\)/);
  for (const selector of [".reader-finder-toggle-count", ".reader-finder-tab-count"]) {
    assert.doesNotMatch(`${declaration(["finder.css"], selector, "background")} ${declaration(["finder.css"], selector, "color")}`, /--warn/, `${selector} 还是黄色`);
  }
  // 顶栏：返回、左栏开关、面板按钮、下载、提问都是 32px 高、同一种圆角、透明底；没有描边、阴影、毛玻璃。
  for (const selector of [".reader-close-home-btn", ".reader-panel-toggle", ".reader-download-trigger"]) {
    assert.equal(declaration(["chrome.css"], selector, "height"), "32px", `${selector} 高`);
    assert.equal(declaration(["chrome.css"], selector, "box-shadow"), null, `${selector} 还有阴影`);
    assert.equal(declaration(["chrome.css"], selector, "border"), "0");
  }
  assert.equal(declaration(["finder.css"], ".reader-finder-toggle", "height"), "32px");
  assert.equal(declaration(["toolball.css"], ".reader-bar-tool", "height"), "32px");
  const radius = declaration(["chrome.css"], ".reader-close-home-btn", "border-radius");
  assert.equal(declaration(["finder.css"], ".reader-finder-toggle", "border-radius"), radius);
  assert.equal(declaration(["toolball.css"], ".reader-bar-tool", "border-radius"), radius);
  assert.doesNotMatch(css("chrome.css"), /backdrop-filter|min-height:\s*36px/, "顶栏还留着浮动胶囊的毛玻璃、36px 高");
  assert.match(read("src/ReaderAppReactPdf.tsx"), /<span className="reader-workspace-title"/, "顶栏左段的书名");
  // 底栏：书签紧挨着「收藏」入口；图标都是 16px（bar-icon.ts），按钮 26px 高。
  const bookmark = read("src/components/react-pdf/ReaderBookmarkControl.tsx");
  assert.match(bookmark, /<BookmarkIcon filled=\{marked\} \/>\s*<\/button>\s*<ReaderFavoritesEntry \/>/);
  assert.match(bookmark, /aria-label="收藏"/);
  assert.equal(declaration(["hud.css"], ".reader-bottombar svg", "width"), "16px");
  assert.equal(declaration(["hud.css"], ".reader-bottombar .reader-react-hud-btn", "height"), "26px");
});

test("顶栏、底栏只用图标（2026-11-28）：一个尺寸一种线宽（bar-icon.ts）、名字在 aria-label 里；页签 原文 / 对照 / 译文 是图标；右边提问 / Markdown 胶囊 + 下载图标；对比版本在「对照」后面；底栏 书签、收藏、深色、缩放、画笔（笔色小点）、截图、帮助；目录不切书页左边", async () => {
  const { BAR_ICON } = await import("../../../packages/reader/src/components/react-pdf/bar-icon.ts");
  assert.deepEqual(BAR_ICON, { size: 16, strokeWidth: 1.75 });
  const files = {
    tabs: "src/components/react-pdf/ReaderWorkspaceTabs.tsx",
    home: "src/components/react-pdf/ReaderCloseHome.tsx",
    finder: "src/components/react-pdf/ReaderFinder.tsx",
    panels: "src/components/react-pdf/ReaderAssistantDock.tsx",
    tools: "src/components/react-pdf/ReaderBarTools.tsx",
    download: "src/components/react-pdf/ReaderDownloadActions.tsx",
    zoom: "src/components/react-pdf/ReaderZoomHud.tsx",
    bookmark: "src/components/react-pdf/ReaderBookmarkControl.tsx",
    help: "src/components/react-pdf/ReaderShortcutsHelp.tsx",
    ink: "src/extensions/builtin/ink.tsx",
  };
  for (const [name, file] of Object.entries(files)) {
    const text = read(file);
    assert.match(text, /\{\.\.\.BAR_ICON\}/, `${name} 用 BAR_ICON`);
    assert.doesNotMatch(text, /reader-bottombar-label|reader-bar-tool-label|reader-finder-toggle-label|reader-panel-toggle-label|reader-workspace-tab-label/, `${name} 不再画字`);
  }
  // 两条栏里的图标不再自己写尺寸、线宽（▾ 用 BAR_CARET；面板 tab 条、左栏卡片里的不算）。
  for (const name of ["tabs", "home", "tools", "download", "zoom", "bookmark", "help", "ink"]) {
    assert.doesNotMatch(read(files[name]), /size=\{1[0-9]\} strokeWidth=|<svg /, `${name} 还有自己写尺寸的图标`);
  }
  const tabs = read(files.tabs);
  assert.match(tabs, /\{ id: "source", label: "原文", Icon: FileText \}/);
  assert.match(tabs, /\{id === "compare" \? props\.compareExtra : null\}/, "对比版本紧跟在「对照」后面");
  assert.match(read("src/ReaderAppReactPdf.tsx"), /compareExtra=\{<ReaderBarTools place="compare" \/>\}/);
  assert.match(read("src/extensions/builtin/compare.tsx"), /place: "compare",/);
  // 换掉的图标：提问是对话气泡、Markdown 是带字的书（不再是 M↓ 方框）、截图是取景框、帮助是圈里的问号、深色是半黑的圆。
  assert.match(read("src/ask/ReaderAskExtension.tsx"), /Icon: MessageCircle,[\s\S]*Icon: Scan,/);
  assert.match(read("src/extensions/builtin/markdown.tsx"), /Icon: BookText,/);
  assert.match(read(files.help), /<CircleHelp \{\.\.\.BAR_ICON\} aria-hidden \/>/);
  assert.match(read(files.zoom), /<Contrast \{\.\.\.BAR_ICON\} aria-hidden \/>/);
  assert.match(read(files.ink), /<PenLine \{\.\.\.BAR_ICON\} \/>\s*<span className="reader-ink-dot"/, "画笔是钢笔图标加笔色小点");
  assert.match(declaration(["toolball.css"], ".reader-bar-tools.is-top", "border-radius"), /--reader-tab-radius/, "右边胶囊和页签胶囊一个圆角");
  assert.equal(declaration(["toolball.css"], ".reader-bar-tools.is-top", "background"), declaration(["chrome.css"], ".reader-workspace-tabs", "background"), "和页签胶囊一个底色");
  assert.doesNotMatch(read(files.download), /ChevronDown|reader-download-trigger-caret/, "下载只是一个图标");
  assert.doesNotMatch(css("toc-minimap.css"), /reader-react-scroll-shell/, "目录不再切书页左边");
});
