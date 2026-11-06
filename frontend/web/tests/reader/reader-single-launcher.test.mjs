/** 阅读页只有**一个**面板启动器，而且它整体不会被藏起来。
 *
 * ## 起因
 *
 * 原来有两个：右侧竖条（rail）管 Markdown / AI / 阅读路径 / 画布 / 终端，
 * 可拖动圆钮（FAB）管 Markdown / AI / 批注 / AI 批注 / 摘录 / 三路下载。
 * 重叠两个、都看不到全貌，用户得先记住「批注在圆钮、路径在竖条」这张哪儿都
 * 没写的表。
 *
 * 更糟的是它们会互斥：
 *
 *     .reader-react-root.is-assistant-open .reader-fab { opacity: 0; pointer-events: none }
 *
 * `is-assistant-open` ⟺ 有面板开着。所以**只要任何一个 dock 面板开着，
 * 批注 / AI 批注 / 摘录 / 三路下载这 6 个功能全部不可达**，键盘也没有入口。
 * 而圆钮的高亮逻辑当时有 3 条测试守着 —— 守的是一段永远渲染不出来的 UI。
 *
 * ## 所以这份文件守的是「可达性」，不是「代码长什么样」
 *
 * - 每个面板都在唯一那个启动器的清单里（从 id 真源 map 出来对账，
 *   不手抄一份清单：手抄的那份漏一个也没人知道）；
 * - 三路下载仍然可达；
 * - **没有任何 CSS 规则会把这个启动器整体隐藏** —— 这正是圆钮栽的地方。
 *
 * 2026-11-06 起关着时的那一形态从右侧竖条挪到顶栏托盘（ReaderPanelToggles，一直在，开着时按下）：竖条上只剩 Markdown 一颗，
 * 孤零零浮在书页旁边，还要给它在阅读区右边留 62px。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import {
  READER_ASSISTANT_PANEL_IDS,
  READER_BASE_PANEL_IDS,
} from "../../../packages/reader/src/shared/types/reader-assistant-panels.ts";
import { readerDockTabs } from "../../../packages/reader/src/components/react-pdf/reader-dock-tabs.ts";
import { ReaderAssistantDock, ReaderPanelToggles } from "../../../packages/reader/src/components/react-pdf/ReaderAssistantDock.tsx";
import { READER_DOWNLOAD_ORDER } from "../../../packages/reader/src/components/react-pdf/use-reader-downloads.ts";
import {
  allRules,
  hidingDeclarations,
  isStateSelector,
  readerStyleSources,
  stripComments,
} from "./helpers/reader-css.mjs";

// 扫描范围包含宿主那两个 reader 入口 —— 它们和包的 styles 一起编译进同一份
// dist/css/reader.css。只扫包目录的话，隐藏规则写在 entries/reader.css 里整套全绿
// （复查实测过）。细节见 helpers/reader-css.mjs。
const allStyles = () => readerStyleSources().map(({ css }) => css).join("\n");

const APP = readFileSync(
  new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url),
  "utf8",
);
const readStyle = (name) => stripComments(readFileSync(
  new URL(`../../../packages/reader/styles/${name}`, import.meta.url),
  "utf8",
));

// ------------------------------------------------------------------ 清单对账

test("每个面板都在唯一那个启动器的清单里", () => {
  // 从 id 真源 map 出来比，不在这里抄第二份清单 —— 抄的那份漏一个的表现是
  // 「那个面板再也打不开」，而这条测试照样绿。
  const ids = readerDockTabs(() => true).map((tab) => tab.id);
  assert.equal(ids.length, READER_ASSISTANT_PANEL_IDS.length, `清单长度对不上: ${ids}`);
  assert.deepEqual([...ids].sort(), [...READER_ASSISTANT_PANEL_IDS].sort());
  // 顺序也来自真源：dock 里 tab 的先后就是这份清单的先后。
  assert.deepEqual(ids, [...READER_ASSISTANT_PANEL_IDS]);
  // 下限而不是等号：加面板不该让这条红。2026-11-03 RetainPDF 自己的 AI（终端）删了，只剩 Markdown。
  assert.ok(ids.length >= 1, `只有 ${ids.length} 个面板，八成漏登记了`);
});

test("每个面板都有标签和图标 —— 少一样那个 tab 要么空白要么崩", () => {
  for (const tab of readerDockTabs(() => true)) {
    assert.ok(tab.label && tab.label.trim(), `${tab.id} 没有标签`);
    assert.ok(tab.short && tab.short.trim(), `${tab.id} 没有竖条上的缩写`);
    assert.ok(tab.Icon, `${tab.id} 没有图标`);
  }
  const shorts = readerDockTabs(() => true).map((tab) => tab.short);
  assert.equal(new Set(shorts).size, shorts.length, `竖条缩写有重复: ${shorts}`);
});

test("**只有一个**启动器：圆钮那一套连同它的 CSS 一起没了", () => {
  // 先证明「另一个东西存在」：启动器本身的样式必须真的在，否则下面那条
  // 「圆钮不存在」在任何情况下都绿（整份 CSS 都被删掉时也绿）。
  const all = allStyles();
  assert.match(all, /\.reader-panel-toggle\b/, "启动器的顶栏按钮样式没了");
  assert.doesNotMatch(all, /\.reader-assistant-rail\b/, "右侧竖条又回来了：面板按钮在顶栏托盘里");
  const tray = APP.slice(APP.indexOf('className="reader-chrome-tray"'), APP.indexOf("</div>", APP.indexOf('className="reader-chrome-tray"')));
  assert.match(tray, /<ReaderPanelToggles\b/, "面板按钮不在顶栏托盘里");
  assert.match(all, /\.reader-assistant-dock-tabs\b/, "启动器的 tab 条样式没了");
  assert.doesNotMatch(all, /\.reader-fab\b/, "圆钮的 CSS 又回来了");
  assert.doesNotMatch(APP, /ReaderFab|fabActiveTool/, "阅读页又挂了一个圆钮");
});

/** 阅读页里每个包内面板的开合插槽声明：变量名 → 面板 id。
 *
 * 面板 id 在阅读页里只写这一处（见 use-reader-panel-slot.ts）。所以「哪个 tab
 * 接到哪个面板」这件事可以**当账来对**：每个 id 恰好一个插槽、每个插槽的
 * `.open` 恰好被一个面板消费。抄改写错的表现一定是某个插槽被用了两次、另一个
 * 一次都没用到。 */
