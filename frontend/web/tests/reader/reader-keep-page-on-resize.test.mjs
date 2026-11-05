// 阅读区变宽变窄时停在同一页（packages/reader/src/hooks/use-keep-page-on-resize.ts）。
// 以前页宽一变、scrollTop 不变，Studio 里书标签从 666px 收到 476px，第 41 页跳到第 53 页。
// 现在变之前在阅读线上量「第几页、几成」，重排后放回去（scroll-to-page.ts 的 measure / apply）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyPageScrollProgress, measurePageScrollProgress } from "../../../packages/reader/src/pdf/scroll-to-page.ts";

const GAP = 16;

/** 假的滚动壳：一列同样大小的页，页高 = 页宽 × 1.4，页间空隙固定（不跟页宽缩放）。 */
function fakeShell({ pages = 89, width = 600, scrollTop = 0, hiddenSource = false } = {}) {
  const shell = {
    width,
    scrollTop,
    getBoundingClientRect: () => ({ top: 100, bottom: 960, height: 860, width: shell.width }),
    // 译文模式：原文栏也挂着同号的页，只是藏起来了（display:none，高度 0），而且排在前面。
    elements: () =>
      (hiddenSource ? ["source", "translated"] : ["translated"]).flatMap((pane) =>
        Array.from({ length: pages }, (_, index) => {
          const hidden = pane === "source";
          const height = hidden ? 0 : shell.width * 1.4;
          const top = hidden ? 0 : 100 - shell.scrollTop + index * (height + GAP);
          const page = String(index + 1);
          const attrs = { "data-reader-page": page, "data-reader-pane": pane };
          return {
            page,
            pane,
            offsetHeight: height,
            getAttribute: (name) => attrs[name] ?? null,
            getBoundingClientRect: () => ({ top, bottom: top + height, height, width: hidden ? 0 : shell.width }),
          };
        }),
      ),
    querySelectorAll: () => shell.elements(),
    querySelector: (selector) => {
      const page = /data-reader-page="(\d+)"/u.exec(selector)?.[1];
      const pane = /data-reader-pane="([^"]+)"/u.exec(selector)?.[1];
      return shell.elements().find((element) => element.page === page && (!pane || element.pane === pane)) ?? null;
    },
  };
  return shell;
}

const pageOnReadingLine = (shell) => measurePageScrollProgress(shell)?.page;

test("阅读区变窄：不管的话换成了后面的页；放回去以后还是同一页的同一处", () => {
  const pageHeight = 666 * 1.4;
  const shell = fakeShell({ width: 666, scrollTop: 40 * (pageHeight + GAP) + pageHeight / 3 });
  const before = measurePageScrollProgress(shell);
  assert.equal(before.page, 41);

  shell.width = 476; // 页宽跟着变，scrollTop 不变
  assert.ok(pageOnReadingLine(shell) > 50, "这就是那个 bug：41 → 50 多页");

  assert.ok(applyPageScrollProgress(shell, before));
  const after = measurePageScrollProgress(shell);
  assert.equal(after.page, 41);
  assert.ok(Math.abs(after.fraction - before.fraction) < 1e-6, "同一页里的位置也不变");
});

test("阅读区变宽也一样；同一位置反复放回不会越挪越远（每帧都放一次）", () => {
  const shell = fakeShell({ width: 476, scrollTop: 30 * (476 * 1.4 + GAP) + 200 });
  const before = measurePageScrollProgress(shell);
  shell.width = 900;
  applyPageScrollProgress(shell, before);
  const once = shell.scrollTop;
  applyPageScrollProgress(shell, before);
  applyPageScrollProgress(shell, before);
  assert.equal(shell.scrollTop, once);
  assert.equal(pageOnReadingLine(shell), before.page);
});

test("译文模式：藏着的原文栏有同号的页，不指定栏就放不回去；按看得见的那栏量、放", () => {
  const pageHeight = 666 * 1.4;
  const shell = fakeShell({ width: 666, scrollTop: 40 * (pageHeight + GAP), hiddenSource: true });
  const before = measurePageScrollProgress(shell, "translated");
  assert.equal(before.page, 41);
  shell.width = 476;
  assert.equal(applyPageScrollProgress(shell, before), false, "这是第二个坑：找到的是藏着的那一页");
  assert.equal(applyPageScrollProgress(shell, before, "auto", "translated"), true);
  assert.equal(measurePageScrollProgress(shell, "translated").page, 41);
});

