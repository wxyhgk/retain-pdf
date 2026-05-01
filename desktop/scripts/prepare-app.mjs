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
const desktopSrcRoot = path.join(desktopRoot, "src");
const desktopRuntimeRoot = path.join(desktopSrcRoot, "runtime");
const targetPlatform = process.env.RETAIN_PDF_DESKTOP_PLATFORM || process.platform;
const allowBundledMacPython = process.env.RETAIN_PDF_BUNDLE_MAC_PYTHON === "1";
const skipBundledRuntimeVerification = process.env.RETAIN_PDF_SKIP_BUNDLED_RUNTIME_VERIFICATION === "1";
const frontendOnly = process.argv.includes("--frontend-only");
const appRoot = path.join(desktopRoot, "app");
const outputFrontendRoot = path.join(appRoot, "frontend");
const outputBackendRoot = path.join(appRoot, "backend");
const outputFrontendVendorRoot = path.join(outputFrontendRoot, "vendor");
const bundledFontsRoot = path.join(outputBackendRoot, "fonts");
const buildRoot = path.join(desktopRoot, "build");
const linuxIconsRoot = path.join(buildRoot, "icons");
const desktopIconSource = path.join(desktopRoot, "assets", "RetainPDF-logo.png");
const desktopPackagePath = path.join(desktopRoot, "package.json");
const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, "utf8"));

function normalizeTargetPlatformName(platform = targetPlatform) {
  if (platform === "darwin" || platform === "mac") {
    return "mac";
  }
  if (platform === "win32" || platform === "windows") {
    return "windows";
  }
  if (platform === "linux") {
    return "linux";
  }
  throw new Error(`unsupported desktop target platform: ${platform}`);
}

const targetPlatformName = normalizeTargetPlatformName();

function resolvePlatformRuntimeDir(platformName = targetPlatformName) {
  return path.join(desktopRuntimeRoot, platformName);
}

function resolveRuntimeCandidate(relativePath) {
  const platformRoot = resolvePlatformRuntimeDir();
  const desktopCandidate = path.join(platformRoot, relativePath);
  if (fs.existsSync(desktopCandidate)) {
    return desktopCandidate;
  }

  if (targetPlatformName === "mac" && relativePath === "python" && allowBundledMacPython) {
    return desktopCandidate;
  }

  const legacyCandidates = {
    "python": path.join(backendRoot, "python"),
    "typst": {
      win32: path.join(backendRoot, "typst-win32"),
      darwin: path.join(backendRoot, "typst-darwin"),
      linux: path.join(backendRoot, "typst-linux"),
    }[targetPlatform],
  };

  const legacyCandidate = legacyCandidates[relativePath];
  return legacyCandidate && fs.existsSync(legacyCandidate) ? legacyCandidate : desktopCandidate;
}

function resolveSharedRuntimePath(relativePath) {
  const desktopCandidate = path.join(desktopRuntimeRoot, "shared", relativePath);
  if (fs.existsSync(desktopCandidate)) {
    return desktopCandidate;
  }
  const legacyCandidates = {
    "typst-packages": path.join(backendRoot, "typst-packages"),
    "fonts": [
      path.join(backendRoot, "fonts"),
      path.join(desktopRoot, "assets", "fonts"),
    ],
  };
  const legacyCandidate = legacyCandidates[relativePath];
  if (Array.isArray(legacyCandidate)) {
    const match = legacyCandidate.find((candidate) => fs.existsSync(candidate));
    return match || desktopCandidate;
  }
  return legacyCandidate && fs.existsSync(legacyCandidate) ? legacyCandidate : desktopCandidate;
}