function panelSlots() {
  return [...APP.matchAll(/const (\w+) = useReaderPanelSlot\(assistantPanel, "([a-z-]+)"\)/g)]
    .map(([, name, id]) => ({ name, id }));
}

test("每个面板的 tab 真的接到了那个面板上 —— 不是「tab 在、点了没东西」", () => {
  // 这条是补上来的：反证时把摘录的 `open` 改成写死的 false（tab 还在、点了
  // 打不开），**整个 2000 条的套件全绿**。启动器清单那几条只证明 tab 在，
  // 证明不了 tab 接到了东西 —— 而这正是要修的那类缺陷本身。
  //
  // 包自己渲染的面板逐个对账；宿主槽位面板的同一条由
  // reader-host-panel-wiring.test.mjs 真渲染一遍盖住（它以前谁也没守，
  // 把壳里的 `active === panel.id` 改成 `active === "terminal"` 全套绿）。
  const slots = panelSlots();
  assert.deepEqual(
    [...slots.map((slot) => slot.id)].sort(),
    [...READER_BASE_PANEL_IDS].sort(),
    `面板插槽和 id 真源对不上：${slots.map((slot) => slot.id)}`,
  );
  assert.equal(new Set(slots.map((slot) => slot.id)).size, slots.length, "同一个面板声明了两次插槽");
  for (const { name, id } of slots) {
    const used = APP.split(`open={${name}.open}`).length - 1;
    assert.equal(used, 1, `${id} 的插槽被 ${used} 个面板当作 open —— 不是 1 就是接错了人`);
  }
});

