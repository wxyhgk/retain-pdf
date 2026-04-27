import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
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
const typstDarwinRoot = path.join(backendRoot, "typst-darwin");
const typstLinuxRoot = path.join(backendRoot, "typst-linux");
const typstPackagesRoot = path.join(backendRoot, "typst-packages");
const targetPlatform = process.env.RETAIN_PDF_DESKTOP_PLATFORM || process.platform;
const allowBundledMacPython = process.env.RETAIN_PDF_BUNDLE_MAC_PYTHON === "1";
const skipBundledRuntimeVerification = process.env.RETAIN_PDF_SKIP_BUNDLED_RUNTIME_VERIFICATION === "1";
const frontendOnly = process.argv.includes("--frontend-only");
const appRoot = path.join(desktopRoot, "app");
const outputFrontendRoot = path.join(appRoot, "frontend");
const outputBackendRoot = path.join(appRoot, "backend");
const outputFrontendVendorRoot = path.join(outputFrontendRoot, "vendor");
const bundledFontsRoot = path.join(outputBackendRoot, "fonts");
const bundledFontAssetsRoot = path.join(desktopRoot, "assets", "fonts");
const buildRoot = path.join(desktopRoot, "build");
const linuxIconsRoot = path.join(buildRoot, "icons");
const desktopIconSource = path.join(desktopRoot, "assets", "RetainPDF-logo.png");
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
    candidates.push(path.join(backendRoot, "rust_api", "target", "release", "rust_api"));
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

function hasBundledPosixPython(root) {
  return fs.existsSync(path.join(root, "bin", "python3"))
    || fs.existsSync(path.join(root, "bin", "python"));
}

