const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Context } = require("./src/main/cordis");
const { createBackendPlugin } = require("./src/main/plugins/backend");
const { createGatewayPlugin } = require("./src/main/plugins/gateway");
const { createIpcPlugin } = require("./src/main/plugins/ipc");
const { createSplashPlugin } = require("./src/main/plugins/splash");
const { createWindowsPlugin } = require("./src/main/plugins/windows");
const {
  canConnectToPort,
  createBackendStartupDiagnostics,
  waitForPort,
} = require("./src/main/backend-startup-diagnostics");
const { buildBackendEnv } = require("./src/main/backend-env");
const { createBackendHttp } = require("./src/main/backend-http");
const { createPortOccupant } = require("./src/main/port-occupant");
const { stopChildGracefully } = require("./src/main/graceful-stop");
const { createPortAllocator } = require("./src/main/port-allocator");
const { createLocalGateway } = require("./src/main/local-gateway");
const { createBackendRuntime } = require("./src/main/backend-runtime");
const { createDesktopConfigStore } = require("./src/main/desktop-config");
const { createRetainpdfHome } = require("./src/main/retainpdf-home");
const { createCliInstaller } = require("./src/main/cli-install");
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
const { resolveBackendRoot } = backendRuntime;

const DESKTOP_API_KEY = "retain-pdf-desktop";
const backendHttp = createBackendHttp({
  desktopApiKey: DESKTOP_API_KEY,
  logger: console,
});
const { canReuseExistingBackend } = backendHttp;
const portOccupant = createPortOccupant({ canConnectToPort, logger: console });
// ~/.retainpdf/ 经命令行 retainpdf 读写：打包后在 backend/bin，开发时用仓库里编译好的。
const retainpdfHome = createRetainpdfHome({ resolveCli: () => retainpdfHomeCliPath() });
const desktopConfigStore = createDesktopConfigStore(app, { desktopApiKey: DESKTOP_API_KEY, retainpdfHome });

// 设置 → 更新 →「安装命令行工具」。
const cliInstaller = createCliInstaller({ resolveSource: () => retainpdfHomeCliPath() });

function retainpdfHomeCliPath() {
  const fileName = process.platform === "win32" ? "retainpdf.exe" : "retainpdf";
  const repoRoot = path.join(__dirname, "..", "..");
  const candidates = [
    process.env.RETAINPDF_CLI || "",
    path.join(resolveBackendRoot(), "bin", fileName),
    ...(app.isPackaged ? [] : [
      path.join(repoRoot, "target", "release", fileName),
      path.join(repoRoot, "target", "debug", fileName),
    ]),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

/** ~/.retainpdf 的设置（命令行不在或读不了时为 null）。 */
function readRetainpdfSettings() {
  try {
    return retainpdfHome.exportSettings();
  } catch (error) {
    logDesktopError?.(`[desktop] ~/.retainpdf unreadable: ${error?.message || error}`);
    return null;
  }
}

/** 数据目录：~/.retainpdf 的 backend.data_dir，没配就是应用数据目录下的 data。 */
function resolveDataRoot() {
  const configured = readRetainpdfSettings()?.backend?.data_dir;
  return typeof configured === "string" && configured.trim() ? configured : path.join(app.getPath("userData"), "data");
}
const {
  buildDesktopConfigResponse,
  buildDesktopRuntimeConfig,
  loadDesktopConfig,
  saveDesktopConfig,
  setBackendApiPort,
} = desktopConfigStore;
// 主进程拆成 Cordis 插件（src/main/plugins/）：启动画面 → 后端 → 网关 → 窗口，先后靠
// inject 声明的依赖排，退出时插件树反向 dispose。方案见
// docs/ops/planning/desktop-cordis-pilot/20261022-桌面壳主进程用Cordis试点.md。
let isQuitting = false;
// 退出时插件树的清理进度："idle" → "stopping"（等子进程收尾）→ "done"。
// 防止 before-quit 重入：清理完再调 app.quit() 时直接放行。
let shutdownState = "idle";
// before-quit 先 abort 它：后端插件还在等就绪时立刻放弃，不用等满超时（见 plugins/backend.js）。
const quitController = new AbortController();
let appContext = null;

function getService(name) {
  return appContext ? appContext.get(name) : undefined;
}

let startupFailureReported = false;
function reportStartupFailure(error) {
  if (startupFailureReported || quitController.signal.aborted) {
    return;
  }
  startupFailureReported = true;
  const detail = String(error && error.stack ? error.stack : error && error.message ? error.message : error);
  logDesktopError(`[desktop] startup failed: ${detail}`);
  const desktopLogPath = getDesktopLogPath();
  const dialogDetail = [
    String(error && error.message ? error.message : error),
    desktopLogPath ? `\n完整日志: ${desktopLogPath}` : "",
  ].filter(Boolean).join("\n");
  dialog.showErrorBox("RetainPDF startup failed", dialogDetail);
  app.quit();
}

const desktopWindows = createDesktopWindows(app, {
  appRoot: __dirname,
  closeSplashWindow: () => getService("splash")?.close(),
  getFrontendBaseUrl: () => getService("gateway")?.baseUrl || "",
  getApiBase: () => buildDesktopRuntimeConfig(loadDesktopConfig()).apiBase,
  isQuitting: () => isQuitting,
  loadDesktopConfig,
  logDesktop,
  logDesktopError,
  markQuitting: () => {
    isQuitting = true;
  },
  saveDesktopConfig,
  updateSplashProgress: (progress, title, detail) => getService("splash")?.update(progress, title, detail),
});
const {
  resolveFrontendRoot,
  resolveWindowIcon,
  setCloseToTrayHintShown,
  showExistingDesktopWindow,
} = desktopWindows;

// Windows 上系统通知要认得出是哪个程序发的（和 package.json 的 build.appId 一致），不设就不弹。
if (process.platform === "win32") {
  app.setAppUserModelId("com.wxyhgk.retainpdf");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    logDesktop("[desktop] second instance requested; restoring existing window");
    showExistingDesktopWindow(getService("splash")?.getWindow() ?? null);
  });
}

