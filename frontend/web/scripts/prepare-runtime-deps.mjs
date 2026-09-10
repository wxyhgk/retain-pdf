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

console.log("frontend runtime deps prepared");
