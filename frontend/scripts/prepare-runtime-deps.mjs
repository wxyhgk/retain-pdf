import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const nodeModulesRoot = path.join(frontendRoot, "node_modules");
const vendorRoot = path.join(frontendRoot, "vendor");

function ensureDependencyRoot(packageName) {
  const packageRoot = path.join(nodeModulesRoot, packageName);
  if (!fs.existsSync(packageRoot)) {
    throw new Error(`Missing frontend runtime dependency: ${packageRoot}`);
  }
  return packageRoot;
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

copyPackageAssets("pdf-lib", [
  "dist/pdf-lib.esm.js",
]);

copyPackageAssets("pdfjs-dist", [
  "build/pdf.mjs",
  "build/pdf.worker.mjs",
  "cmaps",
  "standard_fonts",
  "web/images",
  "web/pdf_viewer.css",
  "web/pdf_viewer.mjs",
]);

copyPackageAssets("lottie-web", [
  "build/player/lottie.min.js",
]);

console.log("frontend runtime deps prepared");
