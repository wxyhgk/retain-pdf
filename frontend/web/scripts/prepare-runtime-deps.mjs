import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const vendorRoot = path.join(frontendRoot, "vendor");
const require = createRequire(import.meta.url);

function ensureDependencyRoot(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    throw new Error(`Missing frontend runtime dependency: ${packageName}`, {
      cause: error,
    });
  }
}

function copyPackageAssets(packageName, entries, targetDirName = packageName) {
  const packageRoot = ensureDependencyRoot(packageName);
  const targetRoot = path.join(vendorRoot, targetDirName);
  for (const entry of entries) {
    const from = path.join(packageRoot, entry);
    if (!fs.existsSync(from)) {
      throw new Error(`Missing frontend runtime dependency asset: ${from}`);
    }
    fs.cpSync(from, path.join(targetRoot, entry), { recursive: true, force: true });
  }
}

fs.mkdirSync(vendorRoot, { recursive: true });

copyPackageAssets("pdfjs-dist", [
  "build/pdf.mjs",
  "build/pdf.worker.mjs",
  "cmaps",
  "standard_fonts",
  "web/images",
  "web/pdf_viewer.css",
  "web/pdf_viewer.mjs",
]);

copyPackageAssets("pdf-lib", [
  "dist/pdf-lib.esm.js",
]);

copyPackageAssets("lottie-web", [
  "build/player/lottie.min.js",
]);

copyPackageAssets("marked", [
  "lib/marked.esm.js",
]);

// 阅读页提问窗的公式（streamdown + KaTeX）：样式和字体按需加载，桌面版离线也要能用。
// 只拷 woff2（katex.min.css 里 woff2 排第一，现在的浏览器、Electron 都用它，woff / ttf 用不到）。
{
  const katexRoot = ensureDependencyRoot("katex");
  const target = path.join(vendorRoot, "katex");
  fs.mkdirSync(path.join(target, "fonts"), { recursive: true });
  fs.copyFileSync(path.join(katexRoot, "dist/katex.min.css"), path.join(target, "katex.min.css"));
  for (const name of fs.readdirSync(path.join(katexRoot, "dist/fonts"))) {
    if (name.endsWith(".woff2")) fs.copyFileSync(path.join(katexRoot, "dist/fonts", name), path.join(target, "fonts", name));
  }
}

console.log("frontend runtime deps prepared");
