#!/usr/bin/env node
// 用户说明书（frontend/web/guide/）的截图和操作动画：用 mock 数据打开页面，写到 guide/images/<模块>/。
//   - 截图 STATES → <名字>.jpg（2 倍图）
//   - 动画 CLIPS → <名字>.webp：录一段操作（画上鼠标和点击的波纹），转成循环播放的动态 WebP
//   - 图标 ICONS → guide/icons/<名字>.svg：从软件用的同一套图标（lucide）生成，正文里写 ![＋](icons/plus.svg)
// 说明书按模块一页（guide/<模块>.md），每张图也归到一个模块（module 就是 features/ 下的目录名）。
//   npm --prefix frontend/web run guide:media           # 全部重做
//   npm --prefix frontend/web run guide:media -- ingest # 只做模块或名字里带 ingest 的
// 全程 mock 模式、不连后端，截不到真实的书和 Key。界面改了重跑一遍，看 diff 确认再提交。
// 先 npm run build 一次：截的是 dist 里打好的包。动画要本机有 ffmpeg 和 img2webp（brew install ffmpeg webp）。

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = join(FRONTEND_ROOT, "guide/images");
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


// —— 操作动画 ——
// 录的时候画一个鼠标、点下去出一圈波纹，看得出点了哪里。窗口开小一点，缩成 GIF 宽度时字还看得清。
const CLIP_VIEWPORT = { width: 1100, height: 700 };
const CLIP_WIDTH = 880;
const CURSOR_SCRIPT = `(() => {
  const style = document.createElement("style");
  style.textContent = [
    "#mock-mode-banner{display:none!important}",
    ".guide-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-2px 0 0 -2px;pointer-events:none;background:no-repeat url(\\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M4 3l7 17 2.5-7.5L21 10z' fill='black' stroke='white' stroke-width='1.6' stroke-linejoin='round'/></svg>\\")}",
    ".guide-ripple{position:fixed;z-index:2147483646;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(37,99,235,.35);pointer-events:none;animation:guide-ripple .5s ease-out forwards}",
    "@keyframes guide-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}",
  ].join("");
  const install = () => {
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.className = "guide-cursor";
    cursor.style.left = "550px";
    cursor.style.top = "420px";
    document.body.appendChild(cursor);
    addEventListener("mousemove", (event) => { cursor.style.left = event.clientX + "px"; cursor.style.top = event.clientY + "px"; }, true);
    addEventListener("mousedown", (event) => {
      const ripple = document.createElement("div");
      ripple.className = "guide-ripple";
      ripple.style.left = event.clientX + "px";
      ripple.style.top = event.clientY + "px";
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install); else install();
})();`;

/** 鼠标慢慢移到元素中间。 */
async function moveTo(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`找不到要指的元素：${locator}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await page.waitForTimeout(250);
}

/** 移过去、点一下、停一会儿让人看清结果。 */
async function clickOn(page, locator, pause = 700) {
  await moveTo(page, locator);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(pause);
}

const CLIPS = [
  {
    module: "ingest",
    name: "add-pdf",
    url: "/index.html?mock=done",
    run: async (page) => {
      await page.waitForTimeout(1000);
      await clickOn(page, page.locator("[aria-label='添加 PDF']"));
      await moveTo(page, page.locator("#upload-fill"));
      await page.locator("input[type='file']").first().setInputFiles({ name: "论文.pdf", mimeType: "application/pdf", buffer: TINY_PDF });
      await page.waitForTimeout(1200);
      await moveTo(page, page.locator("[data-engine='agent']").first());
      await moveTo(page, page.getByRole("button", { name: /直接翻译/ }).first());
      await page.waitForTimeout(800);
    },
  },
  {
    module: "book-detail",
    name: "translate-progress",
    url: "/index.html?mock=demo",
    run: async (page) => {
      await page.waitForTimeout(1000);
      // 演示数据里第二本是只收藏、没翻译的「存档」书。
      await clickOn(page, page.locator("recent-job-card, .library-card, [data-job-id]").nth(1), 1200);
      await clickOn(page, page.getByRole("tab", { name: /进度/ }).first());
      await clickOn(page, page.getByRole("button", { name: /翻译整本/ }).first(), 5500);
    },
  },
];

/** 录一段动画：录屏 → 抽帧 → img2webp 拼成循环播放的动态 WebP。 */
async function recordClip(browser, clip) {
  const workDir = mkdtempSync(join(tmpdir(), "guide-clip-"));
  try {
    const context = await browser.newContext({ viewport: CLIP_VIEWPORT, recordVideo: { dir: workDir, size: CLIP_VIEWPORT } });
    await context.addInitScript(CURSOR_SCRIPT);
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`http://127.0.0.1:${PORT}${clip.url}`, { waitUntil: "networkidle" });
    await clip.run(page);
    await context.close();
    const video = readdirSync(workDir).find((name) => name.endsWith(".webm"));
    const frames = join(workDir, "frames");
    mkdirSync(frames);
    execFileSync("ffmpeg", ["-loglevel", "error", "-i", join(workDir, video), "-vf", `fps=8,scale=${CLIP_WIDTH}:-1:flags=lanczos`, join(frames, "f%04d.png")]);
    const files = readdirSync(frames).sort().map((name) => join(frames, name));
    // GUIDE_MEDIA_FRAMES=<目录>：把抽出来的帧留一份，方便逐帧看动画录得对不对。
    if (process.env.GUIDE_MEDIA_FRAMES) {
      const keep = join(process.env.GUIDE_MEDIA_FRAMES, `${clip.module}-${clip.name}`);
      rmSync(keep, { recursive: true, force: true });
      mkdirSync(keep, { recursive: true });
      for (const file of files) execFileSync("cp", [file, keep]);
    }
    const dir = join(OUTPUT_DIR, clip.module);
    mkdirSync(dir, { recursive: true });
    // 每秒 8 帧；-mixed 每帧自己挑有损还是无损（界面颜色平，纯有损会压出色块）。一段 10 秒左右 250–450KB；最后一帧多停 2 秒再从头放。
    const args = ["-loop", "0", "-mixed", "-q", "80", "-m", "6", "-d", "125"];
    files.forEach((file, index) => {
      if (index === files.length - 1) args.push("-d", "2000");
      args.push(file);
    });
    execFileSync("img2webp", [...args, "-o", join(dir, `${clip.name}.webp`)], { stdio: "ignore" });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}