test("阅读页接上了：页宽基准一变就钉住阅读线上的页；第一次量到宽度不算变", () => {
  const hook = readFileSync(new URL("../../../packages/reader/src/hooks/use-keep-page-on-resize.ts", import.meta.url), "utf8");
  assert.match(hook, /before === null \|\| pageWidthBasis === null/u, "null → 数（第一次量到）不动，免得和 URL 锚点抢");
  assert.match(hook, /measurePageScrollProgress\(shell, pane\)/u, "量看得见的那栏");
  assert.match(hook, /applyPageScrollProgress\(shell, progress, "auto", pane\)/u, "放回同一栏");
  assert.match(hook, /const kept = hold\.current/u, "连着来的几个宽度用最开始量的那一处");
  assert.match(hook, /"wheel", "touchstart", "keydown", "pointerdown"/u, "用户自己滚就停手");
  const grid = readFileSync(new URL("../../../packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url), "utf8");
  assert.match(grid, /useKeepPageOnResize\(shellEl, pageWidthBasis\)/u);
});

test("拖分栏不卡：每页画布单独一层（变宽变窄不重画像素）；宽度还在变时钩子不去量（停稳 READER_WIDTH_SETTLE_MS 才放回去）", () => {
  // WebKit 实测（863 页的书，iframe 600→870→600 每帧 6px）：长帧 32–46 → 4–6。以前每帧都把眼前几页的大画布重新栅格化。
  const css = readFileSync(new URL("../../../packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  // 只在宽度变的时候成层（钩子在壳上挂 reader-react-resizing）：平时成层，WebKit 里几千个文字块都要和画布做重叠判断。
  assert.doesNotMatch(/\.reader-react-pdf-page canvas \{[^}]*\}/u.exec(css)?.[0] ?? "", /will-change/u, "平时不成层");
  assert.match(/\.reader-react-resizing \.reader-react-pdf-page canvas \{[^}]*\}/u.exec(css)?.[0] ?? "", /will-change: transform;/u);
  const hook = readFileSync(new URL("../../../packages/reader/src/hooks/use-keep-page-on-resize.ts", import.meta.url), "utf8");
  assert.match(hook, /setTimeout\(\(\) => \{[\s\S]*?requestAnimationFrame\(tick\);[\s\S]*?\}, READER_WIDTH_SETTLE_MS\)/u, "停稳了才开始放回去");
});

test("拖分栏不白页：页宽一变，清画布之前把眼前这张拷下来盖着，新的画好再拿掉；没画完的不拷", () => {
  // WebKit 2 倍屏实测（iframe 900→650 停 400ms →450，对照）：整屏白的帧 5–24 → 0–2。react-pdf 的 Canvas 在 effect 里
  // 先 canvas.width = …（清空）、visibility: hidden，画完才露出来；拖着的时候一路被取消，页一直是白的。
  const slot = readFileSync(new URL("../../../packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  assert.match(slot, /useLayoutEffect\(\(\) => \{[\s\S]*?keepLastPaint\(pageBoxRef\.current, keptRef\.current\)[\s\S]*?\}, \[active, devicePixelRatio, width\]\)/u,
    "layout effect：在 react-pdf 清画布的 effect 之前");
  assert.match(slot, /onRenderSuccess=\{\(\) => \{\s*dropKeptPaint\(keptRef\.current\);/u, "新的画好就拿掉");
  assert.match(slot, /host\.firstChild\) return;/u, "已经盖着一张就接着用，不拷还没画完的");
  assert.match(slot, /canvas\.style\.visibility === "hidden"\) return;/u);
  const css = readFileSync(new URL("../../../packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  assert.match(/\.reader-react-pdf-kept-paint canvas \{[^}]*\}/u.exec(css)?.[0] ?? "", /width: 100%;[\s\S]*height: auto;/u, "按新宽度缩放");
});

test("拖分栏不跳页：钉着的时候内容一变尺寸就当场放回（画之前）；「变过」比这一轮开始时的总高", () => {
  // 以前页宽提交后要等下一帧才放回，中间画出一帧几十页之后的空白页；一次拖动里页宽提交好几回时，和最早的总高比，
  // 第二回起一开始就算「变过」，对照的行高还没变矮就停了手，停在第 50 页（本该第 41 页）。
  const hook = readFileSync(new URL("../../../packages/reader/src/hooks/use-keep-page-on-resize.ts", import.meta.url), "utf8");
  assert.match(hook, /new ResizeObserver\(\(entries\) => \{/u);
  assert.match(hook, /for \(const child of Array\.from\(shell\.children\)\) resized\?\.observe\(child\);/u);
  assert.match(hook, /resized\?\.disconnect\(\);/u, "停手时一起停");
  assert.match(hook, /looping = performance\.now\(\);\s*startHeight = shell\.scrollHeight;/u);
});

test("钉页不把主线程占满：同一个值不写 scrollTop；ResizeObserver 只看高度；位置稳了就停，不跑满两秒；宽度在变时壳上挂 reader-react-resizing", () => {
  // 作者的 RetainPDF.app 里 sample：每次换宽度后两秒主线程 95% 忙，大半在 RO 回调 → 写 scrollTop → WebKit 同步重算合成层。
  const shell = fakeShell({ width: 600, scrollTop: 10 * (600 * 1.4 + GAP) + 100 });
  const progress = measurePageScrollProgress(shell);
  let writes = 0;
  let top = shell.scrollTop;
  Object.defineProperty(shell, "scrollTop", { get: () => top, set: (value) => { writes += 1; top = value; } });
  applyPageScrollProgress(shell, progress);
  applyPageScrollProgress(shell, progress);
  assert.equal(writes, 0, "已经在那儿：不写");
  shell.width = 500;
  applyPageScrollProgress(shell, progress);
  applyPageScrollProgress(shell, progress);
  assert.equal(writes, 1, "放回去一次，之后不再写");

  const hook = readFileSync(new URL("../../../packages/reader/src/hooks/use-keep-page-on-resize.ts", import.meta.url), "utf8");
  assert.match(hook, /if \(taller\) applyPageScrollProgress/u, "只有高度变了才放回（拖的时候宽度每帧都变）");
  assert.match(hook, /stableFrames >= STABLE_FRAMES && \(height !== startHeight \|\| elapsed > QUIET_MS\)/u);
  assert.match(hook, /shell\.classList\.add\(READER_RESIZING_CLASS\)/u);
  assert.match(hook, /shell\.classList\.remove\(READER_RESIZING_CLASS\)/u);
});