function resolveSharedRuntimePaths(relativePath) {
  const candidates = [];
  const desktopCandidate = path.join(desktopRuntimeRoot, "shared", relativePath);
  if (fs.existsSync(desktopCandidate)) {
    candidates.push(desktopCandidate);
  }
  if (relativePath === "fonts") {
    for (const candidate of [
      path.join(backendRoot, "fonts"),
      path.join(desktopRoot, "assets", "fonts"),
    ]) {
      if (fs.existsSync(candidate)) {
        candidates.push(candidate);
      }
    }
  } else {
    const legacyCandidate = resolveSharedRuntimePath(relativePath);
    if (legacyCandidate !== desktopCandidate && fs.existsSync(legacyCandidate)) {
      candidates.push(legacyCandidate);
    }
  }
  return [...new Set(candidates)];
}

function copyRuntimeTree(from, to, options = {}) {
  const dereference = options.dereference === true;
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    dereference,
  });
}

function rewriteAbsoluteSymlinksWithinRoot(root, sourceRoot) {
  if (!fs.existsSync(root) || !fs.existsSync(sourceRoot)) {
    return;
  }
  const normalizedRoot = path.resolve(root);
  const normalizedSourceRoot = path.resolve(sourceRoot);

  function visit(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const stats = fs.lstatSync(entryPath);
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(entryPath);
        if (!path.isAbsolute(target)) {
          continue;
        }
        const normalizedTarget = path.normalize(target);
        if (!normalizedTarget.startsWith(normalizedSourceRoot + path.sep)
          && normalizedTarget !== normalizedSourceRoot) {
          continue;
        }
        const suffix = path.relative(normalizedSourceRoot, normalizedTarget);
        const replacementTarget = path.join(normalizedRoot, suffix);
        const relativeTarget = path.relative(path.dirname(entryPath), replacementTarget) || ".";
        fs.unlinkSync(entryPath);
        fs.symlinkSync(relativeTarget, entryPath);
        continue;
      }
      if (stats.isDirectory()) {
        visit(entryPath);
      }
    }
  }

  visit(normalizedRoot);
}

function pruneBundledMacPythonRuntime(root) {
  if (!fs.existsSync(root)) {
    return;
  }
  const frameworkVersionsRoot = path.join(root, "Frameworks", "Python.framework", "Versions");
  const currentVersionLink = path.join(frameworkVersionsRoot, "Current");
  let currentFrameworkVersion = "";
  if (fs.existsSync(currentVersionLink)) {
    try {
      currentFrameworkVersion = path.basename(fs.readlinkSync(currentVersionLink));
    } catch {
      currentFrameworkVersion = "";
    }
  }
  const libRoot = path.join(root, "lib");
  const pythonLibDir = fs.existsSync(libRoot)
    ? fs.readdirSync(libRoot).find((entry) => /^python\d+\.\d+$/.test(entry))
    : null;
  const removalTargets = [
    path.join(root, "Frameworks", "Python.framework", "Headers"),
    path.join(root, "Frameworks", "Python.framework", "Versions", "Current", "Frameworks", "Tk.framework"),
    path.join(root, "Frameworks", "Python.framework", "Versions", "Current", "Frameworks", "Tcl.framework"),
    path.join(root, "Frameworks", "Python.framework", "Versions", "Current", "Headers"),
    path.join(root, "Frameworks", "Python.framework", "Versions", "Current", "share", "doc"),
  ];
  if (pythonLibDir) {
    const sitePackagesRoot = path.join(libRoot, pythonLibDir, "site-packages");
    removalTargets.push(
      path.join(libRoot, pythonLibDir, "ensurepip"),
      path.join(sitePackagesRoot, "pip"),
      path.join(sitePackagesRoot, "setuptools"),
      path.join(sitePackagesRoot, "pkg_resources"),
    );
    if (fs.existsSync(sitePackagesRoot)) {
      for (const entry of fs.readdirSync(sitePackagesRoot)) {
        if (/^(pip|setuptools)-.+\.dist-info$/.test(entry)) {
          removalTargets.push(path.join(sitePackagesRoot, entry));
        }
      }
    }
  }
  for (const target of removalTargets) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  const removableFiles = [
    path.join(root, "bin", "2to3"),
    path.join(root, "bin", "idle3"),
    path.join(root, "bin", "pydoc3"),
    path.join(root, "bin", "python3-config"),
  ];
  for (const target of removableFiles) {
    fs.rmSync(target, { force: true });
  }

  if (fs.existsSync(frameworkVersionsRoot)) {
    for (const entry of fs.readdirSync(frameworkVersionsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === "Current" || entry.name === currentFrameworkVersion) {
        continue;
      }
      fs.rmSync(path.join(frameworkVersionsRoot, entry.name), { recursive: true, force: true });
    }
  }

  function pruneTree(currentPath) {
    if (!fs.existsSync(currentPath)) {
      return;
    }
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__pycache__" || entry.name === "test" || entry.name === "tests") {
          fs.rmSync(entryPath, { recursive: true, force: true });
          continue;
        }
        pruneTree(entryPath);
      }
    }
  }

  pruneTree(root);
}