function startDesktopApp() {
  const root = new Context();
  root.plugin(createIpcPlugin({
    BrowserWindow,
    buildDesktopConfigResponse,
    cliInstaller,
    dialog,
    ipcMain,
    loadDesktopConfig,
    logDesktopError,
    resolveDataRoot,
    saveDesktopConfig,
    shell,
  }));
  root.plugin(createSplashPlugin({
    BrowserWindow,
    appRoot: __dirname,
    resolveWindowIcon,
    onStartupFailure: reportStartupFailure,
  }));
  root.plugin(createBackendPlugin({
    app,
    appRoot: __dirname,
    appendDesktopLog,
    backendRuntime,
    backendStartupDiagnostics,
    buildBackendEnv,
    canConnectToPort,
    canReuseExistingBackend,
    createPortAllocator,
    desktopApiKey: DESKTOP_API_KEY,
    getDesktopLogPath,
    isQuitting: () => isQuitting,
    logDesktop,
    logDesktopError,
    onStartupFailure: reportStartupFailure,
    portOccupant,
    quitSignal: quitController.signal,
    readRetainpdfSettings,
    resolveDataRoot,
    setBackendApiPort,
    showErrorBox: (title, detail) => dialog.showErrorBox(title, detail),
    spawn,
    stopChildGracefully,
    waitForPort,
  }));
  root.plugin(createGatewayPlugin({
    buildRuntimeConfig: () => buildDesktopRuntimeConfig(loadDesktopConfig()),
    canConnectToPort,
    createLocalGateway,
    logDesktop,
    logDesktopError,
    resolveFrontendRoot,
  }));
  root.plugin(createWindowsPlugin({
    app,
    BrowserWindow,
    desktopWindows,
    onStartupFailure: reportStartupFailure,
  }));
  return root;
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    setDesktopLogPath(resolveDesktopLogPath());
    appendDesktopLog("========== RetainPDF desktop startup ==========");
    logDesktop(`[desktop] app ready version=${app.getVersion()} packaged=${app.isPackaged} userData=${app.getPath("userData")}`);
    setCloseToTrayHintShown(loadDesktopConfig().closeToTrayHintShown);
    appContext = startDesktopApp();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  isQuitting = true;
  quitController.abort();
  if (shutdownState === "done" || !appContext) {
    return;
  }
  // 清理还没结束，又按了一次 Cmd+Q / 托盘退出：继续等，结束后会自己 quit。
  event.preventDefault();
  if (shutdownState === "stopping") {
    return;
  }
  shutdownState = "stopping";
  logDesktop("[desktop] quitting: disposing plugins (windows → gateway → backend → splash)");
  appContext.fiber.dispose()
    .catch((error) => {
      logDesktopError(`[desktop] plugin teardown failed: ${error?.stack || error}`);
    })
    .finally(() => {
      shutdownState = "done";
      app.quit();
    });
});
