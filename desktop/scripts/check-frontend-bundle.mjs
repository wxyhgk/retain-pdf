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

assertExists("index.html");
assertExists("detail.html");
assertExists("reader.html");
assertExists("runtime-config.js");
assertExists("src/js/main.js");
assertExists("src/js/reader.js");
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

const readerHtml = readFile("reader.html");
if (!readerHtml.includes("./vendor/pdfjs-dist/web/pdf_viewer.css")) {
  fail("Desktop reader.html did not rewrite pdfjs viewer CSS to vendor path");
}

const mainJs = readFile("src/js/main.js");
if (!mainJs.includes("../../vendor/pdfjs-dist/build/pdf.mjs")) {
  fail("Desktop main.js did not rewrite pdfjs import to vendor path");
}

const readerJs = readFile("src/js/reader.js");
if (!readerJs.includes("../../vendor/pdfjs-dist/build/pdf.mjs")) {
  fail("Desktop reader.js did not rewrite pdfjs import to vendor path");
}

const generatedFiles = [
  ...collectFiles(frontendRoot, new Set([".html"])),
  ...collectFiles(path.join(frontendRoot, "src", "js"), new Set([".js", ".mjs"])),
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