const embeddedPythonRoot = resolveRuntimeCandidate("python");
const bundledTypstRoot = resolveRuntimeCandidate("typst");
const typstPackagesRoot = resolveSharedRuntimePath("typst-packages");

function resolveGitVersion() {
  const exactTag = spawnSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (exactTag.status === 0) {
    return exactTag.stdout.trim();
  }
  const described = spawnSync("git", ["describe", "--tags", "--always", "--dirty"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (described.status === 0) {
    return described.stdout.trim();
  }
  return "";
}

const releaseVersion = (process.env.RETAIN_PDF_VERSION || "").trim()
  || resolveGitVersion()
  || (fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : "")
  || (desktopPackage.version || "").trim();

if (!releaseVersion) {
  throw new Error(
    `Missing release version; fallback sources RETAIN_PDF_VERSION, git describe, ${versionFile}, and package.json are all empty`,
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
  copyRuntimeTree(embeddedPythonRoot, path.join(outputBackendRoot, "python"));
}

if (!frontendOnly && targetPlatform === "linux" && hasBundledPosixPython(embeddedPythonRoot)) {
  copyRuntimeTree(embeddedPythonRoot, path.join(outputBackendRoot, "python"));
}

if (!frontendOnly && targetPlatform === "darwin" && hasBundledPosixPython(embeddedPythonRoot)) {
  if (allowBundledMacPython) {
    const targetPythonRoot = path.join(outputBackendRoot, "python");
    copyRuntimeTree(embeddedPythonRoot, targetPythonRoot);
    rewriteAbsoluteSymlinksWithinRoot(targetPythonRoot, embeddedPythonRoot);
    pruneBundledMacPythonRuntime(targetPythonRoot);
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
if (!frontendOnly && targetPlatform === "darwin" && allowBundledMacPython && !hasBundledPosixPython(embeddedPythonRoot)) {
  throw new Error(
    `Bundled macOS Python runtime is missing. Expected ${path.join(resolvePlatformRuntimeDir("mac"), "python")} to contain bin/python3.`,
  );
}
if (!frontendOnly && bundledPythonRequired && !pythonBundled) {
  throw new Error(`Bundled Python runtime is required for ${targetPlatform} packaging but was not copied to ${outputPythonRoot}`);
}
if (!frontendOnly && pythonBundled && !skipBundledRuntimeVerification) {
  bundledPythonDiagnostics = verifyBundledPythonRuntime(outputPythonRoot);
}

if (!frontendOnly && fs.existsSync(bundledTypstRoot)) {
  fs.cpSync(bundledTypstRoot, path.join(outputBackendRoot, "typst"), {
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

if (!frontendOnly) {
  for (const fontAssetsRoot of resolveSharedRuntimePaths("fonts")) {
    for (const entry of fs.readdirSync(fontAssetsRoot)) {
      const from = path.join(fontAssetsRoot, entry);
      const to = path.join(bundledFontsRoot, entry);
      if (fs.statSync(from).isFile()) {
        fs.cpSync(from, to, { force: true });
      }
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
  targetPlatformName,
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
