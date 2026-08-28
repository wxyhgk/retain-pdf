const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  canConnectToPort,
  createBackendStartupDiagnostics,
  waitForPort,
} = require("./src/main/backend-startup-diagnostics");
const { buildBackendEnv } = require("./src/main/backend-env");
const { createBackendHttp } = require("./src/main/backend-http");
const { createBackendRuntime } = require("./src/main/backend-runtime");
const { createDesktopConfigStore } = require("./src/main/desktop-config");
const { createDesktopLogger } = require("./src/main/desktop-logging");
const { createDesktopWindows } = require("./src/main/desktop-windows");

const desktopLogger = createDesktopLogger(app);
const {
  appendDesktopLog,
  getDesktopLogPath,
  logDesktop,
  logDesktopError,
  resolveDesktopLogPath,
  setDesktopLogPath,
} = desktopLogger;
const backendStartupDiagnostics = createBackendStartupDiagnostics({ getDesktopLogPath });
const backendRuntime = createBackendRuntime(app, { appRoot: __dirname });
const {
  bundledPythonImportPaths,
  preparePythonRuntime,
  resolveBackendBinary,
  resolveBackendRoot,
  resolveBundledPythonHome,
  resolvePythonRuntime,
  resolveTypstBinary,
} = backendRuntime;

const DESKTOP_API_KEY = "retain-pdf-desktop";
const backendHttp = createBackendHttp({
  desktopApiKey: DESKTOP_API_KEY,
  logger: console,
});
const { canReuseExistingBackend } = backendHttp;
const desktopConfigStore = createDesktopConfigStore(app, { desktopApiKey: DESKTOP_API_KEY });
const {
  buildDesktopConfigResponse,
  loadDesktopConfig,
  saveDesktopConfig,
} = desktopConfigStore;
let backendChild = null;
let aiServiceChild = null;
let backendStopping = false;
let splashWindow = null;
let usingExternalBackend = false;
let isQuitting = false;
const AI_SERVICE_PORT = 41100;

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

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

const desktopWindows = createDesktopWindows(app, {
  appRoot: __dirname,
  closeSplashWindow,
  isQuitting: () => isQuitting,
  loadDesktopConfig,
  logDesktop,
  logDesktopError,
  markQuitting: () => {
    isQuitting = true;
  },
  saveDesktopConfig,
  updateSplashProgress,
});
const {
  createTray,
  createWindow,
  hasLiveMainWindow,
  resolveWindowIcon,
  setCloseToTrayHintShown,
  showExistingDesktopWindow,
  showMainWindow,
} = desktopWindows;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    logDesktop("[desktop] second instance requested; restoring existing window");
    showExistingDesktopWindow(splashWindow);
  });
}

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
  updateSplashProgress(6, "Đang chuẩn bị môi trường chạy", "Đang kiểm tra thành phần desktop và tài nguyên cục bộ");
}

