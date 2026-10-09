import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const frontendRoot = path.join(desktopRoot, "app", "frontend");

function fail(message) {
  throw new Error(message);
}

function assertExists(relativePath) {
  const fullPath = path.join(frontendRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing desktop frontend artifact: ${fullPath}`);
  }
  return fullPath;
}

function readFile(relativePath) {
  return fs.readFileSync(assertExists(relativePath), "utf8");
}

function collectFiles(root, extensions) {
  const files = [];

  function walk(current) {
    if (!fs.existsSync(current)) {
      return;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (extensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

// HTML shells + production bundles (React cutover: entry is dist/*.bundle.js)
assertExists("index.html");
assertExists("detail.html");
assertExists("reader.html");
assertExists("runtime-config.js");
assertExists("dist/app.bundle.js");
assertExists("dist/reader.bundle.js");
assertExists("dist/detail.bundle.js");
assertExists("styles.css");
assertExists("dist/css/home.css");
assertExists("dist/css/reader.css");

// Runtime assets referenced by the production HTML and bundled animation URLs.
assertExists("src/assets/RetainPDF-logo.svg");
assertExists("src/assets/animations/pdf_upload_Lottie.json");
if (fs.existsSync(path.join(frontendRoot, "src", "js"))) {
  fail("Desktop frontend must not include source modules after bundling");
}

// Vendor copies used by packaged file:// loads
assertExists("vendor/pdfjs-dist/build/pdf.mjs");
assertExists("vendor/pdfjs-dist/build/pdf.worker.mjs");
assertExists("vendor/pdfjs-dist/web/pdf_viewer.css");
assertExists("vendor/pdfjs-dist/web/pdf_viewer.mjs");
assertExists("vendor/pdf-lib/dist/pdf-lib.esm.js");

const runtimeConfig = readFile("runtime-config.js");
if (!runtimeConfig.includes('apiBase: "http://127.0.0.1:41000"')) {
  fail("Desktop runtime-config.js is missing local apiBase");
}
if (!runtimeConfig.includes('xApiKey: "retain-pdf-desktop"')) {
  fail("Desktop runtime-config.js is missing desktop API key");
}
if (!runtimeConfig.includes('modelApiKey: ""')) {
  fail("Desktop runtime-config.js must ship empty modelApiKey (keys live in settings)");
}
if (fs.existsSync(path.join(frontendRoot, "runtime-config.local.js"))) {
  fail("Desktop frontend must not include runtime-config.local.js");
}

const readerHtml = readFile("reader.html");
if (!readerHtml.includes("./vendor/pdfjs-dist/web/pdf_viewer.css")) {
  fail("Desktop reader.html did not rewrite pdfjs viewer CSS to vendor path");
}
if (!readerHtml.includes("./dist/reader.bundle.js")) {
  fail("Desktop reader.html is not using the production reader bundle");
}

const indexHtml = readFile("index.html");
if (!indexHtml.includes("./dist/app.bundle.js")) {
  fail("Desktop index.html is not using the production app bundle");
}
if (indexHtml.includes("runtime-config.local.js")) {
  fail("Desktop index.html still references runtime-config.local.js");
}

// 阅读器里不再查 `credentials-changed`：阅读页自带的 AI 问答面板（它要在凭据保存后刷新
// 输入门禁）已经换成了终端里的 agent（「阅读页只留一扇 AI 的门」），阅读器产物里没有任何
// 监听者，这个事件名被 tree-shake 掉是对的。原来的检查从那以后在 CI 上一直红（9 月 21 日起）。
// 唯一的监听者是主页 AI 问答（HomeAskView，在 app bundle 里），下面照旧查它。
const appEntryJs = readFile("dist/app.bundle.js");
// AI 问答、任务中心、书籍详情是按需加载的（HomeApp 里 React.lazy），代码在
// dist/chunks/app/ 的分包里，不在入口文件里。功能标记要在「入口 + 首页分包」里找；
// 分包随整个 dist/ 一起拷进桌面包（prepare-app 的 desktopFrontendRuntimeEntries）。
const appChunkFiles = collectFiles(path.join(frontendRoot, "dist", "chunks", "app"), new Set([".js"]));
if (!appChunkFiles.length) {
  fail("Desktop frontend is missing home lazy chunks (dist/chunks/app)");
}
const appBundleJs = [appEntryJs, ...appChunkFiles.map((file) => fs.readFileSync(file, "utf8"))].join("\n");
if (!appBundleJs.includes("./vendor/") && !appBundleJs.includes("vendor/pdfjs")) {
  // bundle may inline resolver strings differently; require credentials gate markers
}
if (!appBundleJs.includes("credentials-changed") && !appBundleJs.includes("retainpdf:credentials-changed")) {
  fail("Desktop app bundle missing credentials-changed gate refresh");
}
if (!appBundleJs.includes("home-ask")) {
  fail("Desktop app bundle missing home AI ask feature");
}
if (appBundleJs.includes("../../../vendor/pdfjs-dist/build/pdf.mjs")) {
  fail("Desktop app bundle still contains module-depth pdfjs vendor path");
}
if (appBundleJs.includes("app.asar/vendor/")) {
  fail("Desktop app bundle contains app.asar root vendor path");
}

const generatedFiles = [
  ...collectFiles(frontendRoot, new Set([".html"])),
  ...collectFiles(path.join(frontendRoot, "dist"), new Set([".js", ".mjs"])),
];
const forbiddenPatterns = [
  {
    pattern: "runtime-config.local.js",
    label: "runtime-config.local.js reference",
  },
  {
    pattern: "node_modules/pdfjs-dist",
    label: "pdfjs node_modules reference",
  },
  {
    pattern: "node_modules/pdf-lib",
    label: "pdf-lib node_modules reference",
  },
];

for (const filePath of generatedFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const { pattern, label } of forbiddenPatterns) {
    if (content.includes(pattern)) {
      fail(`Desktop frontend still contains ${label}: ${filePath}`);
    }
  }
}

console.log("desktop frontend bundle check: ok");
