/** 开关右侧面板之后，页面被从中间切掉、右边空白、而且横向滚不动。
 *
 * # 链路
 *
 * PDF 每一页的 canvas 按 `<Page width>` 重画，而这个 width 最终跟的是 shell 的
 * **实时**宽度：
 *
 *   shellWidth(ResizeObserver) → pageWidthBasis → PdfDocumentPane 的 width effect
 *   → pageWidth → PdfPageSlot → react-pdf <Page width>
 *
 * shell 宽度在两种操作下连续变化：开关面板走 `transition: right 180ms ease`，
 * 拖分栏线每次指针移动写一次 --reader-ai-split-width。不防抖的话开关一次面板
 * 会让每张可见页重画十来次，每次取消上一次 pdf.js 的渲染任务 —— 那是取消竞态的
 * 必要前提，而竞态的表现正是「canvas 已是新尺寸、内容却是上一次按旧比例画了
 * 一半的」：左半页 + 右边空白，且**栏那层看不到溢出，所以滚不动**。
 *
 * # 原来的偏差
 *
 * PdfDocumentPane 两条分支待遇不同：ResizeObserver 那条有 80ms 防抖，
 * pageWidthOverride 那条立即提交。而 override 恒有值（ReaderCompareGrid 总传
 * pageWidthBasis），于是带防抖的那条从来不走，真正会连续变化的那条一点没防。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  READER_WIDTH_EPSILON,
  READER_WIDTH_SETTLE_MS,
  resolveReaderWidthCommit,
} from "../../../packages/reader/src/pdf/reader-zoom.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
/** 剥掉注释再比。
 *
 * 今天在这个仓库里第五次栽在同一个形状上：**负向断言命中了自己的解释性注释**。
 * 解释一处错误时往往要引用那句错话（`useState(960)`、`.reader-notes-count`、
 * `CSP 把出网整个关掉`…），于是 doesNotMatch 永远红。
 *
 * 所以凡是「这段代码里不该出现 X」的断言，一律先过这个。 */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
const PANE = read("../../../packages/reader/src/pdf/PdfDocumentPane.tsx");
const SHELL = read("../../../packages/reader/src/hooks/use-reader-shell.ts");
const GRID = read("../../../packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx");
const CSS = read("../../../packages/reader/styles/react-pdf.css");

test("第一次拿到宽度必须立刻给 —— 等 200ms 就是白屏 200ms", () => {
  assert.equal(resolveReaderWidthCommit(900, 0), "immediate");
  assert.equal(resolveReaderWidthCommit(900, Number.NaN), "immediate");
});

test("之后的每次变化都等布局稳定", () => {
  assert.equal(resolveReaderWidthCommit(500, 900), "settle");
  assert.equal(resolveReaderWidthCommit(1400, 900), "settle");
});

test("小于阈值的抖动不重画整页", () => {
  assert.equal(resolveReaderWidthCommit(900 + READER_WIDTH_EPSILON - 1, 900), "ignore");
  assert.equal(resolveReaderWidthCommit(900 - READER_WIDTH_EPSILON + 1, 900), "ignore");
  // 刚好到阈值就得动。
  assert.equal(resolveReaderWidthCommit(900 + READER_WIDTH_EPSILON, 900), "settle");
});

test("坏值一律不提交", () => {
  for (const bad of [Number.NaN, Infinity, -1, 0, 79]) {
    assert.equal(resolveReaderWidthCommit(bad, 900), "ignore", `${bad} 被提交了`);
  }
});

test("一次面板开关（180ms 过渡）只提交一次宽度", () => {
  // 复刻过渡：shell 的 right 从 0 动到 50vw，ResizeObserver 每帧报一次。
  // 这条是这个 bug 的核心 —— 原来每一帧都会重画整页。
  let last = 1900;
  let pending = null;
  let commits = 0;
  const now = { t: 0 };
  const sync = (w) => {
    const decision = resolveReaderWidthCommit(w, last);
    if (decision === "ignore") return;
    pending = null;
    if (decision === "immediate") { last = w; commits += 1; return; }
    pending = { w, at: now.t + READER_WIDTH_SETTLE_MS };
  };
  // 180ms 过渡，60fps ≈ 11 帧，宽度从 1900 线性到 950
  for (let frame = 0; frame <= 11; frame += 1) {
    now.t = frame * 16;
    sync(Math.round(1900 - (950 * frame) / 11));
  }
  // 过渡结束后时间推进，挂起的那次落地
  now.t = 180 + READER_WIDTH_SETTLE_MS;
  if (pending && now.t >= pending.at) { last = pending.w; commits += 1; }

  assert.equal(commits, 1, `一次开关提交了 ${commits} 次宽度，每次都会重画每一张可见页`);
  assert.equal(last, 950, "最终宽度不是过渡结束时的那个");
});