async function startBundledBackend() {
  updateSplashProgress(18, "Đang kiểm tra tệp chạy", "Đang xác minh backend, Python và tài nguyên script");
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
  const aiServicePort = AI_SERVICE_PORT;
  // Packaged build uses backend/ai_service; development can fall back to the repo copy before prepare runs.
  let aiServiceRoot = path.join(backendRoot, "ai_service");
  if (!fs.existsSync(path.join(aiServiceRoot, "retainpdf_ai", "__main__.py"))) {
    const repoAi = path.join(appRoot, "..", "backend", "ai_service");
    if (fs.existsSync(path.join(repoAi, "retainpdf_ai", "__main__.py"))) {
      aiServiceRoot = repoAi;
    }
  }

  logDesktop(
    [
      "[desktop] starting bundled backend",
      `platform=${process.platform}`,
      `packaged=${app.isPackaged}`,
      `backendRoot=${backendRoot}`,
      `backendBin=${backendBin}`,
      `python=${pythonRuntime.command || "<missing>"}`,
      `pythonHome=${pythonRuntime.bundledHome || "<system>"}`,
      `scriptsDir=${scriptsDir}`,
      `aiServiceRoot=${aiServiceRoot}`,
      `typst=${typstBin || "<missing>"}`,
      `log=${getDesktopLogPath() || "<unavailable>"}`,
    ].join(" "),
  );

  if (!fs.existsSync(backendBin)) {
    throw new Error(`missing bundled backend binary: ${backendBin}`);
  }
  if (!pythonRuntime.command) {
    throw new Error("missing python runtime");
  }
  if (!fs.existsSync(scriptsDir)) {
    throw new Error(`missing bundled scripts directory: ${scriptsDir}`);
  }
  if (app.isPackaged && !typstBin) {
    throw new Error(`missing bundled typst runtime under ${path.join(backendRoot, "typst")}`);
  }

  pythonRuntime = await preparePythonRuntime(pythonRuntime, {
    updateSplashProgress,
  });
  if (app.isPackaged && !pythonRuntime.bundledHome) {
    throw new Error(
      `missing bundled python runtime under ${path.join(backendRoot, "python")}`,
    );
  }

  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(rustApiRoot, { recursive: true });
  fs.mkdirSync(typstPackageCachePath, { recursive: true });
  updateSplashProgress(34, "Đang chuẩn bị thư mục làm việc", "Đang khởi tạo thư mục dữ liệu cục bộ");

  const apiPortBusy = await canConnectToPort("127.0.0.1", apiPort);
  logDesktop(`[desktop] port ${apiPort} busy=${apiPortBusy}`);
  if (apiPortBusy) {
    const allowExternalBackend = process.env.RETAINPDF_DESKTOP_ALLOW_EXTERNAL_BACKEND === "1";
    if (app.isPackaged && !allowExternalBackend) {
      throw new Error(
        [
          `Cổng ${apiPort} đã được sử dụng.`,
          "Bản desktop chính thức không dùng lại backend hiện có để tránh lỗi kết xuất do kết nối tới phiên bản cũ hoặc bản phát triển.",
          "Hãy đóng RetainPDF khác, desktop cũ, Docker hoặc dịch vụ hệ thống rồi khởi động lại.",
        ].join("\n"),
      );
    }
    if (await canReuseExistingBackend(apiPort)) {
      usingExternalBackend = true;
      logDesktop(`[desktop] reusing existing backend on port ${apiPort}`);
      updateSplashProgress(52, "Đã phát hiện dịch vụ cục bộ", "Desktop sẽ dùng lại backend hiện tại");
      await waitForPort("127.0.0.1", apiPort, 5000);
      // Still try to start AI if 41100 is free; the reused Rust API proxies to the local AI service.
      const reuseEnv = buildBackendEnv({
        apiPort,
        aiServicePort,
        aiServiceRoot,
        backendRoot,
        bundledFontPath,
        bundledPythonHome: resolveBundledPythonHome(pythonRuntime.bundledHome),
        bundledPythonImportPaths: bundledPythonImportPaths(pythonRuntime.bundledHome),
        bundledTitleBoldFontPath,
        bundledTypstFontDir,
        dataRoot,
        desktopApiKey: DESKTOP_API_KEY,
        inheritHostPythonPath: !app.isPackaged,
        pythonRuntime,
        rustApiRoot,
        scriptsDir,
        simplePort,
        typstBin,
        typstPackageCachePath,
        typstPackagePath,
      });
      await startRetainpdfAiService({
        aiServicePort,
        aiServiceRoot,
        env: reuseEnv,
        pythonCommand: pythonRuntime.command,
      });
      updateSplashProgress(92, "Dịch vụ cục bộ đã sẵn sàng", "Đang tải giao diện chính");
      return;
    }
    throw new Error(
      `Cổng ${apiPort} đang bị tiến trình khác sử dụng và không phải backend RetainPDF có thể dùng lại. Hãy đóng tiến trình đó rồi khởi động desktop.`,
    );
  }

  const simplePortBusy = await canConnectToPort("127.0.0.1", simplePort);
  logDesktop(`[desktop] port ${simplePort} busy=${simplePortBusy}`);
  if (simplePortBusy) {
    throw new Error(`Cổng ${simplePort} đang bị tiến trình khác sử dụng; hãy giải phóng cổng rồi khởi động desktop.`);
  }

  const bundledPythonHome = resolveBundledPythonHome(pythonRuntime.bundledHome);
  const env = buildBackendEnv({
    apiPort,
    aiServicePort,
    aiServiceRoot,
    backendRoot,
    bundledFontPath,
    bundledPythonHome,
    bundledPythonImportPaths: bundledPythonImportPaths(pythonRuntime.bundledHome),
    bundledTitleBoldFontPath,
    bundledTypstFontDir,
    dataRoot,
    desktopApiKey: DESKTOP_API_KEY,
    inheritHostPythonPath: !app.isPackaged,
    pythonRuntime,
    rustApiRoot,
    scriptsDir,
    simplePort,
    typstBin,
    typstPackageCachePath,
    typstPackagePath,
  });

  updateSplashProgress(52, "Đang khởi động dịch vụ cục bộ", "Rust API và dịch vụ AI đang khởi động");
  logDesktop(`[desktop] spawning backend: ${backendBin}`);
  backendStartupDiagnostics.reset(backendBin, backendRoot);
  backendChild = spawn(backendBin, [], {
    cwd: backendRoot,
    env,
    windowsHide: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendChild.stdout.on("data", (chunk) => {
    backendStartupDiagnostics.rememberOutput("stdout", chunk);
    const message = `[rust_api] ${chunk}`;
    process.stdout.write(message);
    appendDesktopLog(message.trimEnd());
  });
  backendChild.stderr.on("data", (chunk) => {
    backendStartupDiagnostics.rememberOutput("stderr", chunk);
    const message = `[rust_api] ${chunk}`;
    process.stderr.write(message);
    appendDesktopLog(message.trimEnd());
  });

  backendChild.once("exit", (code, signal) => {
    backendChild = null;
    if (backendStopping) {
      return;
    }
    const detail = `code=${code ?? "null"} signal=${signal ?? "null"}`;
    backendStartupDiagnostics.markExit(detail);
    logDesktopError(`[desktop] Rust API worker crashed: ${detail}`);
    dialog.showErrorBox("Rust API worker crashed", detail);
  });

  // retainpdf-ai shares the Rust lifecycle; the frontend passes the LLM key per request.
  await startRetainpdfAiService({
    aiServicePort,
    aiServiceRoot,
    env,
    pythonCommand: pythonRuntime.command,
  });

  let waitingProgress = 58;
  const waitingTimer = setInterval(() => {
    waitingProgress = Math.min(waitingProgress + 3, 88);
    updateSplashProgress(
      waitingProgress,
      "Đang kết nối dịch vụ cục bộ",
      "Lần khởi động đầu có thể chậm hơn, vui lòng chờ",
    );
  }, 500);
  const backendReadyTimeoutMs = app.isPackaged ? 90000 : 30000;
  logDesktop(`[desktop] waiting for backend port ${apiPort} timeoutMs=${backendReadyTimeoutMs}`);
  await backendStartupDiagnostics.waitForBackendReady("127.0.0.1", apiPort, backendReadyTimeoutMs);
  clearInterval(waitingTimer);
  logDesktop(`[desktop] backend ready on port ${apiPort}`);
  updateSplashProgress(92, "Dịch vụ cục bộ đã sẵn sàng", "Đang tải giao diện chính");
}

async function startRetainpdfAiService({
  aiServicePort,
  aiServiceRoot,
  env,
  pythonCommand,
}) {
  if (!fs.existsSync(path.join(aiServiceRoot, "retainpdf_ai", "__main__.py"))) {
    logDesktopError(`[desktop] retainpdf-ai package missing under ${aiServiceRoot}; AI ask will return 502`);
    return;
  }

  const aiBusy = await canConnectToPort("127.0.0.1", aiServicePort);
  if (aiBusy) {
    logDesktop(`[desktop] AI service port ${aiServicePort} already in use; reusing`);
    return;
  }

  logDesktop(`[desktop] spawning retainpdf-ai: ${pythonCommand} -m retainpdf_ai (port ${aiServicePort})`);
  aiServiceChild = spawn(pythonCommand, ["-m", "retainpdf_ai"], {
    cwd: aiServiceRoot,
    env,
    windowsHide: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  aiServiceChild.stdout.on("data", (chunk) => {
    const message = `[retainpdf_ai] ${chunk}`;
    process.stdout.write(message);
    appendDesktopLog(message.trimEnd());
  });
  aiServiceChild.stderr.on("data", (chunk) => {
    const message = `[retainpdf_ai] ${chunk}`;
    process.stderr.write(message);
    appendDesktopLog(message.trimEnd());
  });
  aiServiceChild.once("exit", (code, signal) => {
    aiServiceChild = null;
    if (backendStopping || isQuitting) {
      return;
    }
    logDesktopError(
      `[desktop] retainpdf-ai exited unexpectedly: code=${code ?? "null"} signal=${signal ?? "null"}`,
    );
  });

  const aiReadyTimeoutMs = app.isPackaged ? 60000 : 20000;
  try {
    await waitForPort("127.0.0.1", aiServicePort, aiReadyTimeoutMs);
    logDesktop(`[desktop] retainpdf-ai ready on port ${aiServicePort}`);
  } catch (error) {
    // Do not block the main app: translation still works, only AI Q&A returns 502.
    logDesktopError(
      `[desktop] retainpdf-ai failed to become ready: ${error && error.message ? error.message : error}`,
    );
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    setDesktopLogPath(resolveDesktopLogPath());
    appendDesktopLog("========== RetainPDF desktop startup ==========");
    logDesktop(`[desktop] app ready version=${app.getVersion()} packaged=${app.isPackaged} userData=${app.getPath("userData")}`);
    setCloseToTrayHintShown(loadDesktopConfig().closeToTrayHintShown);
    createSplashWindow()
      .then(() => startBundledBackend())
      .then(() => {
        createTray();
        createWindow();
        app.on("activate", () => {
          if (!hasLiveMainWindow()) {
            createWindow();
            return;
          }
          showMainWindow();
        });
      })
      .catch((error) => {
        const detail = String(error && error.stack ? error.stack : error && error.message ? error.message : error);
        logDesktopError(`[desktop] startup failed: ${detail}`);
        const desktopLogPath = getDesktopLogPath();
        const dialogDetail = [
          String(error && error.message ? error.message : error),
          desktopLogPath ? `\nNhật ký đầy đủ: ${desktopLogPath}` : "",
        ].filter(Boolean).join("\n");
        dialog.showErrorBox("RetainPDF startup failed", dialogDetail);
        app.quit();
      });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  backendStopping = true;
  if (aiServiceChild && !aiServiceChild.killed) {
    try {
      aiServiceChild.kill();
    } catch (_err) {
      /* ignore */
    }
    aiServiceChild = null;
  }
  if (!usingExternalBackend && backendChild && !backendChild.killed) {
    backendChild.kill();
  }
});

ipcMain.handle("desktop:invoke", async (_event, command, args = {}) => {
  switch (command) {
    case "load_desktop_config": {
      const config = loadDesktopConfig();
      return buildDesktopConfigResponse(config);
    }
    case "save_desktop_config": {
      const config = saveDesktopConfig(args?.payload || {});
      return buildDesktopConfigResponse(config);
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
  logDesktopError(`[desktop][renderer-issue] type=${type} file=${filename} line=${lineno} col=${colno} message=${message}`);
});
