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

// 阅读器的 AI 面板自 f53fb04e（启用 esbuild 代码分割）起被拆进
// dist/chunks/reader/ 的独立 chunk，`credentials-changed` 这个事件名不再出现在
// reader.bundle.js 里。原先只查主 bundle 的写法从那天起就该失败了——本地之所以
// 一直绿，是因为 desktop/app/frontend/ 里躺着一份代码分割之前的陈旧副本；CI 每次
// sync-frontend 重新拷贝，所以只在 CI 上红。
//
// 改为在主 bundle 与其 chunk 里一起找：无论将来懒加载边界怎么挪，只要这个凭据
// 门禁的刷新事件还在阅读器产物里，检查就成立。
const readerArtifacts = [
  readFile("dist/reader.bundle.js"),
  ...collectFiles(path.join(frontendRoot, "dist", "chunks", "reader"), new Set([".js"]))
    .map((file) => fs.readFileSync(file, "utf8")),
];
if (!readerArtifacts.some((source) => source.includes("credentials-changed"))) {
  fail("Desktop reader bundle (含 chunks) missing credentials-changed gate refresh");
}
const appBundleJs = readFile("dist/app.bundle.js");
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
