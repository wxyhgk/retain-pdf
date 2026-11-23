#!/usr/bin/env node
// 用户说明书（docs/guide/）的截图：用 mock 数据打开各个页面截图，写到 docs/guide/images/<模块>/<名字>.jpg。
// 说明书按模块一页（docs/guide/<模块>.md），每张图也归到一个模块（module 就是 features/ 下的目录名）。
//   npm --prefix frontend/web run guide:screenshots           # 全部重截
//   npm --prefix frontend/web run guide:screenshots -- library # 只截模块或名字里带 library 的
// 全程 mock 模式、冻结时钟、不连后端，截不到真实的书和 Key。界面改了重跑一遍，看 diff 确认再提交。
// 先 npm run build 一次：截的是 dist 里打好的包。

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = join(FRONTEND_ROOT, "../../docs/guide/images");
const PORT = 40152;
const FIXED_TIME = new Date("2026-11-20T10:00:00+08:00");
// 截图里不要 mock 提示条和动画。
const HIDE_CSS = `
  #mock-mode-banner { display: none !important; }
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
`;

// 一个只有一页的最小 PDF，给「添加 PDF」弹窗选文件用（mock 模式不会真的上传）。
const TINY_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
  + "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

const bookCard = (page) => page.locator("recent-job-card, .library-card, [data-job-id]").first();

const openSettingsTab = async (page, tab) => {
  await page.waitForTimeout(1200);
  await page.click("[aria-label='设置']");
  await page.click(`[data-settings-tab='${tab}']`);
  await page.waitForSelector(`[data-settings-panel='${tab}']:not([hidden])`, { timeout: 10000 });
  await page.waitForTimeout(800);
};

const STATES = [
  {
    module: "library",
    name: "library",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await page.waitForTimeout(1500);
    },
  },
  {
    module: "collections",
    name: "collections",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await page.waitForTimeout(1200);
      await page.getByRole("tab", { name: "合集" }).first().click();
      await page.waitForTimeout(1000);
    },
  },
  {
    module: "credentials",
    name: "settings-api",
    url: "/index.html?mock=done",
    prepare: (page) => openSettingsTab(page, "api"),
  },
  {
    module: "glossaries",
    name: "glossaries",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await openSettingsTab(page, "glossary");
      await page.getByRole("button", { name: "打开术语表" }).first().click();
      await page.waitForTimeout(1000);
    },
  },
  {
    module: "usage",
    name: "usage",
    url: "/index.html?mock=done",
    prepare: (page) => openSettingsTab(page, "usage"),
  },
  {
    module: "sync",
    name: "sync",
    url: "/index.html?mock=done",
    prepare: (page) => openSettingsTab(page, "sync"),
  },
  {
    module: "backup",
    name: "backup",
    url: "/index.html?mock=done",
    prepare: (page) => openSettingsTab(page, "backup"),
  },
  {
    module: "settings",
    name: "appearance",
    url: "/index.html?mock=done",
    prepare: (page) => openSettingsTab(page, "appearance"),
  },
  {
    module: "ingest",
    name: "add-pdf",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await page.waitForTimeout(1200);
      await page.click("[aria-label='添加 PDF']");
      await page.waitForTimeout(600);
      await page.locator("input[type='file']").first().setInputFiles({ name: "example.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
      await page.waitForTimeout(1200);
    },
  },
  {
    module: "ingest",
    name: "add-pdf-options",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await page.waitForTimeout(1200);
      await page.click("[aria-label='添加 PDF']");
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: /更多选项/ }).first().click();
      await page.waitForTimeout(800);
    },
  },
  {
    module: "book-detail",
    name: "book-detail",
    url: "/index.html?mock=done",
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await bookCard(page).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    module: "task-center",
    name: "task-center",
    url: "/index.html?mock=parallel",
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.click("[aria-label='任务中心']");
      await page.waitForTimeout(1000);
    },
  },
];

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const states = only.length
  ? STATES.filter((state) => only.some((name) => state.module.includes(name) || state.name.includes(name)))
  : STATES;

const server = spawn(
  "python3",
  ["scripts/serve_static.py", "--host", "127.0.0.1", "--port", String(PORT), "--root", "."],
  { cwd: FRONTEND_ROOT, stdio: "ignore" },
);
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch();
let failures = 0;
try {
  for (const state of states) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await page.clock.install({ time: FIXED_TIME });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${PORT}${state.url}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: HIDE_CSS });
      await state.prepare(page);
      // 2 倍图看得清字；用 JPEG 是为了仓库里每张图不到 200KB（PNG 要 400KB 以上）。
      const dir = join(OUTPUT_DIR, state.module);
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: join(dir, `${state.name}.jpg`), type: "jpeg", quality: 85 });
      if (errors.length) throw new Error(errors[0]);
      console.log(`● ${state.module}/${state.name}`);
    } catch (error) {
      console.error(`✖ ${state.module}/${state.name}: ${error.message}`);
      failures += 1;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) process.exit(1);
