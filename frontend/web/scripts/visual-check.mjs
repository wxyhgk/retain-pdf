#!/usr/bin/env node
// 视觉回归：每个皮肤 × 每个页面状态截一张图，和基准逐像素比。全程 mock 模式、冻结时钟、不连后端。
//
//   npm run visual:check -- --base main      # 推荐：拿 main 上提交的构建产物当基准，和当前构建比
//   npm run visual:check                     # 和本机存的基准比（tests/visual/baseline/，不进 git）
//   npm run visual:update                    # 把当前构建存成本机基准
//
// 选项：
//   --base <git 引用>   基准用这个提交里的 frontend/web（dist 是提交进仓库的，不用构建）
//   --themes a,b        只截这几个皮肤（默认全部：frontend/packages/ui/src/theme/registry.ts）
//   --states a,b        只截这几个状态（名字见下面 STATES）
//   --mobile            再加一组 390×844 的手机宽度
//   --keep              保留基准的临时目录（排查用）
//
// 先 `npm run build`：截的是 dist 里打好的包。差异图写到 tests/visual/output/（git 忽略）。
// 只有本次改动打算改样子的地方，对出来的差异才是预期的；其余任何差异都要先查清再合并。
// 2026-11-24 起替换旧版（旧版基准是 9 月的、几个状态指向早删掉的 AI 面板，跑不通）。

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = dirname(dirname(FRONTEND_ROOT));
const BASELINE_DIR = join(FRONTEND_ROOT, "tests/visual/baseline");
const OUTPUT_DIR = join(FRONTEND_ROOT, "tests/visual/output");
const FIXED_TIME = new Date("2026-11-20T10:00:00+08:00");
// 差异像素占比超过这个就算不一样。同一份代码连跑两次是 0（2026-11-24 实测 30 张），这里只留一点抗锯齿余量。
const DIFF_RATIO_THRESHOLD = 0.0005;
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const update = flag("--update");
const baseRef = option("--base");

const HIDE_CSS = `
  #mock-mode-banner { display: none !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;
const bookCard = (page) => page.locator("recent-job-card, .library-card, [data-job-id]").first();

const STATES = [
  { name: "home", url: "/index.html?mock=done", run: async () => {} },
  {
    name: "home-list",
    url: "/index.html?mock=done",
    run: async (page) => {
      await page.getByRole("radio", { name: /列表/ }).first().click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "collections",
    url: "/index.html?mock=done",
    run: async (page) => {
      await page.click("#library-top-tab-categories");
      await page.waitForTimeout(700);
    },
  },
  {
    name: "detail",
    url: "/index.html?mock=done",
    run: async (page) => {
      await bookCard(page).click();
      await page.waitForTimeout(900);
    },
  },
  {
    name: "detail-progress",
    url: "/index.html?mock=translate",
    run: async (page) => {
      await bookCard(page).click();
      await page.waitForTimeout(700);
      await page.getByRole("tab", { name: /进度/ }).first().click();
      await page.waitForTimeout(700);
    },
  },
  {
    name: "settings",
    url: "/index.html?mock=done",
    run: async (page) => {
      await page.click("[aria-label='设置']");
      await page.waitForTimeout(900);
    },
  },
  {
    name: "settings-appearance",
    url: "/index.html?mock=done",
    run: async (page) => {
      await page.click("[aria-label='设置']");
      await page.click("[data-settings-tab='appearance']");
      await page.waitForTimeout(900);
    },
  },
  {
    // 翻译中打开阅读页：mock 的实时译文按 0→2→1→3 逐页出来，等四页都到了再截，前后才能比
    name: "reader",
    url: "/index.html?mock=translate",
    reader: true,
    run: async (page) => {
      await bookCard(page).click();
      await page.waitForTimeout(700);
      await page.getByRole("tab", { name: /进度/ }).first().click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /实时译文/ }).first().click();
    },
  },
  {
    // 学习系统的白板讲解板演示页：最后一步、不放动画（?still=1），公式等 MathJax 排好
    name: "whiteboard",
    page: "whiteboard.html",
    url: "/whiteboard.html?mode=script&script=energy&step=5&still=1",
    run: async (page) => {
      await page.waitForSelector(".wb-board .wb-math svg");
      await page.waitForTimeout(300);
    },
  },
  {
    name: "whiteboard-board",
    // 无限白板：三张示例卡片（Markdown + 公式），不读本机存档
    page: "src/app/whiteboard/board-sample.ts",
    url: "/whiteboard.html?board=sample",
    run: async (page) => {
      await page.waitForSelector(".wbb-card .wbm-math svg");
      await page.waitForTimeout(300);
    },
  },
  {
    name: "whiteboard-levels",
    page: "whiteboard.html",
    url: "/whiteboard.html?mode=script&script=koopmans&step=3&still=1",
    run: async (page) => {
      await page.waitForSelector(".wb-board .wb-levels");
      await page.waitForTimeout(300);
    },
  },
];

function themeIdsFrom(registrySource) {
  const block = registrySource.slice(registrySource.indexOf("THEME_REGISTRY"));
  return [...block.matchAll(/^\s{4}id: "([a-z0-9-]+)",/gm)].map((match) => match[1]);
}

function serve(root, port) {
  return spawn("python3", ["scripts/serve_static.py", "--host", "127.0.0.1", "--port", String(port), "--root", "."], {
    cwd: root,
    stdio: "ignore",
  });
}

async function shoot(browser, port, theme, state, viewport) {
  let context = null;
  const errors = [];
  try {
    context = await browser.newContext({ viewport });
    await context.addInitScript((id) => {
      try { localStorage.setItem("retainpdf.theme", id); } catch {}
    }, theme);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install({ time: FIXED_TIME });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(`http://127.0.0.1:${port}${state.url}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: HIDE_CSS });
    await page.waitForTimeout(1200);
    await state.run(page);
    let target = page;
    if (state.reader) {
      await page.waitForTimeout(1200);
      target = context.pages()[context.pages().length - 1];
      await target.addStyleTag({ content: HIDE_CSS }).catch(() => {});
      await target.getByText(/已译 4 \/ 4 页/).first().waitFor({ timeout: 20000 }).catch(() => {});
      await target.waitForTimeout(800);
    }
    const shot = await target.screenshot();
    return { shot, error: errors[0] || "" };
  } catch (error) {
    return { shot: null, error: error.message.split("\n")[0] };
  } finally {
    await context?.close().catch(() => {});
  }
}

