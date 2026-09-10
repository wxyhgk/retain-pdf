import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  pruneBundledMacPythonRuntime,
  pruneBundledPortablePythonRuntime,
} from "./runtime-prune.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const versionFile = path.join(repoRoot, "VERSION");
const frontendRoot = path.join(repoRoot, "frontend/web");
const infraRoot = path.join(repoRoot, "ops", "deployment");
const servicesRoot = path.resolve(
  process.env.RETAIN_PDF_SERVICES_ROOT || path.join(repoRoot, "backend"),
);
const servicesPipelineRoot = path.join(servicesRoot, "pipeline");
const servicesAiRoot = path.join(servicesRoot, "ai");
const servicesConfigRoot = path.join(servicesRoot, "config");
const servicesFontsRoot = path.join(repoRoot, "resources", "fonts");
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

  if (relativePath === "typst") {
    const infraCandidate = path.join(infraRoot, `typst/${targetPlatform}`);
    if (fs.existsSync(infraCandidate)) {
      return infraCandidate;
    }
  }
  return desktopCandidate;
}

function resolveSharedRuntimePath(relativePath) {
  const desktopCandidate = path.join(desktopRuntimeRoot, "shared", relativePath);
  if (fs.existsSync(desktopCandidate)) {
    return desktopCandidate;
  }
  const sharedCandidates = {
    "fonts": [
      servicesFontsRoot,
      path.join(servicesRoot, "fonts"),
      path.join(desktopRoot, "assets", "fonts"),
    ],
  };
  const sharedCandidate = sharedCandidates[relativePath];
  if (Array.isArray(sharedCandidate)) {
    const match = sharedCandidate.find((candidate) => fs.existsSync(candidate));
    return match || desktopCandidate;
  }
  return desktopCandidate;
}

