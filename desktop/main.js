const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const DESKTOP_API_KEY = "retain-pdf-desktop";
let backendChild = null;
let backendStopping = false;
let splashWindow = null;
let mainWindow = null;
let usingExternalBackend = false;
let tray = null;
let isQuitting = false;
let closeToTrayHintShown = false;

const DEFAULT_OCR_PROVIDER = "paddle";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

function createDefaultDesktopConfig() {
  return {
    firstRunCompleted: false,
    ocrProvider: DEFAULT_OCR_PROVIDER,
    mineruToken: "",
    paddleToken: "",
    modelApiKey: "",
    model: DEFAULT_MODEL,
    baseUrl: DEFAULT_BASE_URL,
    developerConfig: {},
    closeToTrayHintShown: false,
  };
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeOcrProvider(value) {
  return value === "paddle" ? "paddle" : DEFAULT_OCR_PROVIDER;
}

function normalizeTrimmedString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeDesktopConfig(raw = {}) {
  const defaults = createDefaultDesktopConfig();
  return {
    firstRunCompleted: !!raw.firstRunCompleted,
    ocrProvider: normalizeOcrProvider(raw.ocrProvider),
    mineruToken: normalizeTrimmedString(raw.mineruToken, defaults.mineruToken),
    paddleToken: normalizeTrimmedString(raw.paddleToken, defaults.paddleToken),
    modelApiKey: normalizeTrimmedString(raw.modelApiKey, defaults.modelApiKey),
    model: normalizeTrimmedString(raw.model, defaults.model),
    baseUrl: normalizeTrimmedString(raw.baseUrl, defaults.baseUrl),
    developerConfig: typeof raw.developerConfig === "object" && raw.developerConfig !== null
      ? { ...raw.developerConfig }
      : {},
    closeToTrayHintShown: !!raw.closeToTrayHintShown,
  };
}

function mergeDesktopConfig(currentConfig, payload = {}) {
  const merged = { ...currentConfig };
  const runtimeConfig = typeof payload.runtimeConfig === "object" && payload.runtimeConfig !== null
    ? payload.runtimeConfig
    : {};
  const keys = [
    "ocrProvider",
    "mineruToken",
    "paddleToken",
    "modelApiKey",
    "model",
    "baseUrl",
    "closeToTrayHintShown",
  ];
  for (const key of keys) {
    if (hasOwn(payload, key)) {
      merged[key] = payload[key];
      continue;
    }
    if (hasOwn(runtimeConfig, key)) {
      merged[key] = runtimeConfig[key];
    }
  }
  if (typeof payload.developerConfig === "object" && payload.developerConfig !== null) {
    merged.developerConfig = { ...payload.developerConfig };
  }
  if (hasOwn(payload, "firstRunCompleted")) {
    merged.firstRunCompleted = !!payload.firstRunCompleted;
  }
  return normalizeDesktopConfig(merged);
}

function buildBrowserConfig(config) {
  return {
    ocrProvider: config.ocrProvider || DEFAULT_OCR_PROVIDER,
    mineruToken: config.mineruToken || "",
    paddleToken: config.paddleToken || "",
    modelApiKey: config.modelApiKey || "",
  };
}

function resolveDesktopConfigPath() {
  return path.join(app.getPath("userData"), "desktop-config.json");
}

function loadDesktopConfig() {
  const configPath = resolveDesktopConfigPath();
  if (!fs.existsSync(configPath)) {
    return createDefaultDesktopConfig();
  }
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return normalizeDesktopConfig(JSON.parse(raw));
  } catch (error) {
    console.error(`[desktop] failed to load desktop config: ${error?.message || error}`);
    return createDefaultDesktopConfig();
  }
}

function saveDesktopConfig(payload = {}) {
  const nextConfig = mergeDesktopConfig(loadDesktopConfig(), payload);
  const configPath = resolveDesktopConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return nextConfig;
}

function buildDesktopRuntimeConfig(config) {
  return {
    apiBase: "http://127.0.0.1:41000",
    xApiKey: DESKTOP_API_KEY,
    ...buildBrowserConfig(config),
    model: config.model || DEFAULT_MODEL,
    baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    developerConfig: config.developerConfig || {},
  };
}

