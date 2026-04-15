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
const appRoot = path.join(desktopRoot, "app");
const outputFrontendRoot = path.join(appRoot, "frontend");
const outputBackendRoot = path.join(appRoot, "backend");
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
        "import fitz, requests, pikepdf, PIL",
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

fs.rmSync(appRoot, { recursive: true, force: true });
fs.mkdirSync(outputFrontendRoot, { recursive: true });
fs.mkdirSync(outputBackendRoot, { recursive: true });
fs.mkdirSync(bundledFontsRoot, { recursive: true });

const copyEntries = [
  ".gitignore",
  "index.html",
  "reader.html",
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

function copyFrontendRuntimeDependency(packageName, entries) {
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
  const targetRoot = path.join(outputFrontendRoot, "node_modules", packageName);
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

if (targetPlatform === "linux" && hasBundledPosixPython(embeddedPythonRoot)) {
  fs.cpSync(embeddedPythonRoot, path.join(outputBackendRoot, "python"), {
    recursive: true,
    force: true,
  });
}

if (targetPlatform === "darwin" && hasBundledPosixPython(embeddedPythonRoot)) {
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
if (bundledPythonRequired && !pythonBundled) {
  throw new Error(`Bundled Python runtime is required for ${targetPlatform} packaging but was not copied to ${outputPythonRoot}`);
}
if (pythonBundled) {
  bundledPythonDiagnostics = verifyBundledPythonRuntime(outputPythonRoot);
}

if (targetPlatform === "win32" && fs.existsSync(typstWindowsRoot)) {
  fs.cpSync(typstWindowsRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (targetPlatform === "darwin" && fs.existsSync(typstDarwinRoot)) {
  fs.cpSync(typstDarwinRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (targetPlatform === "linux" && fs.existsSync(typstLinuxRoot)) {
  fs.cpSync(typstLinuxRoot, path.join(outputBackendRoot, "typst"), {
    recursive: true,
    force: true,
  });
}

if (fs.existsSync(typstPackagesRoot)) {
  fs.cpSync(typstPackagesRoot, path.join(outputBackendRoot, "typst-packages"), {
    recursive: true,
    force: true,
  });
}

if (fs.existsSync(bundledFontAssetsRoot)) {
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
for (const fileName of requiredBundledFonts) {
  const expectedPath = path.join(bundledFontsRoot, fileName);
  if (!fs.existsSync(expectedPath)) {
    throw new Error(`Missing bundled font asset: ${expectedPath}`);
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