function resolveSharedRuntimePaths(relativePath) {
  const candidates = [];
  const desktopCandidate = path.join(desktopRuntimeRoot, "shared", relativePath);
  if (fs.existsSync(desktopCandidate)) {
    candidates.push(desktopCandidate);
  }
  if (relativePath === "fonts") {
    for (const candidate of [
      servicesFontsRoot,
      path.join(servicesRoot, "fonts"),
      path.join(desktopRoot, "assets", "fonts"),
    ]) {
      if (fs.existsSync(candidate)) {
        candidates.push(candidate);
      }
    }
  } else {
    const sharedCandidate = resolveSharedRuntimePath(relativePath);
    if (sharedCandidate !== desktopCandidate && fs.existsSync(sharedCandidate)) {
      candidates.push(sharedCandidate);
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

function resolveGitRevision(root) {
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  return revision.status === 0 ? revision.stdout.trim() : "";
}

const releaseVersion = (process.env.RETAIN_PDF_VERSION || "").trim()
  || (desktopPackage.version || "").trim()
  || resolveGitVersion()
  || (fs.existsSync(versionFile) ? fs.readFileSync(versionFile, "utf8").trim() : "");

if (!releaseVersion) {
  throw new Error(
    `Missing release version; fallback sources RETAIN_PDF_VERSION, git describe, ${versionFile}, and package.json are all empty`,
  );
}

const servicesSourceRevision = resolveGitRevision(servicesRoot);

function resolveRustApiBinary() {
  const overridePath = process.env.RUST_API_BINARY
    ? path.resolve(process.env.RUST_API_BINARY)
    : "";
  const candidates = [overridePath];

  if (targetPlatform === "win32") {
    candidates.push(
      path.join(
        repoRoot,
        "target",
        "x86_64-pc-windows-msvc",
        "release",
        "rust_api.exe",
      ),
      path.join(
        repoRoot,
        "target",
        "i686-pc-windows-msvc",
        "release",
        "rust_api.exe",
      ),
      path.join(
        repoRoot,
        "target",
        "i686-pc-windows-gnu",
        "release",
        "rust_api.exe",
      ),
    );
  } else if (targetPlatform === "darwin") {
    candidates.push(
      path.join(repoRoot, "target", "release", "rust_api"),
      path.join(repoRoot, "target", "x86_64-apple-darwin", "release", "rust_api"),
      path.join(repoRoot, "target", "aarch64-apple-darwin", "release", "rust_api"),
    );
  } else {
    candidates.push(path.join(repoRoot, "target", "release", "rust_api"));
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

function resolveJobsdBinary() {
  const overridePath = process.env.JOBSD_BINARY
    ? path.resolve(process.env.JOBSD_BINARY)
    : "";
  const candidates = [overridePath];

  if (targetPlatform === "win32") {
    candidates.push(
      path.join(repoRoot, "target", "x86_64-pc-windows-msvc", "release", "retain-jobsd.exe"),
      path.join(repoRoot, "target", "i686-pc-windows-msvc", "release", "retain-jobsd.exe"),
      path.join(repoRoot, "target", "release", "retain-jobsd.exe"),
    );
  } else if (targetPlatform === "darwin") {
    candidates.push(
      path.join(repoRoot, "target", "release", "retain-jobsd"),
      path.join(repoRoot, "target", "x86_64-apple-darwin", "release", "retain-jobsd"),
      path.join(repoRoot, "target", "aarch64-apple-darwin", "release", "retain-jobsd"),
    );
  } else {
    candidates.push(path.join(repoRoot, "target", "release", "retain-jobsd"));
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return {
        path: candidate,
        fileName: path.basename(candidate),
      };
    }
  }

  return {
    path: candidates[1] || "",
    fileName: targetPlatform === "win32" ? "retain-jobsd.exe" : "retain-jobsd",
  };
}

function resolveAgentBinary() {
  const overridePath = process.env.RETAINPDF_AGENT_BINARY
    ? path.resolve(process.env.RETAINPDF_AGENT_BINARY)
    : "";
  const fileName = targetPlatform === "win32" ? "retainpdf-agent.exe" : "retainpdf-agent";
  const candidates = [overridePath];

  if (targetPlatform === "win32") {
    candidates.push(
      path.join(repoRoot, "target", "x86_64-pc-windows-msvc", "release", fileName),
      path.join(repoRoot, "target", "i686-pc-windows-msvc", "release", fileName),
      path.join(repoRoot, "target", "release", fileName),
    );
  } else if (targetPlatform === "darwin") {
    candidates.push(
      path.join(repoRoot, "target", "release", fileName),
      path.join(repoRoot, "target", "x86_64-apple-darwin", "release", fileName),
      path.join(repoRoot, "target", "aarch64-apple-darwin", "release", fileName),
    );
  } else {
    candidates.push(path.join(repoRoot, "target", "release", fileName));
  }

  const match = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  return { path: match || candidates[1] || "", fileName };
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

function bundledPythonLibDynload(root) {
  if (!root || !fs.existsSync(root) || targetPlatform !== "darwin") {
    return [];
  }
  const pythonHome = resolveBundledPythonHome(root);
  const libRoot = pythonHome ? path.join(pythonHome, "lib") : "";
  if (!libRoot || !fs.existsSync(libRoot)) {
    return [];
  }
  const matches = [];
  for (const entry of fs.readdirSync(libRoot)) {
    if (!/^python\d+\.\d+$/.test(entry)) {
      continue;
    }
    const libDynload = path.join(libRoot, entry, "lib-dynload");
    if (fs.existsSync(libDynload)) {
      matches.push(libDynload);
    }
  }
  return matches;
}

function bundledPythonImportPaths(root) {
  return [
    ...bundledPythonSitePackages(root),
    ...bundledPythonLibDynload(root),
  ];
}

function resolveBundledPythonHome(root) {
  if (!root || !fs.existsSync(root)) {
    return "";
  }
  if (targetPlatform === "darwin") {
    const frameworkVersionsRoot = path.join(
      root,
      "Frameworks",
      "Python.framework",
      "Versions",
    );
    const frameworkHome = path.join(frameworkVersionsRoot, "Current");
    if (fs.existsSync(frameworkHome)) {
      return frameworkHome;
    }
    if (fs.existsSync(frameworkVersionsRoot)) {
      const version = fs.readdirSync(frameworkVersionsRoot).find((entry) => /^\d+\.\d+$/.test(entry));
      if (version) {
        return path.join(frameworkVersionsRoot, version);
      }
    }
  }
  if (!fs.existsSync(path.join(root, "pyvenv.cfg"))) {
    return root;
  }
  return "";
}

function pipelineWrapperFileName(platformName = targetPlatform) {
  return platformName === "win32" ? "retainpdf-pipeline.cmd" : "retainpdf-pipeline";
}

function resolveBuiltPipelineCommand(backendRoot) {
  const candidate = path.join(backendRoot, "bin", pipelineWrapperFileName());
  return fs.existsSync(candidate) ? candidate : "";
}

function writePipelineConsoleWrapper(backendRoot) {
  const binDir = path.join(backendRoot, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const wrapperPath = path.join(binDir, pipelineWrapperFileName());
  if (targetPlatform === "win32") {
    const content = [
      "@echo off",
      "set \"PIPELINE_HERE=%~dp0\"",
      "\"%PIPELINE_HERE%..\\python\\python.exe\" -m retainpdf_pipeline.entrypoints.console %*",
    ].join("\r\n") + "\r\n";
    fs.writeFileSync(wrapperPath, content, "utf8");
  } else {
    const content = [
      "#!/bin/sh",
      "PIPELINE_HERE=\"$(cd \"$(dirname \"$0\")\" && pwd)\"",
      "if [ -x \"$PIPELINE_HERE/../python/bin/python3\" ]; then",
      "  PIPELINE_PY=\"$PIPELINE_HERE/../python/bin/python3\"",
      "else",
      "  PIPELINE_PY=\"$PIPELINE_HERE/../python/bin/python\"",
      "fi",
      "exec \"$PIPELINE_PY\" -m retainpdf_pipeline.entrypoints.console \"$@\"",
    ].join("\n") + "\n";
    fs.writeFileSync(wrapperPath, content, { mode: 0o755 });
    fs.chmodSync(wrapperPath, 0o755);
  }
  return wrapperPath;
}

function probePipelineConsoleWrapper(backendRoot) {
  const wrapperCommand = resolveBuiltPipelineCommand(backendRoot);
  if (!wrapperCommand) {
    console.warn(
      "[prepare-app] pipeline console wrapper missing; skipping console probe (script fallback remains)",
    );
    return { ok: false, skipped: true, detail: "pipeline wrapper not found (legacy bundle?)" };
  }
  const isWindowsCmdWrapper = targetPlatform === "win32" && /\.cmd$/i.test(wrapperCommand);
  const probe = isWindowsCmdWrapper
    ? spawnSync("cmd.exe", ["/d", "/c", wrapperCommand, "--help"], {
      encoding: "utf8",
      timeout: 60000,
    })
    : spawnSync(wrapperCommand, ["--help"], {
      encoding: "utf8",
      timeout: 60000,
    });
  if (probe.status !== 0 || probe.error) {
    const detail = [
      probe.error ? String(probe.error.message || probe.error) : "",
      probe.stdout || "",
      probe.stderr || "",
    ].filter(Boolean).join("\n").trim() || "unknown error";
    console.warn(`[prepare-app] pipeline console probe failed (non-blocking): ${detail}`);
    return { ok: false, skipped: false, detail };
  }
  return { ok: true, skipped: false, detail: (probe.stdout || "").trim().slice(0, 2000) };
}

function verifyBundledPythonRuntime(root) {
  const pythonCommand = resolveBundledPythonCommand(root);
  if (!pythonCommand) {
    throw new Error(`Bundled Python runtime missing executable under ${root}`);
  }
  const bundledPythonHome = resolveBundledPythonHome(root);
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONPATH: bundledPythonImportPaths(root).join(path.delimiter),
  };
  if (bundledPythonHome) {
    env.PYTHONHOME = bundledPythonHome;
  } else {
    delete env.PYTHONHOME;
  }
  const probe = spawnSync(
    pythonCommand,
    [
      "-c",
      [
        "import importlib, sys",
        "print(f'python_prefix={sys.prefix} python_exec_prefix={sys.exec_prefix}')",
        "for module_name in ['_socket', 'socket', 'ssl', 'fitz', 'requests', 'pikepdf', 'PIL', 'urllib3']:",
        "    importlib.import_module(module_name)",
        "print('python_bundle_import_check=ok')",
      ].join("\n"),
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
  // Console entrypoint probe: wrapper --help. Warn-only so legacy bundles
  // without the wrapper (or without the console entrypoint module) still pass.
  const consoleProbe = probePipelineConsoleWrapper(path.dirname(root));
  return {
    pythonCommand,
    pythonHome: bundledPythonHome,
    sitePackages: bundledPythonSitePackages(root),
    importPaths: bundledPythonImportPaths(root),
    importCheck: probe.stdout.trim() || "python_bundle_import_check=ok",
    consoleProbe,
  };
}

const rustApiBinary = resolveRustApiBinary();
const jobsdBinary = resolveJobsdBinary();
const agentBinary = resolveAgentBinary();
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

const desktopFrontendRuntimeEntries = new Set([
  "index.html",
  "detail.html",
  "reader.html",
  "styles.css",
  "dist",
  "src",
  "decor",
  "vendor",
]);

function shouldCopyDesktopFrontendPath(sourcePath) {
  const relativePath = path.relative(frontendRoot, sourcePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return true;
  }
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (!desktopFrontendRuntimeEntries.has(parts[0])) {
    return false;
  }
  if (parts[0] === "src") {
    return parts.length === 1 || parts[1] === "assets";
  }
  return !parts.some((part) => part === ".DS_Store" || part === ".ipynb_checkpoints");
}

for (const entry of fs.readdirSync(frontendRoot, { withFileTypes: true })) {
  const from = path.join(frontendRoot, entry.name);
  const to = path.join(outputFrontendRoot, entry.name);
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    filter: shouldCopyDesktopFrontendPath,
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

}

rewriteDesktopFrontendRuntimeImports();

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
  // Keep the bundled layout aligned with main.js and RUST_API_SCRIPTS_DIR.
  const pipelineScriptsRoot = servicesPipelineRoot;
  if (!fs.existsSync(path.join(pipelineScriptsRoot, "pyproject.toml"))) {
    throw new Error(`missing pipeline package at ${pipelineScriptsRoot}`);
  }
  const canonicalPipelineEntries = new Set([
    "entrypoints",
    "retainpdf_pipeline",
    "pyproject.toml",
  ]);
  fs.cpSync(pipelineScriptsRoot, path.join(outputBackendRoot, "pipeline"), {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(pipelineScriptsRoot, sourcePath);
      if (!relativePath) {
        return true;
      }
      const parts = relativePath.split(path.sep).filter(Boolean);
      if (!canonicalPipelineEntries.has(parts[0])) {
        return false;
      }
      if (parts.some((part) => part === "__pycache__" || part === "test" || part === "tests")) {
        return false;
      }
      return !sourcePath.endsWith(".pyc") && !sourcePath.endsWith(".pyo");
    },
  });
  if (!fs.existsSync(path.join(servicesConfigRoot, "ocr_providers.json"))) {
    throw new Error(`missing backend provider config at ${servicesConfigRoot}`);
  }
  fs.cpSync(servicesConfigRoot, path.join(outputBackendRoot, "config"), {
    recursive: true,
    force: true,
  });
  const aiServiceSrc = servicesAiRoot;
  const aiServiceDst = path.join(outputBackendRoot, "ai_service");
  if (!fs.existsSync(aiServiceSrc)) {
    throw new Error(`missing ai_service at ${aiServiceSrc}`);
  }
  fs.cpSync(aiServiceSrc, aiServiceDst, {
    recursive: true,
    force: true,
    filter: (sourcePath) => {
      const base = path.basename(sourcePath);
      if (base === "__pycache__" || base === ".pytest_cache" || base === "tests") {
        return false;
      }
      return true;
    },
  });
  if (!fs.existsSync(path.join(aiServiceDst, "retainpdf_ai", "__main__.py"))) {
    throw new Error(`bundled ai_service missing retainpdf_ai/__main__.py under ${aiServiceDst}`);
  }
}

if (!frontendOnly && fs.existsSync(rustApiBinary.path)) {
  fs.mkdirSync(path.join(outputBackendRoot, "bin"), { recursive: true });
  fs.cpSync(rustApiBinary.path, path.join(outputBackendRoot, "bin", rustApiBinary.fileName), {
    force: true,
  });
}
if (!frontendOnly && fs.existsSync(jobsdBinary.path)) {
  fs.mkdirSync(path.join(outputBackendRoot, "bin"), { recursive: true });
  fs.cpSync(jobsdBinary.path, path.join(outputBackendRoot, "bin", jobsdBinary.fileName), {
    force: true,
  });
}
if (!frontendOnly && fs.existsSync(agentBinary.path)) {
  fs.mkdirSync(path.join(outputBackendRoot, "bin"), { recursive: true });
  fs.cpSync(agentBinary.path, path.join(outputBackendRoot, "bin", agentBinary.fileName), {
    force: true,
  });
}

if (!frontendOnly && targetPlatform === "win32" && fs.existsSync(path.join(embeddedPythonRoot, "python.exe"))) {
  const targetPythonRoot = path.join(outputBackendRoot, "python");
  copyRuntimeTree(embeddedPythonRoot, targetPythonRoot);
  pruneBundledPortablePythonRuntime(targetPythonRoot, "windows");
}

if (!frontendOnly && targetPlatform === "linux" && hasBundledPosixPython(embeddedPythonRoot)) {
  const targetPythonRoot = path.join(outputBackendRoot, "python");
  copyRuntimeTree(embeddedPythonRoot, targetPythonRoot);
  pruneBundledPortablePythonRuntime(targetPythonRoot, "linux");
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

if (!frontendOnly) {
  // Console-mode wrapper (backend/bin): Rust spawns this absolute path when
  // RUST_API_PYTHON_ENTRYPOINT_MODE=console. Script-mode fallback (backend/pipeline
  // sources copied below) is intentionally kept, so a missing wrapper only
  // downgrades to script mode instead of breaking the bundle.
  writePipelineConsoleWrapper(outputBackendRoot);
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
  "LICENSE-OFL-1.1.txt",
];
if (!frontendOnly) {
  for (const fileName of requiredBundledFonts) {
    const expectedPath = path.join(bundledFontsRoot, fileName);
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`Missing bundled font asset: ${expectedPath}`);
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    version: releaseVersion,
    servicesSourceRevision,
    targetPlatform,
    targetPlatformName,
    rustApiBinaryBundled: fs.existsSync(path.join(outputBackendRoot, "bin", rustApiBinary.fileName)),
    rustApiBinaryName: rustApiBinary.fileName,
    jobsdBinaryBundled: fs.existsSync(path.join(outputBackendRoot, "bin", jobsdBinary.fileName)),
    jobsdBinaryName: jobsdBinary.fileName,
    agentBinaryBundled: fs.existsSync(path.join(outputBackendRoot, "bin", agentBinary.fileName)),
    agentBinaryName: agentBinary.fileName,
    pipelineCommandBundled: Boolean(resolveBuiltPipelineCommand(outputBackendRoot)),
    pipelineCommand: (() => {
      const built = resolveBuiltPipelineCommand(outputBackendRoot);
      return built ? path.relative(outputBackendRoot, built) : null;
    })(),
    pipelineConsoleProbe: bundledPythonDiagnostics && bundledPythonDiagnostics.consoleProbe
      ? bundledPythonDiagnostics.consoleProbe
      : null,
    providerConfigBundled: fs.existsSync(
      path.join(outputBackendRoot, "config", "ocr_providers.json"),
    ),
    pythonBundled,
    bundledPythonExecutable: bundledPythonDiagnostics ? path.relative(outputBackendRoot, bundledPythonDiagnostics.pythonCommand) : null,
    bundledPythonHome: bundledPythonDiagnostics && bundledPythonDiagnostics.pythonHome
      ? path.relative(outputBackendRoot, bundledPythonDiagnostics.pythonHome)
      : null,
    bundledPythonSitePackages: bundledPythonDiagnostics
      ? bundledPythonDiagnostics.sitePackages.map((entry) => path.relative(outputBackendRoot, entry))
      : [],
    bundledPythonImportPaths: bundledPythonDiagnostics
      ? bundledPythonDiagnostics.importPaths.map((entry) => path.relative(outputBackendRoot, entry))
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
}