function updateSplashProgress(progress, title, detail) {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }
  splashWindow.webContents.send("startup-progress", {
    progress,
    title,
    detail,
  });
}

function resolveWindowIcon() {
  if (app.isPackaged) {
    return path.join(__dirname, "assets", "RetainPDF-logo.png");
  }
  return path.join(__dirname, "assets", "RetainPDF-logo.png");
}

function resolveTrayIcon() {
  return resolveWindowIcon();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.hide();
  maybeShowCloseToTrayHint();
}

function persistCloseToTrayHintShown() {
  const current = loadDesktopConfig();
  saveDesktopConfig({
    ...current,
    closeToTrayHintShown: true,
  });
  closeToTrayHintShown = true;
}

function maybeShowCloseToTrayHint() {
  if (closeToTrayHintShown || !tray) {
    return;
  }
  if (process.platform === "win32" && typeof tray.displayBalloon === "function") {
    tray.displayBalloon({
      iconType: "info",
      title: "RetainPDF 正在后台运行",
      content: "窗口已隐藏到系统托盘，本地 API 仍可继续使用。右键托盘图标可退出。",
    });
  }
  persistCloseToTrayHintShown();
}

function createTray() {
  if (tray) {
    return tray;
  }
  tray = new Tray(resolveTrayIcon());
  tray.setToolTip("RetainPDF");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => {
          showMainWindow();
        },
      },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      hideMainWindowToTray();
      return;
    }
    showMainWindow();
  });
  tray.on("double-click", () => {
    showMainWindow();
  });
  return tray;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  showMainWindow();
});

async function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    center: true,
    backgroundColor: "#f5f5f7",
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  await splashWindow.loadFile(path.join(__dirname, "splash.html"));
  updateSplashProgress(6, "正在准备运行环境", "正在检查桌面组件与本地资源");
}

function waitForPort(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function tryConnect() {
      const socket = net.connect({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`backend did not become ready on ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    }

    tryConnect();
  });
}

function canConnectToPort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function requestJson(url, headers = {}, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      url,
      {
        headers,
        timeout: timeoutMs,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`http ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
  });
}

async function canReuseExistingBackend(apiPort) {
  const healthUrl = `http://127.0.0.1:${apiPort}/health`;
  const jobsUrl = `http://127.0.0.1:${apiPort}/api/v1/jobs?limit=1&offset=0`;
  try {
    const healthPayload = await requestJson(healthUrl, {}, 2000);
    if (!(healthPayload && healthPayload.data && healthPayload.data.status === "up")) {
      return false;
    }
    const jobsPayload = await requestJson(jobsUrl, {
      "x-api-key": DESKTOP_API_KEY,
    }, 3000);
    return Array.isArray(jobsPayload?.data?.items);
  } catch (error) {
    console.warn(
      `[desktop] existing backend on :${apiPort} is not reusable: ${error?.message || error}`,
    );
    return false;
  }
}

function resolveBackendRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }
  return path.join(__dirname, "app", "backend");
}