test("懒加载面板的挂载闸守的就是它自己那个面板", () => {
  // 闸和面板用了不同的插槽是个抄改出来的错：闸是单调 latch，面板会变成
  // 「先开过另一个面板才打得开」，而 tsc 和上面那条都不会红。
  //
  // 上一版这条只校验「闸上那个 id 在别处有 open 绑定」—— 把摘录的闸换成
  // "markdown"，那条绑定被 Markdown 面板自己满足了，全套 2049 条全绿（复查实测）。
  const names = new Set(panelSlots().map((slot) => slot.name));
  const latched = [...APP.matchAll(/\{(\w+)\.mounted \? ([\s\S]*?) : null\}/g)];
  // AI 问答面板删掉之后只剩 Markdown 一个懒加载面板。下限保持 1：这条守的是
  // 「闸和面板不能接错人」，不是「有几个闸」。
  assert.ok(latched.length >= 1, `只找到 ${latched.length} 个挂载闸，正则八成没匹配上`);
  for (const [, name, jsx] of latched) {
    assert.ok(names.has(name), `挂载闸用了没声明过的插槽 ${name}`);
    assert.ok(
      jsx.includes(`open={${name}.open}`),
      `挂载闸用的是 ${name}，它守着的面板 open 却来自另一个插槽 —— 闸和面板对不上`,
    );
  }
});

// ------------------------------------------------- 没有 CSS 会把启动器整体藏掉

const LAUNCHER_SELECTORS = [
  ".reader-panel-toggle",
  ".reader-assistant-dock-header",
  ".reader-assistant-dock-tabs",
  ".reader-assistant-dock-tab",
  ".reader-assistant-dock-close",
];

test("没有任何 CSS 规则会把这个启动器整体隐藏", () => {
  // 圆钮就是这么没的：一条 `.is-assistant-open .reader-fab { opacity: 0 }`，
  // 于是它管的 6 个功能在「有面板开着」时全部不可达，而三条测试还在守着它的
  // 高亮逻辑 —— 守的是一段永远渲染不出来的 UI。
  let seen = 0;
  const problems = [];
  for (const { name, css } of readerStyleSources()) {
    for (const rule of allRules(css)) {
      const hitsLauncher = LAUNCHER_SELECTORS.some((sel) =>
        // `.reader-assistant-rail-button` 是启动器里的一个按钮，不是启动器本身；
        // 只认「选择器以这个类结尾」的那些。
        new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(rule.prelude));
      if (!hitsLauncher) continue;
      seen += 1;
      // :hover / :focus / :disabled 之类的状态不算 —— 那是交互反馈，不是入口消失。
      if (isStateSelector(rule.prelude)) continue;
      for (const pattern of hidingDeclarations(rule.body)) {
        problems.push(`${name}: ${rule.prelude} { …${pattern.source} }`);
      }
    }
  }
  // 先断言「扫到了东西」：扫描器失效时上面那条在任何情况下都绿。
  assert.ok(seen >= 5, `只扫到 ${seen} 条启动器规则，扫描器八成失效了`);
  assert.deepEqual(problems, [], `启动器被藏起来了：\n  ${problems.join("\n  ")}`);
});

test("启动器的两种形态都真的渲染出可点的东西", () => {
  // 上面那条是「没有人藏它」，这条是「它本来就在」—— 两条缺一不可。
  const rail = renderToStaticMarkup(
    createElement(ReaderPanelToggles, { active: null, onSelect() {}, onClose() {} }),
  );
  const dock = renderToStaticMarkup(
    createElement(ReaderAssistantDock, { active: "notes", onSelect() {}, onClose() {} }),
  );
  // 宿主适配器没注册时只有 base 面板，但它们必须一个不少地画出来。
  // 从真源取，不在这里抄 —— 抄的那份漏一个，这条照样绿。
  for (const id of READER_BASE_PANEL_IDS) {
    const label = readerDockTabs(() => false).find((tab) => tab.id === id)?.label;
    assert.ok(rail.includes(`打开${label}`), `顶栏上没有${label}的按钮`);
    assert.ok(dock.includes(`>${label}<`), `tab 条上没有${label}`);
  }
  assert.match(dock, /aria-label="关闭阅读辅助面板"/);
});