test("防抖真的接在 override 那条分支上 —— 否则守的是没人走的代码", () => {
  // 查的是**调用点**，不是文件里有没有这个名字：import 行也含这个字符串，
  // 只写 /resolveReaderWidthCommit\(/ 的话，把调用换成内联三元照样绿
  // （反证时实测，这条曾是假的）。
  const effect = PANE.slice(
    PANE.indexOf("const commit = (w: number)"),
    PANE.indexOf("}, [pageWidthOverride"),
  );
  assert.match(effect, /=\s*resolveReaderWidthCommit\(w, lastWidthRef\.current\)/,
    "width effect 没走那个纯函数，自己拼了条件");
  assert.match(effect, /setTimeout\(\(\) => commit\(w\), READER_WIDTH_SETTLE_MS\)/,
    "settle 分支没有真的延后提交");
});

test("这个 effect 只有一个出口 —— 多一条 return 就多一处可能漏清定时器", () => {
  // 原来有三条 return，每条都得自己记得 clearTimeout；漏掉的那条的表现是
  // 「卸载之后 setState」，控制台一句警告，没有测试会红。
  //
  // 数 clearTimeout 的个数是抓不住的（实际 4 处，删一处还剩 3，而下限写的就是
  // 3 —— 反证时实测）。改成结构性要求：出口只有一个，清理只写一遍。
  const effect = PANE.slice(
    PANE.indexOf("const commit = (w: number)"),
    PANE.indexOf("}, [pageWidthOverride"),
  );
  // 按**缩进层级**数，不是按行首关键字：内联的提前返回写成
  // `if (hasOverride) return;`，行首是 if，只匹配 /^ {6}return / 的话抓不到
  // （反证时实测，这条曾是假的）。effect 顶层语句缩进 6 格，syncWidth/commit
  // 内部合法的 return 缩进 8 格，正好区分得开。
  //
  // 两个坑都踩过：注释里写了 "return" 会被数进去（先剥注释）；`\S` 会吃掉
  // `return` 的 r 导致真正的出口行反而匹配不上（改用前瞻）。
  const code = effect.replace(/\/\/.*/g, "");
  const exits = (code.match(/^ {6}(?=\S).*\breturn\b/gm) || []).length;
  assert.equal(exits, 1, `effect 有 ${exits} 个出口，每多一个就多一处可能漏清定时器`);
  assert.match(effect, /return \(\) => \{[\s\S]*?clearTimeout\(widthTimerRef\.current\)/,
    "唯一那个出口没有清定时器");
});

test("settle 时长要盖过书页区的过渡 —— 不然过渡没完就提交，等于没防", () => {
  // 2026-11-27 起让右边的是书页区（.reader-stage，滚动壳在里面铺满），过渡也在它上面。
  const rule = CSS.slice(CSS.indexOf(".reader-stage {"));
  const match = /transition:\s*right\s+(\d+)ms/.exec(rule.slice(0, rule.indexOf("}")));
  assert.ok(match, "shell 的 right 过渡没了，这条门禁的前提变了");
  assert.ok(
    READER_WIDTH_SETTLE_MS >= Number(match[1]),
    `settle ${READER_WIDTH_SETTLE_MS}ms 短于过渡 ${match[1]}ms`,
  );
});

test("首屏交上去的第一个宽度必须是真实测量，不能是硬编码的种子", () => {
  // shellWidth 原来 `useState(960)`。React 的提交顺序是死的：
  //
  //   commit 1  Grid 用 960 渲染出 basis；bindShell 在 ref 阶段 setShellEl，
  //             但本轮 RO effect 闭包里 shellEl 还是 null，一次都没量。
  //   同一轮    PdfDocumentPane 的宽度 effect 跑：lastWidthRef 是 0 →
  //             resolveReaderWidthCommit 返回 "immediate" → 把 960 推出来的
  //             宽度当成权威值提交。
  //   之后      真实宽度到达时 lastWidthRef 已非 0 → 判成 "settle" → 等 200ms。
  //
  // 于是在任何不是 960px 宽的阅读区（几乎所有屏）第一次画错，200ms 后整页跳一次。
  // 那个 "immediate" 分支本来是为「第一次真正量到」准备的，被假种子用掉了。
  //
  // 上面那几条纯函数测试抓不到这个 —— 它们测的是判断本身，不是初值的时序。
  assert.doesNotMatch(code(SHELL), /useState\(\s*\d{2,}\s*\)/,
    "shellWidth 用了一个看起来合理的假初值");
  assert.match(SHELL, /const UNMEASURED_SHELL_WIDTH = 0;/,
    "「还没量到」得用 0 表示，调用方才能据此让出 override");
  assert.match(SHELL, /useState\(UNMEASURED_SHELL_WIDTH\)/);
  // 而且调用方真的据此让出了 override，否则上面改了也没用。
  assert.match(GRID, /shellMeasured\s*\?/, "Grid 没有在「还没量到」时让出 pageWidthOverride");
  assert.match(GRID, /:\s*null;/, "让出时得传 null，不是一个兜底数字");
});