async function captureAll(root, port, jobs) {
  const server = serve(root, port);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  // 浏览器进程偶尔会整个退出（2026-11-24 跑 48 张时遇到过），之后每张都会报 Target closed。
  // 退出了就重启，出错的那张再截一次；仍然出错的照实算失败，不当成「跳过」。
  let browser = await chromium.launch();
  let relaunching = null;
  const live = async () => {
    if (browser.isConnected()) return browser;
    relaunching ??= chromium.launch().then((fresh) => {
      console.log("· 浏览器退出了，已重启");
      browser = fresh;
      relaunching = null;
      return fresh;
    });
    return relaunching;
  };
  const results = new Map();
  try {
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        let result = await shoot(await live(), port, job.theme, job.state, job.viewport);
        if (!result.shot) result = await shoot(await live(), port, job.theme, job.state, job.viewport);
        results.set(job.key, result);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    await browser.close().catch(() => {});
    server.kill();
  }
  return results;
}

function compare(basePng, currentPng) {
  const base = PNG.sync.read(basePng);
  const current = PNG.sync.read(currentPng);
  if (base.width !== current.width || base.height !== current.height) return { sizeChanged: true };
  const diff = new PNG({ width: base.width, height: base.height });
  const pixels = pixelmatch(base.data, current.data, diff.data, base.width, base.height, { threshold: 0.1 });
  return { ratio: pixels / (base.width * base.height), diff: PNG.sync.write(diff) };
}

// —— 要截哪些 ——
const currentThemes = themeIdsFrom(readFileSync(join(REPO_ROOT, "frontend/packages/ui/src/theme/registry.ts"), "utf8"));
const themes = option("--themes")?.split(",") ?? currentThemes;
const stateFilter = option("--states")?.split(",");
const states = stateFilter ? STATES.filter((state) => stateFilter.includes(state.name)) : STATES;
const viewports = [{ suffix: "", size: { width: 1280, height: 800 } }];
if (flag("--mobile")) viewports.push({ suffix: "@mobile", size: { width: 390, height: 844 } });
const jobs = [];
for (const theme of themes) {
  for (const state of states) {
    for (const viewport of viewports) {
      jobs.push({ key: `${theme}-${state.name}${viewport.suffix}`, theme, state, viewport: viewport.size });
    }
  }
}
rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

