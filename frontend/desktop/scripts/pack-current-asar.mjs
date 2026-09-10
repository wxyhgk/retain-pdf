import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPackage } from "@electron/asar";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");

function copyRequiredFile(stagingRoot, relativePath) {
  const source = path.join(desktopRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`missing desktop package input: ${source}`);
  }
  const destination = path.join(stagingRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

export async function packCurrentDesktopAsar(outputPath) {
  const frontendIndex = path.join(desktopRoot, "app", "frontend", "index.html");
  if (!fs.existsSync(frontendIndex)) {
    throw new Error(
      `prepared desktop frontend is missing at ${frontendIndex}; run npm --prefix frontend/desktop run sync-frontend`,
    );
  }

  const resolvedOutput = path.resolve(outputPath);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-asar-"));
  const stagingRoot = path.join(temporaryRoot, "app");
  fs.mkdirSync(stagingRoot, { recursive: true });

  try {
    for (const relativePath of ["main.js", "preload.js", "splash.html", "package.json"]) {
      copyRequiredFile(stagingRoot, relativePath);
    }
    copyRequiredFile(stagingRoot, path.join("app", "frontend"));
    copyRequiredFile(stagingRoot, path.join("src", "main"));

    const assetsRoot = path.join(desktopRoot, "assets");
    const stagedAssetsRoot = path.join(stagingRoot, "assets");
    fs.cpSync(assetsRoot, stagedAssetsRoot, {
      recursive: true,
      force: true,
      filter(sourcePath) {
        const relativePath = path.relative(assetsRoot, sourcePath);
        return !relativePath.split(path.sep).includes("fonts");
      },
    });

    fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
    await createPackage(stagingRoot, resolvedOutput);
    const sha256 = createHash("sha256").update(fs.readFileSync(resolvedOutput)).digest("hex");
    return {
      outputPath: resolvedOutput,
      sha256,
      sizeBytes: fs.statSync(resolvedOutput).size,
    };
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : "";
  if (!outputPath) {
    console.error("Usage: node pack-current-asar.mjs --output <path>");
    process.exitCode = 2;
  } else {
    const result = await packCurrentDesktopAsar(outputPath);
    console.log(
      `[desktop-asar] output=${result.outputPath} size=${result.sizeBytes} sha256=${result.sha256}`,
    );
  }
}