function resolveBackendBinary(backendRoot) {
  const candidates = process.platform === "win32"
    ? [path.join(backendRoot, "bin", "rust_api.exe")]
    : [path.join(backendRoot, "bin", "rust_api")];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function resolvePythonRuntime(backendRoot) {
  const bundledRoot = path.join(backendRoot, "python");
  const bundledCandidates = process.platform === "win32"
    ? [path.join(bundledRoot, "python.exe")]
    : [
        path.join(bundledRoot, "bin", "python3"),
        path.join(bundledRoot, "bin", "python"),
      ];
  for (const candidate of bundledCandidates) {
    if (fs.existsSync(candidate)) {
      return { command: candidate, bundledHome: bundledRoot };
    }
  }
  if (process.platform === "darwin") {
    const macCandidates = [
      process.env.RETAIN_PDF_SYSTEM_PYTHON,
      "/usr/bin/python3",
      "/opt/homebrew/bin/python3",
      "/usr/local/bin/python3",
    ].filter(Boolean);
    for (const candidate of macCandidates) {
      if (fs.existsSync(candidate)) {
        return { command: candidate, bundledHome: null };
      }
    }
    return { command: "python3", bundledHome: null };
  }
  return { command: "python3", bundledHome: null };
}

function resolveSystemPythonRuntime() {
  if (process.platform === "darwin") {
    const macCandidates = [
      process.env.RETAIN_PDF_SYSTEM_PYTHON,
      "/usr/bin/python3",
      "/opt/homebrew/bin/python3",
      "/usr/local/bin/python3",
    ].filter(Boolean);
    for (const candidate of macCandidates) {
      if (fs.existsSync(candidate)) {
        return { command: candidate, bundledHome: null };
      }
    }
  }
  return { command: "python3", bundledHome: null };
}

function shouldSetBundledPythonHome(bundledHome) {
  if (!bundledHome || !fs.existsSync(bundledHome)) {
    return false;
  }
  return !fs.existsSync(path.join(bundledHome, "pyvenv.cfg"));
}

function probePythonRuntime(runtime) {
  return new Promise((resolve) => {
    if (!runtime || !runtime.command) {
      resolve({ ok: false, reason: "missing_python_command" });
      return;
    }
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONUTF8: "1",
    };
    if (shouldSetBundledPythonHome(runtime.bundledHome)) {
      env.PYTHONHOME = runtime.bundledHome;
    } else {
      delete env.PYTHONHOME;
    }
    const child = spawn(
      runtime.command,
      ["-c", "import sys; print(sys.executable)"],
      {
        env,
        windowsHide: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 8000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: String(error && error.message ? error.message : error), stdout, stderr });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      resolve({
        ok: false,
        reason: `exit_code=${code ?? "null"} signal=${signal ?? "null"}`,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

function bundledPythonSitePackages(bundledHome) {
  if (!bundledHome || !fs.existsSync(bundledHome)) {
    return [];
  }
  if (process.platform === "win32") {
    const windowsSitePackages = path.join(bundledHome, "Lib", "site-packages");
    return fs.existsSync(windowsSitePackages) ? [windowsSitePackages] : [];
  }

  const libRoot = path.join(bundledHome, "lib");
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

function resolveTypstBinary(backendRoot) {
  const candidates = process.platform === "win32"
    ? [path.join(backendRoot, "typst", "bin", "typst.exe")]
    : [
        path.join(backendRoot, "typst", "bin", "typst"),
        "/usr/local/bin/typst",
        "/opt/homebrew/bin/typst",
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

async function startBundledBackend() {
  updateSplashProgress(18, "正在检查运行文件", "正在校验后端、Python 和脚本资源");
  const backendRoot = resolveBackendRoot();
  const backendBin = resolveBackendBinary(backendRoot);
  let pythonRuntime = resolvePythonRuntime(backendRoot);
  const scriptsDir = path.join(backendRoot, "scripts");
  const typstBin = resolveTypstBinary(backendRoot);
  const bundledFontPath = path.join(backendRoot, "fonts", "SourceHanSerifSC-Regular.otf");
  const bundledTitleBoldFontPath = path.join(backendRoot, "fonts", "SourceHanSerifSC-Bold.otf");
  const bundledTypstFontDir = path.join(backendRoot, "fonts");
  const dataRoot = path.join(app.getPath("userData"), "data");
  const rustApiRoot = path.join(dataRoot, "rust_api");
  const typstPackagePath = path.join(backendRoot, "typst-packages");
  const typstPackageCachePath = path.join(dataRoot, "typst-package-cache");
  const apiPort = 41000;
  const simplePort = 42000;

  if (!fs.existsSync(backendBin)) {
    throw new Error(`missing bundled backend binary: ${backendBin}`);
  }
  if (!pythonRuntime.command) {
    throw new Error("missing python runtime");
  }
  if (!fs.existsSync(scriptsDir)) {
    throw new Error(`missing bundled scripts directory: ${scriptsDir}`);
  }

  if (process.platform === "darwin") {
    const bundledProbe = await probePythonRuntime(pythonRuntime);
    if (!bundledProbe.ok && pythonRuntime.bundledHome) {
      console.warn(
        `[desktop] bundled mac python probe failed, fallback to system python: ${bundledProbe.reason}\n${bundledProbe.stderr || ""}`.trim(),
      );
      updateSplashProgress(26, "正在检查 Python 运行时", "内置 Python 不可用，正在回退系统 Python");
      const fallbackRuntime = resolveSystemPythonRuntime();
      const fallbackProbe = await probePythonRuntime(fallbackRuntime);
      if (fallbackProbe.ok) {
        pythonRuntime = fallbackRuntime;
      } else {
        throw new Error(
          `macOS Python runtime probe failed; bundled=${bundledProbe.reason}; fallback=${fallbackProbe.reason}`,
        );
      }
    }
  }

  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(rustApiRoot, { recursive: true });
  fs.mkdirSync(typstPackageCachePath, { recursive: true });
  updateSplashProgress(34, "正在准备工作目录", "正在初始化本地数据目录");

  const apiPortBusy = await canConnectToPort("127.0.0.1", apiPort);
  if (apiPortBusy) {
    if (await canReuseExistingBackend(apiPort)) {
      usingExternalBackend = true;
      updateSplashProgress(52, "检测到已有本地服务", "桌面端将直接复用当前后端");
      await waitForPort("127.0.0.1", apiPort, 5000);
      updateSplashProgress(92, "本地服务已就绪", "正在加载主界面");
      return;
    }
    throw new Error(
      `端口 ${apiPort} 已被其他进程占用，且不是可复用的 RetainPDF 后端。请先关闭占用进程后再启动桌面端。`,
    );
  }

  const simplePortBusy = await canConnectToPort("127.0.0.1", simplePort);
  if (simplePortBusy) {
    throw new Error(`端口 ${simplePort} 已被其他进程占用，请先释放后再启动桌面端。`);
  }

  const env = {
    ...process.env,
    RUST_API_BIND_HOST: "127.0.0.1",
    RUST_API_PORT: String(apiPort),
    RUST_API_SIMPLE_PORT: String(simplePort),
    RUST_API_KEYS: DESKTOP_API_KEY,
    RUST_API_DATA_ROOT: dataRoot,
    RUST_API_ROOT: rustApiRoot,
    RUST_API_NORMAL_MAX_BYTES: String(200 * 1024 * 1024),
    RUST_API_NORMAL_MAX_PAGES: "600",
    RUST_API_PROJECT_ROOT: backendRoot,
    RUST_API_SCRIPTS_DIR: scriptsDir,
    PYTHON_BIN: pythonRuntime.command,
    PYTHONPATH: [
      scriptsDir,
      ...bundledPythonSitePackages(pythonRuntime.bundledHome),
      process.env.PYTHONPATH || "",
    ].filter(Boolean).join(path.delimiter),
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PDF_TRANSLATOR_TRUST_ENV_PROXY: "1",
    RETAIN_PDF_FONT_PATH: bundledFontPath,
    RETAIN_PDF_TITLE_BOLD_FONT_PATH: bundledTitleBoldFontPath,
    RETAIN_PDF_TYPST_FONT_DIRS: bundledTypstFontDir,
    RETAIN_PDF_TYPST_FONT_FAMILY: "Source Han Serif SC",
    TYPST_PACKAGE_CACHE_PATH: typstPackageCachePath,
  };
  if (fs.existsSync(typstPackagePath)) {
    env.TYPST_PACKAGE_PATH = typstPackagePath;
  }
  if (shouldSetBundledPythonHome(pythonRuntime.bundledHome)) {
    env.PYTHONHOME = pythonRuntime.bundledHome;
  }
  if (fs.existsSync(typstBin)) {
    env.TYPST_BIN = typstBin;
  }

  updateSplashProgress(52, "正在启动本地服务", "Rust API 与 Python worker 正在启动");
  backendChild = spawn(backendBin, [], {
    cwd: backendRoot,
    env,
    windowsHide: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendChild.stdout.on("data", (chunk) => {
    process.stdout.write(`[rust_api] ${chunk}`);
  });
  backendChild.stderr.on("data", (chunk) => {
    process.stderr.write(`[rust_api] ${chunk}`);
  });

  backendChild.once("exit", (code, signal) => {
    backendChild = null;
    if (backendStopping) {
      return;
    }
    const detail = `code=${code ?? "null"} signal=${signal ?? "null"}`;
    dialog.showErrorBox("Rust API worker crashed", detail);
  });

  let waitingProgress = 58;
  const waitingTimer = setInterval(() => {
    waitingProgress = Math.min(waitingProgress + 3, 88);
    updateSplashProgress(
      waitingProgress,
      "正在连接本地服务",
      "首次启动可能稍慢，请稍候",
    );
  }, 500);
  await waitForPort("127.0.0.1", apiPort, 30000);
  clearInterval(waitingTimer);
  updateSplashProgress(92, "本地服务已就绪", "正在加载主界面");
}

function createWindow() {
  const frontendRoot = resolveFrontendRoot();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    show: false,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(frontendRoot, "index.html"));

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    hideMainWindowToTray();
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(
      `[desktop][renderer][level=${level}] ${sourceId || "unknown"}:${line || 0} ${message || ""}`,
    );
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    const detail = `code=${errorCode} url=${validatedURL || "unknown"} error=${errorDescription || "unknown"}`;
    console.error(`[desktop] renderer load failed: ${detail}`);
    dialog.showErrorBox("RetainPDF 页面加载失败", detail);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    const detail = `reason=${details?.reason || "unknown"} exitCode=${details?.exitCode ?? "unknown"}`;
    console.error(`[desktop] renderer process gone: ${detail}`);
    dialog.showErrorBox("RetainPDF 渲染进程异常退出", detail);
  });

  mainWindow.webContents.once("did-finish-load", () => {
    updateSplashProgress(100, "准备完成", "正在进入主界面");
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function resolveFrontendRoot() {
  const generatedFrontendRoot = path.join(__dirname, "app", "frontend");
  if (app.isPackaged) {
    return generatedFrontendRoot;
  }
  if (fs.existsSync(path.join(generatedFrontendRoot, "index.html"))) {
    return generatedFrontendRoot;
  }
  const sourceFrontendRoot = path.resolve(__dirname, "..", "frontend");
  if (fs.existsSync(path.join(sourceFrontendRoot, "index.html"))) {
    return sourceFrontendRoot;
  }
  return generatedFrontendRoot;
}

app.whenReady().then(() => {
  closeToTrayHintShown = loadDesktopConfig().closeToTrayHintShown;
  createSplashWindow()
    .then(() => startBundledBackend())
    .then(() => {
      createTray();
      createWindow();
      app.on("activate", () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
          return;
        }
        showMainWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("RetainPDF startup failed", String(error && error.message ? error.message : error));
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (!usingExternalBackend && backendChild && !backendChild.killed) {
    backendStopping = true;
    backendChild.kill();
  }
});

ipcMain.handle("desktop:invoke", async (_event, command, args = {}) => {
  switch (command) {
    case "load_desktop_config": {
      const config = loadDesktopConfig();
      return {
        firstRunCompleted: config.firstRunCompleted,
        closeToTrayHintShown: config.closeToTrayHintShown,
        browserConfig: buildBrowserConfig(config),
        developerConfig: config.developerConfig || {},
        runtimeConfig: buildDesktopRuntimeConfig(config),
      };
    }
    case "save_desktop_config": {
      const config = saveDesktopConfig(args?.payload || {});
      return {
        firstRunCompleted: config.firstRunCompleted,
        closeToTrayHintShown: config.closeToTrayHintShown,
        browserConfig: buildBrowserConfig(config),
        developerConfig: config.developerConfig || {},
        runtimeConfig: buildDesktopRuntimeConfig(config),
      };
    }
    case "open_output_directory": {
      const outputDir = path.join(app.getPath("userData"), "data", "jobs");
      fs.mkdirSync(outputDir, { recursive: true });
      const result = await shell.openPath(outputDir);
      if (result) {
        throw new Error(result);
      }
      return { ok: true, outputDir };
    }
    default:
      throw new Error(`unsupported desktop command: ${command}`);
  }
});

ipcMain.on("desktop:renderer-issue", (_event, payload = {}) => {
  const type = payload?.type || "unknown";
  const message = payload?.message || "unknown renderer issue";
  const filename = payload?.filename || "";
  const lineno = payload?.lineno || 0;
  const colno = payload?.colno || 0;
  console.error(
    `[desktop][renderer-issue] type=${type} file=${filename} line=${lineno} col=${colno} message=${message}`,
  );
});