// ------------------------------------------------------------------ 三路下载

test("三路下载仍然可达，而且不在启动器里 —— 它不该和面板抢位置", () => {
  assert.deepEqual([...READER_DOWNLOAD_ORDER], ["source", "sideBySide", "translated"]);
  // 顶栏那一组常驻：面板开着也够得到（原来在圆钮里，圆钮一被藏就下不了）。
  assert.match(APP, /<ReaderDownloadActions\s*\/>/, "阅读页没挂顶栏下载组");
  const tray = APP.slice(APP.indexOf('className="reader-chrome-tray"'), APP.indexOf("</div>", APP.indexOf('className="reader-chrome-tray"')));
  assert.match(tray, /<ReaderDownloadActions/, "下载组不在顶栏那一组里");
  assert.match(tray, /<ReaderCloseHome/, "顶栏那一组里没有「关闭回主页」");
  // 这一组不能被 dock 的开合影响 —— 圆钮当年就死在这一点上。
  const all = allStyles();
  assert.match(all, /\.reader-chrome-tray\b/, "顶栏那一组没有样式");
  for (const rule of allRules(all)) {
    if (!/\.reader-(chrome-tray|download-action)(?![\w-])/.test(rule.prelude)) continue;
    if (/:(hover|focus|active|disabled|focus-visible)\b/.test(rule.prelude)) continue;
    assert.doesNotMatch(
      rule.body,
      /display\s*:\s*none|visibility\s*:\s*hidden|pointer-events\s*:\s*none/,
      `下载入口被藏起来了：${rule.prelude}`,
    );
  }
});

// ------------------------------------------------------------ tab 放不下的降级

test("8 个 tab 放不下时有降级，而不是溢出", () => {
  // dock 最窄 30vw（reader-assistant-split-constraints.ts），1280 的屏上 384px；
  // 8 个中文 tab 一行要 ~560px。不处理的话要么撑破 header 把关闭按钮挤出去，
  // 要么横向溢出到看不见。
  const css = readStyle("assistant-dock.css");
  // 同一个选择器可能有好几条规则（基础样式一条、后来补的一条），**必须合起来
  // 看** —— 只取最后一条的话，写在前面那条声明就查不到，测试会红在对的地方
  // 却给出错的理由。
  const rules = new Map();
  for (const rule of allRules(css)) {
    const key = rule.prelude.trim();
    rules.set(key, (rules.get(key) ?? "") + rule.body);
  }
  const tabs = rules.get(".reader-assistant-dock-tabs");
  assert.ok(tabs, "tab 条的规则没了");
  assert.match(tabs, /min-width\s*:\s*0/, "tab 条不能被压缩，会把关闭按钮挤出去");
  assert.match(tabs, /overflow-x\s*:\s*(auto|scroll)/, "放不下时既不滚也不降级 = 溢出");

  const close = rules.get(".reader-assistant-dock-close");
  assert.ok(close, "关闭按钮的规则没了");
  assert.match(close, /flex\s*:\s*0 0 auto/, "关闭按钮会被 tab 条挤掉，面板只能靠 Esc 关");

  // 窄 dock 上只留图标。容器查询必须写在基础规则**之后**，否则同特异性下被
  // 后面的 padding / gap 覆盖回去 —— 看着写了降级，实际没生效。
  const labelHidden = css.indexOf("@container reader-dock");
  assert.ok(labelHidden > 0, "没有按 dock 宽度降级的容器查询");

  // 断点那个**数值**是这条降级唯一承重的东西，必须单独守。
  // 上一版只断言「@container reader-dock 这个字符串在、且排在基础规则之后」，
  // 把 700px 改成 200px 整套 2049 条全绿（复查实测）—— 而 200px 的后果正是
  // CSS 注释里自己写明的那个：1280 屏上 dock 默认 50vw = 640px，降级压根不触发，
  // 8 个中文标签 tab 一打开就带着横向滚动。
  const breakpoint = /@container reader-dock \(max-width:\s*(\d+)px\)/.exec(css);
  assert.ok(breakpoint, "降级的容器查询不是按 max-width 写的，量不出断点");
  const px = Number(breakpoint[1]);
  assert.ok(
    px >= 664,
    `降级断点 ${px}px 太小：8 个中文标签连同内边距要 ~664px，而 1280 屏上 dock 默认 640px，`
      + "这个数落在标签那一侧就等于没降级",
  );
  assert.ok(
    px <= 960,
    `降级断点 ${px}px 太大：宽 dock 上也只剩图标，标签形同虚设`,
  );
  assert.ok(
    labelHidden > css.indexOf(".reader-assistant-dock-tab {"),
    "容器查询写在基础规则之前，会被覆盖回去",
  );
  assert.match(css.slice(labelHidden), /\.reader-assistant-dock-tab-label/);
  // 容器本身要声明，否则那条查询永远不匹配。
  assert.match(rules.get(".reader-assistant-dock-header"), /container-name\s*:\s*reader-dock/);
  assert.match(rules.get(".reader-assistant-dock-header"), /container-type\s*:\s*inline-size/);
});