// —— 基准 ——
let baseShots = null;
let baseThemes = currentThemes;
let baseDir = null;
/** 新加的页面（state.page）在基准提交里还没有时不截、不比。 */
const baseHasPage = (job) => !baseDir || !job.state.page || existsSync(join(baseDir, "frontend/web", job.state.page));
if (baseRef) {
  baseDir = mkdtempSync(join(tmpdir(), "retainpdf-visual-base-"));
  // git archive 只导出文件，不建 worktree；dist、vendor、decor 都提交在仓库里，导出来就能直接起服务
  execFileSync("sh", [
    "-c",
    `git -C "$1" archive "$2" frontend/web frontend/packages/ui/src/theme/registry.ts | tar -x -C "$3"`,
    "sh", REPO_ROOT, baseRef, baseDir,
  ]);
  baseThemes = themeIdsFrom(readFileSync(join(baseDir, "frontend/packages/ui/src/theme/registry.ts"), "utf8"));
  console.log(`基准：${baseRef}`);
  baseShots = await captureAll(join(baseDir, "frontend/web"), 40171, jobs.filter((job) => baseThemes.includes(job.theme) && baseHasPage(job)));
}

// —— 当前 ——
console.log(`当前：工作区的构建产物（${jobs.length} 张）`);
const currentShots = await captureAll(FRONTEND_ROOT, 40172, jobs);

let failures = 0;
let skipped = 0;
if (update) mkdirSync(BASELINE_DIR, { recursive: true });
for (const job of jobs) {
  const current = currentShots.get(job.key);
  if (!current?.shot || current.error) {
    console.error(`✖ ${job.key}: 当前截图出错 ${current?.error || "没有截到"}`);
    failures += 1;
    continue;
  }
  if (update) {
    writeFileSync(join(BASELINE_DIR, `${job.key}.png`), current.shot);
    continue;
  }
  let basePng = null;
  if (baseShots) {
    if (!baseThemes.includes(job.theme)) {
      console.log(`· ${job.key}: 基准里没有这个皮肤（新加的），跳过`);
      skipped += 1;
      continue;
    }
    if (!baseHasPage(job)) {
      console.log(`· ${job.key}: 基准里还没有 ${job.state.page}（新加的页面），跳过`);
      skipped += 1;
      continue;
    }
    const base = baseShots.get(job.key);
    if (!base?.shot || base.error) {
      // 基准截不出来不能当作通过：照实算失败，让人去看是基准那边的问题还是脚本的问题
      console.error(`✖ ${job.key}: 基准截图出错 ${base?.error || "没有截到"}`);
      failures += 1;
      continue;
    }
    basePng = base.shot;
  } else {
    const path = join(BASELINE_DIR, `${job.key}.png`);
    if (!existsSync(path)) {
      console.log(`· ${job.key}: 没有本机基准，先跑 visual:update 或用 --base main`);
      skipped += 1;
      continue;
    }
    basePng = readFileSync(path);
  }
  const result = compare(basePng, current.shot);
  if (result.sizeChanged || result.ratio > DIFF_RATIO_THRESHOLD) {
    writeFileSync(join(OUTPUT_DIR, `${job.key}.base.png`), basePng);
    writeFileSync(join(OUTPUT_DIR, `${job.key}.current.png`), current.shot);
    if (result.diff) writeFileSync(join(OUTPUT_DIR, `${job.key}.diff.png`), result.diff);
    console.error(`✖ ${job.key}: ${result.sizeChanged ? "尺寸变了" : `差异 ${(result.ratio * 100).toFixed(3)}%`}`);
    failures += 1;
  } else {
    console.log(`✔ ${job.key}`);
  }
}

if (baseDir && !flag("--keep")) rmSync(baseDir, { recursive: true, force: true });
if (update) {
  console.log(`\n本机基准已更新：${jobs.length - failures} 张，在 tests/visual/baseline/（git 忽略）`);
} else {
  console.log(`\n${jobs.length} 张：${jobs.length - failures - skipped} 张一样，${failures} 张不一样，${skipped} 张跳过。`);
  if (failures) console.log("对比图在 tests/visual/output/（<名字>.base / .current / .diff.png）。");
}
process.exit(failures ? 1 : 0);
