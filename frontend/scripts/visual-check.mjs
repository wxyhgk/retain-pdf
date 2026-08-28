#!/usr/bin/env node
// Đường cơ sở hồi quy trực quan:Ảnh chụp màn hình các trạng thái chính của ba trang,VÀ tests/visual/baseline so sánh。
//   node scripts/visual-check.mjs           # so sánh,Mã thoát nếu chênh lệch vượt quá ngưỡng 1,diff Ghi sơ đồ tests/visual/output
//   node scripts/visual-check.mjs --update  # Xây dựng lại đường cơ sở(Chạy sau khi xác nhận rằng các thay đổi trực quan đáp ứng mong đợi)
// Toàn bộ chuyến đi mock Kiểu mẫu、Đóng băng đồng hồ,Không có phụ thuộc back-end。Đường cơ sở được tạo cục bộ,Chỉ để so sánh bản địa。

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FRONTEND_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASELINE_DIR = join(FRONTEND_ROOT, "tests/visual/baseline");
const OUTPUT_DIR = join(FRONTEND_ROOT, "tests/visual/output");
const PORT = 40151;
const FIXED_TIME = new Date("2026-06-01T10:00:00+08:00");
const MOCK_JOB_ID = "mock-job-20260415";
// Tỷ lệ điểm ảnh vi sai cho phép(Chống răng cưa và tiếng ồn khác)
const DIFF_RATIO_THRESHOLD = 0.001;

const STATES = [
  {
    name: "home",
    url: `/index.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "detail",
    url: `/detail.html?mock=succeeded&job_id=${MOCK_JOB_ID}`,
    prepare: async (page) => {
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "reader-compare",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Các phần mở rộng cột bên phải sẽ kích hoạt theo mặc định PDF Sắp xếp lại Zoom,Cho phép đủ thời gian để thu phóng và sau đó chụp ảnh màn hình(nếu không thì.  PDF Text Subpixel Jitter)
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "reader-ai-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Bộ xương ba cột:Cột bên phải(AI vấn đáp)Mở rộng mặc định,Không cần nhấp chuột nữa
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
      // Đang chờ kích hoạt mở rộng cột bên phải PDF Đã thiết lập lại thu phóng,Tránh hiện tượng rung điểm ảnh phụ
      await page.waitForTimeout(1800);
    },
  },
  {
    name: "status-dialog-failed",
    url: `/index.html?mock=failed`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#status-detail-btn");
      await page.waitForTimeout(800);
    },
  },
  {
    name: "detail-page-failed",
    url: `/detail.html?mock=failed&job_id=${MOCK_JOB_ID}`,
    prepare: async (page) => {
      await page.waitForTimeout(1200);
    },
  },
  {
    name: "reader-markdown-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.click("#reader-markdown-toggle-btn");
      await page.waitForSelector("#reader-markdown-content:not(.hidden)", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "reader-dialog-embedded",
    diffThreshold: 0.008,
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#reader-btn");
      const frameElement = await page.waitForSelector("iframe[src*='reader.html']", { timeout: 10000 });
      const frame = await frameElement.contentFrame();
      await frame.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "reader-ai-answer",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      // Mở rộng mặc định cột bên phải,Đặt câu hỏi trực tiếp(Không nhấp vào nút bật/tắt một lần nữa)
      await page.waitForSelector("#reader-ai-drawer.is-open", { timeout: 10000 });
      await page.fill("#reader-ai-input", "共轭如何影响选择性?");
      await page.click("#reader-ai-submit-btn");
      await page.waitForSelector(".reader-ai-citation-item", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "reader-annotations-open",
    diffThreshold: 0.008,
    url: `/reader.html?mock=succeeded`,
    prepare: async (page) => {
      await page.waitForSelector("#reader-boot-loading.hidden", { state: "attached", timeout: 20000 });
      await page.click("#reader-annotations-toggle-btn");
      await page.waitForSelector(".reader-annotations-item", { timeout: 10000 });
      await page.waitForTimeout(600);
    },
  },
  {
    name: "library-search-island",
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.fill("#library-search-input", "化学");
      await page.waitForSelector(".lib-search-panel", { timeout: 8000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: "status-dialog-translation",
    url: `/index.html?mock=done`,
    prepare: async (page) => {
      await page.waitForTimeout(1500);
      await page.locator("recent-job-card, .library-card, [data-job-id]").first().click();
      await page.waitForTimeout(1000);
      await page.click("#status-detail-btn");
      await page.waitForTimeout(600);
      await page.click("#detail-tab-translation");
      await page.waitForTimeout(900);
    },
  },
];

const update = process.argv.includes("--update");
mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const server = spawn(
  "python3",
  ["scripts/serve_static.py", "--host", "127.0.0.1", "--port", String(PORT), "--root", "."],
  { cwd: FRONTEND_ROOT, stdio: "ignore" },
);
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch();
let failures = 0;
try {
  for (const state of STATES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.clock.install({ time: FIXED_TIME });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${PORT}${state.url}`, { waitUntil: "networkidle" });
    await state.prepare(page);
    const shot = await page.screenshot();
    await page.close();

    if (consoleErrors.length) {
      console.error(`✖ ${state.name}: 页面异常 ${consoleErrors[0]}`);
      failures += 1;
      continue;
    }

    const baselinePath = join(BASELINE_DIR, `${state.name}.png`);
    if (update || !existsSync(baselinePath)) {
      writeFileSync(baselinePath, shot);
      console.log(`● ${state.name}: 基线已${update ? "更新" : "创建"}`);
      continue;
    }

    const baseline = PNG.sync.read(readFileSync(baselinePath));
    const current = PNG.sync.read(shot);
    if (baseline.width !== current.width || baseline.height !== current.height) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
      console.error(`✖ ${state.name}: 尺寸变化 ${baseline.width}x${baseline.height} -> ${current.width}x${current.height}`);
      failures += 1;
      continue;
    }
    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const diffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
      threshold: 0.15,
    });
    const ratio = diffPixels / (baseline.width * baseline.height);
    // Một số lượng nhỏ PDF Canvas làm trạng thái cơ thể,pdf.js Kết xuất văn bản có run-to-run Chống răng cưa subpixel
    // (Bản thân bố cục là điểm ảnh nhất quán,thấy diff),Nới lỏng ngưỡng để hấp thụ tiếng ồn;Trạng thái còn lại vẫn nghiêm ngặt 0.1%。
    const stateThreshold = state.diffThreshold ?? DIFF_RATIO_THRESHOLD;
    if (ratio > stateThreshold) {
      writeFileSync(join(OUTPUT_DIR, `${state.name}.current.png`), shot);
      writeFileSync(join(OUTPUT_DIR, `${state.name}.diff.png`), PNG.sync.write(diff));
      console.error(`✖ ${state.name}: 差异 ${(ratio * 100).toFixed(2)}%(${diffPixels}px),diff 见 tests/visual/output/`);
      failures += 1;
    } else {
      console.log(`✔ ${state.name}: 一致(差异 ${(ratio * 100).toFixed(3)}%)`);
    }
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) {
  console.error(`\n${failures} 个状态与基线不一致。确认改动符合预期后运行: npm run visual:update`);
  process.exit(1);
}
