import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..");
const versionFile = path.join(repoRoot, "VERSION");
const frontendRoot = path.join(repoRoot, "frontend");
const backendRoot = path.join(repoRoot, "backend");
const embeddedPythonRoot = path.join(backendRoot, "python");
const typstWindowsRoot = path.join(backendRoot, "typst-win32");
const targetPlatform = process.env.RETAIN_PDF_DESKTOP_PLATFORM || process.platform;
const appRoot = path.join(desktopRoot, "app");
const outputFrontendRoot = path.join(appRoot, "frontend");
const outputBackendRoot = path.join(appRoot, "backend");
const bundledFontsRoot = path.join(outputBackendRoot, "fonts");
const desktopPackagePath = path.join(desktopRoot, "package.json");
const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, "utf8"));

const releaseVersion = fs.existsSync(versionFile)
  ? fs.readFileSync(versionFile, "utf8").trim()
  : (process.env.RETAIN_PDF_VERSION || desktopPackage.version || "").trim();

if (!releaseVersion) {
  throw new Error(
    `Missing release version in ${versionFile}; fallback sources RETAIN_PDF_VERSION/package.json are also empty`,
  );
}

function resolveRustApiBinary() {
  const overridePath = process.env.RUST_API_BINARY
    ? path.resolve(process.env.RUST_API_BINARY)
    : "";
  const candidates = [overridePath];

  if (targetPlatform === "win32") {
    candidates.push(
      path.join(
        backendRoot,
        "rust_api",
        "target",
        "i686-pc-windows-msvc",
        "release",
        "rust_api.exe",
      ),
      path.join(
        backendRoot,
        "rust_api",
        "target",
        "i686-pc-windows-gnu",
        "release",
        "rust_api.exe",
      ),
    );
  } else if (targetPlatform === "darwin") {
    candidates.push(
      path.join(backendRoot, "rust_api", "target", "release", "rust_api"),
      path.join(backendRoot, "rust_api", "target", "x86_64-apple-darwin", "release", "rust_api"),
      path.join(backendRoot, "rust_api", "target", "aarch64-apple-darwin", "release", "rust_api"),
    );
  } else {
    candidates.push(
      path.join(backendRoot, "rust_api", "target", "release", "rust_api"),
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        path: candidate,
        fileName: path.basename(candidate),
      };
    }
  }

  return {
    path: candidates[0] || "",
    fileName: targetPlatform === "win32" ? "rust_api.exe" : "rust_api",
  };
}

const rustApiBinary = resolveRustApiBinary();

if (desktopPackage.version !== releaseVersion) {
  desktopPackage.version = releaseVersion;
  fs.writeFileSync(`${desktopPackagePath}.tmp`, `${JSON.stringify(desktopPackage, null, 2)}\n`, "utf8");
  fs.renameSync(`${desktopPackagePath}.tmp`, desktopPackagePath);
}

fs.rmSync(appRoot, { recursive: true, force: true });
fs.mkdirSync(outputFrontendRoot, { recursive: true });
fs.mkdirSync(outputBackendRoot, { recursive: true });
fs.mkdirSync(bundledFontsRoot, { recursive: true });

const copyEntries = [
  ".gitignore",
  "index.html",
  "app.js",
  "styles.css",
  "runtime-config.js",
  "package.json",
  "package-lock.json",
  "tailwind.config.js",
  "src",
];

for (const entry of copyEntries) {
  const from = path.join(frontendRoot, entry);
  const to = path.join(outputFrontendRoot, entry);
  fs.cpSync(from, to, { recursive: true, force: true });
}

const desktopConstantsPath = path.join(outputFrontendRoot, "src", "js", "constants.js");
if (fs.existsSync(desktopConstantsPath)) {
  let desktopConstants = fs.readFileSync(desktopConstantsPath, "utf8");
  desktopConstants = desktopConstants.replace(
    /export const DEFAULT_WORKERS = \d+;/,
    "export const DEFAULT_WORKERS = 100;",
  );
  desktopConstants = desktopConstants.replace(
    /export const DEFAULT_COMPILE_WORKERS = \d+;/,
    "export const DEFAULT_COMPILE_WORKERS = 2;",
  );
  fs.writeFileSync(desktopConstantsPath, desktopConstants, "utf8");
}

const desktopRuntimeConfig = `window.__FRONT_RUNTIME_CONFIG__ = {
  apiBase: "http://127.0.0.1:41000",
  xApiKey: "retain-pdf-desktop",
  mineruToken: "",
  modelApiKey: "",
  model: "deepseek-chat",
  baseUrl: "https://api.deepseek.com/v1",
};
`;

fs.writeFileSync(
  path.join(outputFrontendRoot, "runtime-config.js"),
  desktopRuntimeConfig,
  "utf8",
);

const desktopIndexPath = path.join(outputFrontendRoot, "index.html");
let desktopIndexHtml = fs.readFileSync(desktopIndexPath, "utf8");
desktopIndexHtml = desktopIndexHtml.replace('\n    <script src="./runtime-config.local.js"></script>', "");
fs.writeFileSync(desktopIndexPath, desktopIndexHtml, "utf8");

fs.cpSync(path.join(backendRoot, "scripts"), path.join(outputBackendRoot, "scripts"), {
  recursive: true,
  force: true,
});

if (fs.existsSync(rustApiBinary.path)) {
  fs.mkdirSync(path.join(outputBackendRoot, "bin"), { recursive: true });
  fs.cpSync(rustApiBinary.path, path.join(outputBackendRoot, "bin", rustApiBinary.fileName), {
    force: true,
  });
}

if (targetPlatform === "win32" && fs.existsSync(path.join(embeddedPythonRoot, "python.exe"))) {
  fs.cpSync(embeddedPythonRoot, path.join(outputBackendRoot, "python"), {
    recursive: true,
    force: true,
  });
}

if (targetPlatform === "win32" && fs.existsSync(typstWindowsRoot)) {
  fs.cpSync(typstWindowsRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

const fontCandidates = [
  {
    from: "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
    to: path.join(bundledFontsRoot, "DroidSansFallbackFull.ttf"),
  },
  {
    from: "/home/wxyhgk/.local/share/fonts/source-han-serif-sc/SourceHanSerifSC-Regular.otf",
    to: path.join(bundledFontsRoot, "SourceHanSerifSC-Regular.otf"),
  },
];

for (const item of fontCandidates) {
  if (fs.existsSync(item.from)) {
    fs.cpSync(item.from, item.to, { force: true });
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  version: releaseVersion,
  targetPlatform,
  rustApiBinaryBundled: fs.existsSync(path.join(outputBackendRoot, "bin", rustApiBinary.fileName)),
  rustApiBinaryName: rustApiBinary.fileName,
  pythonBundled: fs.existsSync(path.join(outputBackendRoot, "python", "python.exe")),
  typstBundled: fs.existsSync(path.join(outputBackendRoot, "typst")),
  bundledFonts: fs.readdirSync(bundledFontsRoot).sort(),
};

fs.writeFileSync(
  path.join(outputBackendRoot, "bundle-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);
