/** 顶栏上两组长得一样的东西。
 *
 * 用户报的原话是「这几个我发现有多余的」。查下来不是功能重复，是**两组不同的
 * 东西穿了同一身衣服**：
 *
 *   中间（ReaderWorkspaceTabs）  FileText 源文件 · Columns2 对照 · Languages 翻译文件  切视图
 *   右上（ReaderDownloadActions）FileText 原文   · Columns2 对照 · Languages 译文      下载文件
 *
 * 同一套 lucide 图标各出现一次，两组都写着「对照」，挨在一条栏上。
 *
 * 外加一个永久噪音：任务进终态后 pagesByPage 不清空，顶栏那个
 * 「实时译文 · 已完成」pill 就在每篇读完的文档上永久挂着。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { resolveLiveTranslationToggles }
  from "../../../packages/reader/src/shared/data/live-translation-state.ts";

const read = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const DOWNLOADS = read("../../../packages/reader/src/components/react-pdf/ReaderDownloadActions.tsx");
const CHROME = read("../../../packages/reader/styles/chrome.css");
const APP = read("../../../packages/reader/src/ReaderAppReactPdf.tsx");
// 2026-11-27 起叠层的两个开关在这里算（App 只用顶栏 pill 那个）。
const OVERLAY = read("../../../packages/reader/src/app/use-live-translation-overlay.tsx");

test("下载收成一颗「下载」按钮，和中间的模式页签分得开", () => {
  // 以前三路摊开、和模式页签同一套图标 + 都写着「对照」，靠一个 ⤓ 组前缀区分；
  // 现在收成一颗带下载图标和「下载」字样的按钮，三路在点开的菜单里。
  assert.match(DOWNLOADS, /<summary[^>]*className="reader-download-trigger"/, "下载不是一颗按钮");
  assert.match(DOWNLOADS, /<Download\s/, "按钮上没有下载图标");
  assert.match(DOWNLOADS, /reader-download-trigger-label">下载</, "按钮上没有「下载」两个字");
  assert.doesNotMatch(DOWNLOADS, /reader-download-actions-prefix/, "组前缀那套已经不需要了");
});

test("顶栏是实占位的左-中-右三段网格（2026-11-28）：左右同宽，模式页签相对视口居中；不再 fixed、不再给托盘留位", () => {
  // 以前顶栏 fixed 盖在书页上，两头的按钮各自 fixed 浮着，靠 --reader-tray-width 两边对称留位（更早是左 72、右 300，页签偏 114px）。
  const bar = CHROME.slice(CHROME.indexOf(".reader-workspace-bar {"));
  const block = bar.slice(0, bar.indexOf("\n}\n"));
  assert.match(block, /grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/, "顶栏不是左右同宽的三段");
  assert.match(block, /height:\s*var\(--reader-topbar-h, 54px\);/);
  assert.doesNotMatch(block, /position:\s*fixed/, "顶栏又浮回书页上了");
  assert.doesNotMatch(CHROME.replace(/\/\*[\s\S]*?\*\//g, ""), /--reader-tray-width/, "又回到给托盘留位");
  // 2026-11-28 用户：顶栏左边去掉「目录」「搜索」——目录固定用目录卡上的图钉，搜索挪到底栏左边。
  const start = APP.slice(APP.indexOf("start={<>"), APP.indexOf("</>}", APP.indexOf("start={<>")));
  assert.match(start, /<ReaderCloseHome[\s\S]*?reader-workspace-title/, "左段：返回、书名");
  assert.doesNotMatch(start, /ReaderTocToggle|ReaderFinderToggles/, "顶栏左段又有目录、搜索了");
  assert.match(APP, /startSlot=\{<ReaderFinderToggles open=\{finder\} onToggle=\{finderState\.toggleSidebar\} issueCount=\{issueNav\.issues\.length\} \/>\}/, "搜索在底栏左边");
  // 右段空着（2026-11-28：提问、Markdown、下载挪去书页区右缘的竖条），留着让页签在正中。
  assert.doesNotMatch(APP, /\bend=\{/, "顶栏右段又放东西了");
});

test("「下载」两个字一直收着（只给读屏），图标留着；不用 display:none 藏整块", () => {
  // 2026-11-28 起两条栏只用图标，「下载」不分宽窄都只是一个图标。
  const rule = CHROME.slice(CHROME.indexOf(".reader-download-trigger-label,"));
  const block = rule.slice(0, rule.indexOf("}"));
  assert.match(block, /clip:\s*rect\(0, 0, 0, 0\)/, "字没收成读屏才读得到");
  assert.doesNotMatch(block, /display:\s*none/, "用 display:none 藏了整块");
});

test("每一路仍然有自己的图标 —— 窄屏只剩图标时要分得出来", () => {
  // 只查「文件里出现 FileText」是假的 —— import 行就满足了，图标从按钮上删掉
  // 也照样绿。查 ICONS 这张表本身，外加按钮里确实渲染了它。
  const icons = DOWNLOADS.slice(DOWNLOADS.indexOf("const ICONS"), DOWNLOADS.indexOf("const SHORT"));
  assert.ok(icons.length > 0 && icons.length < 400, "ICONS 表没找到");
  for (const icon of ["FileText", "Columns2", "Languages"]) {
    assert.match(icons, new RegExp(`\\b${icon}\\b`), `${icon} 不在 ICONS 表里`);
  }
  assert.match(DOWNLOADS, /<Icon\s/, "按钮里没渲染图标 —— 窄屏三个按钮一模一样");
});

test("任务终态后顶栏 pill 不再渲染", () => {
  const live = resolveLiveTranslationToggles({
    hasOverlayContent: true, connection: "terminal", showSource: true,
  });
  assert.equal(live.topBarPill, false, "读完的文档顶栏还永久挂着「实时译文 · 已完成」");
});

test("翻译进行中 pill 还在 —— 它报的是进度", () => {
  for (const connection of ["live", "reconnecting", "connecting"]) {
    const live = resolveLiveTranslationToggles({
      hasOverlayContent: true, connection, showSource: true,
    });
    assert.equal(live.topBarPill, true, `${connection} 时 pill 不见了，进度没地方看`);
  }
});

test("叠层画得出来，就一定至少有一个开关够得着", () => {
  // 这是收掉顶栏 pill 的**全部前提**。穷举五个输入。
  //
  // 原来这条漏传 liveTranslationVisible / assistantOpen 两个必填项 —— .mjs 不过 tsc，
  // 于是 `input.liveTranslationVisible` 恒为 undefined、overlayRenderable 恒假，
  // **24 次循环一条断言都没执行过**（子 agent 实测打点）。所以最后要数一下。
  const connections = ["idle", "connecting", "live", "reconnecting", "terminal", "unavailable"];
  let checked = 0;
  for (const hasOverlayContent of [true, false]) {
    for (const connection of connections) {
      for (const showSource of [true, false]) {
        for (const liveTranslationVisible of [true, false]) {
          for (const assistantOpen of [true, false]) {
            const live = resolveLiveTranslationToggles({
              hasOverlayContent, connection, showSource, liveTranslationVisible, assistantOpen,
            });
            if (!live.overlayRenderable) continue;
            checked += 1;
            assert.ok(live.topBarPill || live.sourcePaneToggle,
              `叠层能画出来却没有任何开关：${JSON.stringify({
                hasOverlayContent, connection, showSource, liveTranslationVisible, assistantOpen,
              })}`);
          }
        }
      }
    }
  }
  assert.ok(checked > 0, "一条断言都没执行 —— overlayRenderable 在整个输入空间上恒假");
});

test("两个开关都真的接在这个函数上 —— 否则上面那条守的是没人调的代码", () => {
  assert.match(OVERLAY, /resolveLiveTranslationToggles\(/, "组件没调这个函数");
  assert.match(APP, /liveToggles\.topBarPill/, "顶栏 pill 没走 liveToggles");
  assert.match(OVERLAY, /liveToggles\.sourcePaneToggle/, "源文栏开关没走 liveToggles");
  // 旧的自己拼条件的写法不能留着，留着就是两套真源。
  for (const source of [APP, OVERLAY]) {
    assert.doesNotMatch(source, /!hasOverlayContent \|\| !paneComposition\.showSource/,
      "源文栏开关还在自己拼条件");
  }
});
