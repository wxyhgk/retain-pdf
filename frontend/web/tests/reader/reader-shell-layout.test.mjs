/** 阅读页的壳层（2026-11-28）：根节点里只有中间工作区一行；顶栏、底栏上午是实占的两行，下午起都浮在书页区上（底栏：左中右三颗胶囊）；
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

test("根节点里只有中间工作区一行：顶栏、底栏都不占行（2026-11-28 下午），提问窗贴右边时上下都不用让", async () => {
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "display"), "flex");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "flex-direction"), "column");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "--reader-topbar-h"), null, "顶栏又占一行了");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "--reader-bottombar-h"), null, "底栏又占一行了");
  const metrics = await import("../../../packages/reader/src/app/shell-metrics.ts");
  assert.equal(metrics.READER_TOPBAR_HEIGHT, undefined);
  assert.equal(metrics.READER_BOTTOMBAR_HEIGHT, undefined);
  assert.deepEqual(metrics.READER_DOCK_INSETS, { top: 0, bottom: 0 });
  assert.match(read("src/ask/ReaderAskPanel.tsx"), /dockInsets=\{READER_DOCK_INSETS\}/);
});

test("中间工作区 flex: 1 撑满、自己裁掉溢出；书页区 flex: 1", () => {
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "min-height"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-workspace", "overflow"), "hidden");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "flex"), "1 1 auto");
  assert.equal(declaration(["react-pdf.css"], ".reader-stage", "min-width"), "0");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-scroll-shell", "inset"), "0");
});

test("底栏浮在书页区底下（2026-11-28 下午）：透明层不接点击，左中右三颗胶囊接；书页区窄时合成一颗；横向滚动条、出错提示让出它", () => {
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "position"), "absolute");
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "bottom"), "8px");
  assert.equal(declaration(["hud.css"], ".reader-bottombar", "pointer-events"), "none", "透明的那一层挡住了书页");
  for (const [selector, column] of [[".reader-bottombar-start", "1"], [".reader-bottombar-center", "2"], [".reader-bottombar-end", "3"]]) {
    assert.equal(declaration(["hud.css"], selector, "grid-column"), column, `${selector} 不在第 ${column} 列`);
  }
  assert.equal(declaration(["hud.css"], ".reader-bottombar-start", "justify-self"), "start");
  assert.equal(declaration(["hud.css"], ".reader-bottombar-end", "justify-self"), "end");
  const hud = css("hud.css");
  const narrow = hud.slice(hud.indexOf("@container reader-stage (max-width: 600px)"));
  assert.ok(narrow.length > 0, "书页区窄时没有合成一颗");
  assert.match(narrow, /\.reader-bottombar \{[^}]*pointer-events: auto;/, "合成一颗后接不到点击");
  // 和顶栏一样比窄屏停靠栏（30）低。
  assert.ok(Number(declaration(["hud.css"], ".reader-bottombar", "z-index")) < 30);
  // 右缘竖条比两条栏低：底栏右边的快捷键说明往上弹时盖在竖条上，不是被它压住。
  assert.ok(Number(declaration(["side-rail.css"], ".reader-side-rail", "z-index")) < Number(declaration(["hud.css"], ".reader-bottombar", "z-index")));
  assert.equal(declaration(["react-pdf.css"], ".reader-react-root", "--reader-float-bottom-room"), "50px");
  assert.equal(declaration(["react-pdf.css"], ".reader-pane-scrollbar", "bottom"), "var(--reader-float-bottom-room, 50px)", "横向滚动条压在底下胶囊底下");
  assert.equal(declaration(["react-pdf.css"], ".reader-react-error", "bottom"), "calc(var(--reader-float-bottom-room, 50px) + 8px)");
  assert.equal(declaration(["react-pdf.css"], ".reader-error-notice", "top"), "var(--reader-float-bar-room, 56px)", "出错提示压在页签上");
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

test("浮着的顶栏读的时候藏着（2026-11-28 用户：停留时不显示顶上的按钮，返回一起藏）：鼠标到书页区顶上或滚动时才出来；进度、▾ 开着时不藏；触屏不藏", async () => {
  const reveal = await import("../../../packages/reader/src/components/react-pdf/use-topbar-reveal.ts");
  assert.equal(reveal.TOPBAR_REVEAL_ZONE_PX, 72);
  assert.equal(reveal.isInRevealZone(60, 0), true, "顶上 60px 应该出来");
  assert.equal(reveal.isInRevealZone(200, 0), false, "书页中间动鼠标不该出来");
  assert.equal(reveal.isInRevealZone(130, 100), true, "按书页区的顶算，不按窗口");
  const tabs = read("src/components/react-pdf/ReaderWorkspaceTabs.tsx");
  assert.match(tabs, /useTopBarReveal\(bar, mode\)/);
  assert.match(tabs, /data-revealed=\{shown \? "true" : "false"\}/);
  const chrome = css("chrome.css");
  const hide = chrome.slice(chrome.indexOf("@media (hover: hover)"), chrome.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(hide, /\[data-revealed="false"\]:not\(:has\(\.reader-bar-tools-popup, \.reader-live-strip\)\) > \.reader-workspace-start/, "返回没跟着藏，或者进度、▾ 开着也藏了");
  assert.match(hide, /> \.reader-workspace-center \{\s*opacity: 0;\s*pointer-events: none;/);
  // 不能用 CSS 的 :focus-visible 留住：点过页签再按 1 / 2 / 3，浏览器把那颗按钮改算成 :focus-visible，顶栏就一直挂着。
  assert.doesNotMatch(hide, /focus-visible/);
  assert.match(read("src/components/react-pdf/use-topbar-reveal.ts"), /addEventListener\("focusin"/, "键盘 Tab 到上面出不来");
  // 11-28 用户：「滚动的时候得出现这些按钮，不然用户可能看不到」——scroll 不冒泡，在书页区上用捕获听。
  assert.match(read("src/components/react-pdf/use-topbar-reveal.ts"), /stage\.addEventListener\("scroll", onScroll, \{ capture: true, passive: true \}\)/, "滚动时不出来");
});

test("页面结构：中间工作区（左栏、书页区、右边停靠栏）；浮着的顶栏、底栏都在书页区里；书页区里只有顶栏、目录、竖条、书页和它的加载、出错、底栏", () => {
  const app = read("src/ReaderAppReactPdf.tsx");
  const order = ['<div className="reader-workspace">', "<ReaderFinderArea", '<div className="reader-stage">', "<ReaderWorkspaceTabs", "<ReaderCompareGrid", "<ReaderReactBoot", "<ReaderZoomHud", "<aside", 'className="reader-dock"', 'className="reader-dock-body"'];
  let last = -1;
  for (const part of order) {
    const at = app.indexOf(part);
    assert.ok(at > last, `${part} 不在该在的位置`);
    last = at;
  }
  // 「对照」后面的 ▾（ReaderBarTools place="compare"）跟着页签在书页区里，别的工具不放进来。
  // 「对照」后面的 ▾、底栏的画笔截图（ReaderBarTools place="compare" / "bottom"）跟着两条栏在书页区里，别的工具不放进来。
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf('className="reader-dock"'))
    .replace('<ReaderBarTools place="compare" />', "").replace('<ReaderBarTools place="bottom" />', "");
  assert.doesNotMatch(stage, /<ReaderBarTools/, "书页区里又放了别的工具");
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
  assert.match(bookmark, /<BookmarkIcon filled=\{marked\} \/>\s*<\/button>\s*<ReaderFavoritesEntry scope=\{scope\} \/>/);
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