// ------------------------------------------------------- 纯本地 PDF 下的可达性

/** 渲染一次启动器，读出「每个入口点不点得动」。
 *
 * 读的是真渲染出来的 button.disabled，不是 reader-base-panels.ts 里那张表 ——
 * 抄那张表的话，抄错和实现错长得一模一样。 */
function launcherDisabledState(active) {
  const html = renderToStaticMarkup(
    createElement(active ? ReaderAssistantDock : ReaderPanelToggles, { active, sourceOnly: true, onSelect() {}, onClose() {} }),
  );
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  const state = new Map();
  for (const button of doc.querySelectorAll("button")) {
    const title = (button.getAttribute("title") ?? "").replace(/ 需打开任务阅读$/, "");
    state.set(title, button.disabled);
  }
  return state;
}

test("needsJob 真的会让入口点不动 —— 它是启动器上唯一的禁用开关", () => {
  // 起因：needsJob 一条门禁都没有。把批注和摘录的 needsJob 从 false 改成 true，
  // 整套 2049 条全绿（复查实测），后果是纯本地 PDF 下那两个 tab 直接禁用。
  //
  // 那两个面板后来都删了。这个 helper 渲染的是**没注册宿主适配器**的 dock，
  // 所以它只看得见 base 面板（终端那类宿主槽位面板归 reader-terminal-slot 管，
  // 顺带一提终端是 needsJob: false —— 它接 agent 进程，没有翻译任务照样能开）。
  //
  // 现在 base 面板只剩 Markdown，它 needsJob: true。所以主断言反过来写：
  // 没有 job 时它必须点不动。把它的 needsJob 改成 false，这条就红。
  // 按 base 面板的 id 真源筛。不能用 `needsJob !== undefined` —— readerDockTabs
  // 给宿主槽位面板也填了 needsJob: false，那样会把终端筛进来，而这个 helper
  // 根本没渲染它（没注册适配器），断言会拿到 undefined。
  const base = readerDockTabs(() => true)
    .filter((tab) => READER_BASE_PANEL_IDS.includes(tab.id));
  assert.ok(base.length > 0, "一个 base 面板都没有，这条测试等于不存在");

  for (const active of [null, "markdown"]) {
    const state = launcherDisabledState(active);
    for (const tab of base) {
      assert.equal(
        state.get(tab.label), tab.needsJob,
        `${tab.label} 的 needsJob=${tab.needsJob}，启动器上却是 disabled=${state.get(tab.label)}`,
      );
    }
    // 正对照：确实有入口被禁用。否则 disabled 那条分支整个失效时上面也可能全绿。
    assert.ok(
      [...state.values()].some(Boolean),
      `${active ? "tab 条" : "顶栏按钮"}上一个禁用的入口都没有，sourceOnly 那条分支八成失效了`,
    );
  }
});