// —— 图标 ——
// 说明书正文里用的小图标，和软件界面用同一套（lucide-react，软件里的版本）。名字 → lucide 图标名。
// 灰色描边，浅色、深色主题下都看得见。
const ICONS = {
  plus: "plus",
  "task-center": "activity",
  help: "circle-help",
  settings: "settings",
  search: "search",
  translate: "languages",
  options: "sliders-horizontal",
  "read-compare": "book-open",
  "read-original": "eye",
  download: "download",
  redo: "rotate-cw",
  agent: "bot",
  ocr: "scan-text",
  upload: "file-up",
  close: "x",
  batch: "list-checks",
  collections: "layers",
  library: "library-big",
  sync: "refresh-cw",
  backup: "archive",
  notify: "bell",
  "lan-share": "wifi",
  appearance: "palette",
  terminal: "square-terminal",
  glossary: "book-a",
  usage: "chart-column",
  key: "key-round",
  copy: "copy",
  qr: "qr-code",
  bookmark: "bookmark",
  edit: "pencil",
  folder: "folder-open",
  filter: "filter",
  sort: "arrow-up-down",
  grid: "layout-grid",
};

/** lucide 的图标数据。有的名字是别名（circle-help → circle-question-mark），那个文件只转出 default，顺着找到本体。 */
async function lucideIconNode(name) {
  const file = join(FRONTEND_ROOT, "node_modules/lucide-react/dist/esm/icons", `${name}.mjs`);
  const module = await import(pathToFileURL(file).href);
  if (module.__iconNode) return module.__iconNode;
  const alias = /from '\.\/([\w-]+)\.mjs'/.exec(readFileSync(file, "utf8"));
  if (!alias) throw new Error(`lucide 图标 ${name} 读不出数据`);
  return lucideIconNode(alias[1]);
}

async function writeIcons() {
  const dir = join(FRONTEND_ROOT, "guide/icons");
  mkdirSync(dir, { recursive: true });
  for (const [name, lucide] of Object.entries(ICONS)) {
    const __iconNode = await lucideIconNode(lucide);
    const body = __iconNode
      .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== "key").map(([key, value]) => `${key}="${value}"`).join(" ")}/>`)
      .join("");
    writeFileSync(
      join(dir, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`,
    );
  }
  console.log(`● icons ×${Object.keys(ICONS).length}`);
}

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const pick = (list) => (only.length ? list.filter((item) => only.some((name) => item.module.includes(name) || item.name.includes(name))) : list);
const states = pick(STATES);
const clips = pick(CLIPS);
if (!only.length || only.includes("icons")) await writeIcons();

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
  for (const clip of clips) {
    try {
      await recordClip(browser, clip);
      console.log(`● ${clip.module}/${clip.name}.webp`);
    } catch (error) {
      console.error(`✖ ${clip.module}/${clip.name}.webp: ${error.message}`);
      failures += 1;
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) process.exit(1);