function resolveBundledPythonCommand(root) {
  const candidates = targetPlatform === "win32"
    ? [path.join(root, "python.exe")]
    : [
        path.join(root, "bin", "python3"),
        path.join(root, "bin", "python"),
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function bundledPythonSitePackages(root) {
  if (!root || !fs.existsSync(root)) {
    return [];
  }
  if (targetPlatform === "win32") {
    const sitePackages = path.join(root, "Lib", "site-packages");
    return fs.existsSync(sitePackages) ? [sitePackages] : [];
  }
  const libRoot = path.join(root, "lib");
  if (!fs.existsSync(libRoot)) {
    return [];
  }
  const matches = [];
  for (const entry of fs.readdirSync(libRoot)) {
    if (!/^python\d+\.\d+$/.test(entry)) {
      continue;
    }
    const sitePackages = path.join(libRoot, entry, "site-packages");
    if (fs.existsSync(sitePackages)) {
      matches.push(sitePackages);
    }
  }
  return matches;
}

function verifyBundledPythonRuntime(root) {
  const pythonCommand = resolveBundledPythonCommand(root);
  if (!pythonCommand) {
    throw new Error(`Bundled Python runtime missing executable under ${root}`);
  }
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONPATH: bundledPythonSitePackages(root).join(path.delimiter),
  };
  const probe = spawnSync(
    pythonCommand,
    [
      "-c",
      [
        "import fitz, requests, pikepdf, PIL, urllib3",
        "print('python_bundle_import_check=ok')",
      ].join("; "),
    ],
    {
      env,
      encoding: "utf8",
    },
  );
  if (probe.status !== 0) {
    const detail = [probe.stdout, probe.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Bundled Python runtime import check failed: ${detail || "unknown error"}`);
  }
  return {
    pythonCommand,
    sitePackages: bundledPythonSitePackages(root),
    importCheck: probe.stdout.trim() || "python_bundle_import_check=ok",
  };
}

const rustApiBinary = resolveRustApiBinary();
if (desktopPackage.version !== releaseVersion) {
  desktopPackage.version = releaseVersion;
  fs.writeFileSync(`${desktopPackagePath}.tmp`, `${JSON.stringify(desktopPackage, null, 2)}\n`, "utf8");
  fs.renameSync(`${desktopPackagePath}.tmp`, desktopPackagePath);
}

fs.mkdirSync(buildRoot, { recursive: true });
fs.rmSync(linuxIconsRoot, { recursive: true, force: true });
fs.mkdirSync(linuxIconsRoot, { recursive: true });
if (fs.existsSync(desktopIconSource)) {
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
    fs.cpSync(desktopIconSource, path.join(linuxIconsRoot, `${size}x${size}.png`), { force: true });
  }
}

if (frontendOnly) {
  fs.rmSync(outputFrontendRoot, { recursive: true, force: true });
  fs.mkdirSync(appRoot, { recursive: true });
  fs.mkdirSync(outputFrontendRoot, { recursive: true });
  fs.mkdirSync(outputFrontendVendorRoot, { recursive: true });
} else {
  fs.rmSync(appRoot, { recursive: true, force: true });
  fs.mkdirSync(outputFrontendRoot, { recursive: true });
  fs.mkdirSync(outputFrontendVendorRoot, { recursive: true });
  fs.mkdirSync(outputBackendRoot, { recursive: true });
  fs.mkdirSync(bundledFontsRoot, { recursive: true });
}

const excludedFrontendEntries = new Set([
  "node_modules",
  "runtime-config.local.js",
  ".codex",
  ".ipynb_checkpoints",
]);

function shouldExcludeFrontendPath(sourcePath) {
  const relativePath = path.relative(frontendRoot, sourcePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return false;
  }
  const parts = relativePath.split(path.sep).filter(Boolean);
  return parts.some((part) => excludedFrontendEntries.has(part));
}

for (const entry of fs.readdirSync(frontendRoot, { withFileTypes: true })) {
  const from = path.join(frontendRoot, entry.name);
  const to = path.join(outputFrontendRoot, entry.name);
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    filter: (sourcePath) => !shouldExcludeFrontendPath(sourcePath),
  });
}

function copyFrontendRuntimeDependency(packageName, entries, targetDirName = packageName) {
  const candidateRoots = [
    path.join(frontendRoot, "node_modules", packageName),
    path.join(outputFrontendRoot, "node_modules", packageName),
    path.join(desktopRoot, "node_modules", packageName),
  ];
  const packageRoot = candidateRoots.find((candidate) => fs.existsSync(candidate));
  if (!packageRoot) {
    throw new Error(
      `Missing frontend runtime dependency: ${candidateRoots.join(" | ")}`,
    );
  }
  const targetRoot = path.join(outputFrontendVendorRoot, targetDirName);
  for (const entry of entries) {
    const from = path.join(packageRoot, entry);
    if (!fs.existsSync(from)) {
      throw new Error(`Missing frontend runtime dependency asset: ${from}`);
    }
    fs.cpSync(from, path.join(targetRoot, entry), { recursive: true, force: true });
  }
}

copyFrontendRuntimeDependency("pdf-lib", [
  "dist/pdf-lib.esm.js",
]);

copyFrontendRuntimeDependency("pdfjs-dist", [
  "build/pdf.mjs",
  "build/pdf.worker.mjs",
  "cmaps",
  "standard_fonts",
  "web/images",
  "web/pdf_viewer.css",
  "web/pdf_viewer.mjs",
]);

function rewriteDesktopFrontendRuntimeImports() {
  for (const entry of fs.readdirSync(outputFrontendRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) {
      continue;
    }
    const htmlPath = path.join(outputFrontendRoot, entry.name);
    let html = fs.readFileSync(htmlPath, "utf8");
    html = html.replace('\n    <script src="./runtime-config.local.js"></script>', "");
    if (entry.name === "reader.html") {
      html = html.replaceAll(
        "./node_modules/pdfjs-dist/web/pdf_viewer.css",
        "./vendor/pdfjs-dist/web/pdf_viewer.css",
      );
    }
    fs.writeFileSync(htmlPath, html, "utf8");
  }

  const readerJsPath = path.join(outputFrontendRoot, "src", "js", "reader.js");
  if (fs.existsSync(readerJsPath)) {
    let readerJs = fs.readFileSync(readerJsPath, "utf8");
    readerJs = readerJs.replaceAll(
      "../../node_modules/pdfjs-dist/",
      "../../vendor/pdfjs-dist/",
    );
    fs.writeFileSync(readerJsPath, readerJs, "utf8");
  }

  const mainJsPath = path.join(outputFrontendRoot, "src", "js", "main.js");
  if (fs.existsSync(mainJsPath)) {
    let mainJs = fs.readFileSync(mainJsPath, "utf8");
    mainJs = mainJs.replaceAll(
      "../../node_modules/pdfjs-dist/",
      "../../vendor/pdfjs-dist/",
    );
    fs.writeFileSync(mainJsPath, mainJs, "utf8");
  }

  const readerDialogControllerPath = path.join(
    outputFrontendRoot,
    "src",
    "js",
    "features",
    "reader-dialog",
    "controller.js",
  );
  if (fs.existsSync(readerDialogControllerPath)) {
    let controllerJs = fs.readFileSync(readerDialogControllerPath, "utf8");
    controllerJs = controllerJs.replaceAll(
      "../../../../node_modules/pdf-lib/",
      "../../../../vendor/pdf-lib/",
    );
    fs.writeFileSync(readerDialogControllerPath, controllerJs, "utf8");
  }
}

rewriteDesktopFrontendRuntimeImports();

const desktopPartialsRoot = path.join(outputFrontendRoot, "src", "partials");
const desktopTemplatesPath = path.join(outputFrontendRoot, "src", "js", "templates.js");
const desktopMainContent = fs.readFileSync(
  path.join(desktopPartialsRoot, "main-content.html"),
  "utf8",
);
const desktopDialogs = fs.readFileSync(
  path.join(desktopPartialsRoot, "dialogs.html"),
  "utf8",
);
const desktopTemplatesSource = `const MAIN_CONTENT_HTML = ${JSON.stringify(desktopMainContent)};
const DIALOGS_HTML = ${JSON.stringify(desktopDialogs)};

export async function renderPageShell() {
  document.body.innerHTML = MAIN_CONTENT_HTML + DIALOGS_HTML;
}
`;

fs.writeFileSync(desktopTemplatesPath, desktopTemplatesSource, "utf8");

const desktopConstantsPath = path.join(outputFrontendRoot, "src", "js", "constants.js");
if (fs.existsSync(desktopConstantsPath)) {
  let desktopConstants = fs.readFileSync(desktopConstantsPath, "utf8");
  desktopConstants = desktopConstants.replace(
    /export const DEFAULT_WORKERS = \d+;/,
    "export const DEFAULT_WORKERS = 100;",
  );
  fs.writeFileSync(desktopConstantsPath, desktopConstants, "utf8");
}

const desktopRuntimeConfig = `window.__FRONT_RUNTIME_CONFIG__ = {
  apiBase: "http://127.0.0.1:41000",
  xApiKey: "retain-pdf-desktop",
  ocrProvider: "paddle",
  mineruToken: "",
  paddleToken: "",
  modelApiKey: "",
  model: "deepseek-v4-flash",
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

if (!frontendOnly) {
  fs.cpSync(path.join(backendRoot, "scripts"), path.join(outputBackendRoot, "scripts"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && fs.existsSync(rustApiBinary.path)) {
  fs.mkdirSync(path.join(outputBackendRoot, "bin"), { recursive: true });
  fs.cpSync(rustApiBinary.path, path.join(outputBackendRoot, "bin", rustApiBinary.fileName), {
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "win32" && fs.existsSync(path.join(embeddedPythonRoot, "python.exe"))) {
  fs.cpSync(embeddedPythonRoot, path.join(outputBackendRoot, "python"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "linux" && hasBundledPosixPython(embeddedPythonRoot)) {
  fs.cpSync(embeddedPythonRoot, path.join(outputBackendRoot, "python"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "darwin" && hasBundledPosixPython(embeddedPythonRoot)) {
  if (allowBundledMacPython) {
    fs.cpSync(embeddedPythonRoot, path.join(outputBackendRoot, "python"), {
      recursive: true,
      force: true,
    });
  } else {
    console.warn(
      "[prepare-app] skip bundling backend/python for darwin because RETAIN_PDF_BUNDLE_MAC_PYTHON!=1",
    );
  }
}

const outputPythonRoot = path.join(outputBackendRoot, "python");
const pythonBundled = fs.existsSync(path.join(outputPythonRoot, "python.exe"))
  || fs.existsSync(path.join(outputPythonRoot, "bin", "python3"))
  || fs.existsSync(path.join(outputPythonRoot, "bin", "python"));
const bundledPythonRequired = targetPlatform === "win32"
  || targetPlatform === "linux"
  || (targetPlatform === "darwin" && allowBundledMacPython);
let bundledPythonDiagnostics = null;
if (!frontendOnly && bundledPythonRequired && !pythonBundled) {
  throw new Error(`Bundled Python runtime is required for ${targetPlatform} packaging but was not copied to ${outputPythonRoot}`);
}
if (!frontendOnly && pythonBundled && !skipBundledRuntimeVerification) {
  bundledPythonDiagnostics = verifyBundledPythonRuntime(outputPythonRoot);
}

if (!frontendOnly && targetPlatform === "win32" && fs.existsSync(typstWindowsRoot)) {
  fs.cpSync(typstWindowsRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "darwin" && fs.existsSync(typstDarwinRoot)) {
  fs.cpSync(typstDarwinRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "linux" && fs.existsSync(typstLinuxRoot)) {
  fs.cpSync(typstLinuxRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && fs.existsSync(typstPackagesRoot)) {
  fs.cpSync(typstPackagesRoot, path.join(outputBackendRoot, "typst-packages"), {
    recursive: true,
    force: true,
  });
}

if (!frontendOnly && fs.existsSync(bundledFontAssetsRoot)) {
  for (const entry of fs.readdirSync(bundledFontAssetsRoot)) {
    const from = path.join(bundledFontAssetsRoot, entry);
    const to = path.join(bundledFontsRoot, entry);
    if (fs.statSync(from).isFile()) {
      fs.cpSync(from, to, { force: true });
    }
  }
}

const requiredBundledFonts = [
  "DroidSansFallbackFull.ttf",
  "SourceHanSerifSC-Regular.otf",
  "SourceHanSerifSC-Bold.otf",
];
if (!frontendOnly) {
  for (const fileName of requiredBundledFonts) {
    const expectedPath = path.join(bundledFontsRoot, fileName);
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`Missing bundled font asset: ${expectedPath}`);
    }
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  version: releaseVersion,
  targetPlatform,
  rustApiBinaryBundled: fs.existsSync(path.join(outputBackendRoot, "bin", rustApiBinary.fileName)),
  rustApiBinaryName: rustApiBinary.fileName,
  pythonBundled,
  bundledPythonExecutable: bundledPythonDiagnostics ? path.relative(outputBackendRoot, bundledPythonDiagnostics.pythonCommand) : null,
  bundledPythonSitePackages: bundledPythonDiagnostics
    ? bundledPythonDiagnostics.sitePackages.map((entry) => path.relative(outputBackendRoot, entry))
    : [],
  bundledPythonImportCheck: bundledPythonDiagnostics ? bundledPythonDiagnostics.importCheck : null,
  typstBundled: fs.existsSync(path.join(outputBackendRoot, "typst")),
  typstPackagesBundled: fs.existsSync(path.join(outputBackendRoot, "typst-packages")),
  bundledFonts: fs.readdirSync(bundledFontsRoot).sort(),
};

fs.writeFileSync(
  path.join(outputBackendRoot, "bundle-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);
