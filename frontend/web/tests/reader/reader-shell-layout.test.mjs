/** 阅读页的壳层（2026-11-28）：中间工作区、底栏是根节点竖排的两行，底栏全宽、实占位，书页只在中间那一行里；
 * 顶栏上午也是实占的一行，下午起（用户：「顶部的 bar 不要保留了，用悬浮的方式」）浮在书页区顶上：左上一颗返回（不画书名）、正上方页签；
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

test("根节点竖排：中间工作区、底栏；底栏的高在 CSS 和 JS 里是同一个数（提问窗贴右边时让出底栏，上面不用让）", async () => {
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "display"), "flex");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "flex-direction"), "column");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "--reader-topbar-h"), null, "顶栏又占一行了");
  const bottom = declaration(["react-pdf.css"], ".reader-react-root", "--reader-bottombar-h");
  const metrics = await import("../../../packages/reader/src/app/shell-metrics.ts");
  assert.equal(metrics.READER_TOPBAR_HEIGHT, undefined);
  assert.equal(bottom, `${metrics.READER_BOTTOMBAR_HEIGHT}px`);
  assert.deepEqual(metrics.READER_DOCK_INSETS, { top: 0, bottom: metrics.READER_BOTTOMBAR_HEIGHT });
  assert.match(read("src/ask/ReaderAskPanel.tsx"), /dockInsets=\{READER_DOCK_INSETS\}/, "提问窗贴右边没让出底栏");
});

test("底栏实占位：不 fixed、不 absolute，高度用变量；中间工作区 flex: 1 撑满、自己裁掉溢出", () => {
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "position"), "relative", "底栏又浮起来了");
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "flex"), "none");
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "height"), "var(--reader-bottombar-h, 36px)");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "min-height"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "overflow"), "hidden");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "min-width"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-scroll-shell", "inset"), "0");
});

test("顶栏浮在书页区顶上（2026-11-28 下午）：这一层透明、不接点击，只有左上胶囊和页签接；书页第一页、源栏右上角的开关让出它", () => {
  assert.equal(declaration(["chrome.css"], ".reader-workspace-bar", "position"), "absolute");
  assert.equal(declaration(["chrome.css"], ".reader-workspace-bar", "pointer-events"), "none", "透明的那一层挡住了书页");
  assert.equal(declaration(["chrome.css"], ".reader-workspace-start", "pointer-events"), "auto");
  assert.equal(declaration(["chrome.css"], ".reader-workspace-center", "pointer-events"), "auto");
  // 窄屏停靠栏铺满中间工作区（z 30）时盖住浮着的顶栏，不是反过来压在 Markdown 的页签上。
  const narrowDock = css("assistant-dock.css").match(/@media \(max-width: 899px\)[\s\S]*?\.reader-dock[^{]*\{[^}]*z-index:\s*(\d+)/);
  assert.ok(narrowDock, "窄屏停靠栏的 z-index 没找到");
  assert.ok(Number(declaration(["chrome.css"], ".reader-workspace-bar", "z-index")) < Number(narrowDock[1]), "浮着的顶栏压在窄屏停靠栏上");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "--reader-float-bar-room"), "56px");
  assert.match(declaration(["react-pdf.css"], ".reader-react-pdf-wrap", "padding"), /^var\(--reader-float-bar-room, 56px\) /, "第一页顶上没让出浮着的顶栏");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-pdf-pane-action", "top"), "var(--reader-float-bar-room, 56px)", "源栏右上角的开关压在页签底下");
  // 翻到某一页时页顶停在阅读线，和第一页一样让出浮着的顶栏（同一个数）。
  assert.match(read("src/pdf/scroll-to-page.ts"), /READER_SCROLL_FOCUS_PX = 56;/);
});

test("不再拿偏移算谁让谁：样式里没有 --reader-stage-*、--reader-right-inset、托盘留位、底栏留空", () => {
  const dir = fileURLToPath(new URL("styles/", READER));
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".css"))) {
    const text = css(name);
    assert.doesNotMatch(text, /--reader-stage-(?:left|right)|--reader-right-inset|--reader-tray-width|--reader-hud-room/, `${name} 还在算偏移`);
  }
});

test("页面结构：中间工作区（左栏、书页区、右边停靠栏）→ 底栏；浮着的顶栏在书页区里；书页区里只有顶栏、目录、竖条、书页和它的加载、出错", () => {
  const app = read("src/ReaderAppReactPdf.tsx");
  const order = ['<div className="reader-workspace">', "<ReaderFinderArea", '<div className="reader-stage">', "<ReaderWorkspaceTabs", "<ReaderCompareGrid", "<ReaderReactBoot", "<aside", 'className="reader-dock"', 'className="reader-dock-body"', "<ReaderZoomHud"];
  let last = -1;
  for (const part of order) {
    const at = app.indexOf(part);
    assert.ok(at > last, `${part} 不在该在的位置`);
    last = at;
  }
  // 「对照」后面的 ▾（ReaderBarTools place="compare"）跟着页签在书页区里，别的工具不放进来。
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf('className="reader-dock"')).replace('<ReaderBarTools place="compare" />', "");
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
  // 左栏开关（搜索）2026-11-28 挪到底栏左边：高照底栏 26px，圆角照顶栏按钮。
  assert.equal(declaration(["hud.css"], ".reader-bottombar .reader-finder-toggle", "height"), "26px");
  assert.equal(declaration(["toolball.css"], ".reader-bar-tool", "height"), "32px");
  const radius = declaration(["chrome.css"], ".reader-close-home-btn", "border-radius");
  assert.equal(declaration(["finder.css"], ".reader-finder-toggle", "border-radius"), radius);
  assert.equal(declaration(["toolball.css"], ".reader-bar-tool", "border-radius"), radius);
  assert.doesNotMatch(css("chrome.css"), /backdrop-filter|min-height:\s*36px/, "顶栏还留着浮动胶囊的毛玻璃、36px 高");
  // 底栏：书签紧挨着「收藏」入口；图标都是 16px（bar-icon.ts），按钮 26px 高。
  const bookmark = read("src/components/react-pdf/ReaderBookmarkControl.tsx");
  assert.match(bookmark, /<BookmarkIcon filled=\{marked\} \/>\s*<\/button>\s*<ReaderFavoritesEntry \/>/);
  assert.match(bookmark, /aria-label="收藏"/);
  assert.equal(declaration(["hud.css"], ".reader-bottombar svg", "width"), "16px");
  assert.equal(declaration(["hud.css"], ".reader-bottombar .reader-react-hud-btn", "height"), "26px");
});

test("顶栏、底栏只用图标（2026-11-28）：一个尺寸一种线宽（bar-icon.ts）、名字在 aria-label 里；页签 原文 / 对照 / 译文 是图标；提问 / Markdown / 下载在右缘竖条；对比版本在「对照」后面；底栏 搜索、书签、收藏、深色、缩放、画笔（笔色小点）、截图、帮助；目录不切书页左边", async () => {
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
  assert.match(declaration(["side-rail.css"], ".reader-side-rail", "border-radius"), /--reader-tab-radius/, "右缘竖条和页签胶囊一个圆角");
  assert.doesNotMatch(read(files.download), /ChevronDown|reader-download-trigger-caret/, "下载只是一个图标");
  assert.doesNotMatch(css("toc-minimap.css"), /reader-react-scroll-shell/, "目录不再切书页左边");
});

test("书页区右缘的竖条（2026-11-28 用户：顶栏右边的 AI 回答 / Markdown、下载挪到右侧，悬浮）：浮在书页区右边竖着居中，不占栏；面板按钮在上、一道细线、下载在下，下载往左弹", () => {
  const app = read("src/ReaderAppReactPdf.tsx");
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf("<ReaderCompareGrid"));
  assert.match(stage, /<ReaderSideRail active=\{assistantPanel\} \/>/, "在书页区里");
  const rail = read("src/components/react-pdf/ReaderSideRail.tsx");
  assert.match(rail, /<ReaderBarTools place="side" active=\{active\} \/>\s*<span className="reader-side-rail-sep" aria-hidden \/>\s*<ReaderDownloadActions \/>/);
  const block = css("side-rail.css").slice(css("side-rail.css").indexOf(".reader-side-rail {"));
  const rule = block.slice(0, block.indexOf("}"));
  assert.match(rule, /position:\s*absolute;[\s\S]*top:\s*50%;[\s\S]*right:\s*14px;/, "浮在右缘、竖着居中");
  assert.match(rule, /flex-direction:\s*column/);
  assert.equal(declaration(["side-rail.css"], ".reader-side-rail .reader-bar-tools .reader-bar-tool", "width"), "30px");
  assert.match(css("side-rail.css"), /\.reader-side-rail \.reader-download-menu,[^{]*\{[^}]*right:\s*calc\(100% \+ 10px\)/, "下载菜单往左弹");
  assert.match(read("styles/entry.css"), /@import "\.\/side-rail\.css" layer\(pages\);/);
  assert.doesNotMatch(css("side-rail.css"), /#[0-9a-f]{3,6}\b|--accent|--warn|--blue/i, "不用彩色");
});
