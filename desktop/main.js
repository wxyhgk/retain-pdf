const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const DESKTOP_API_KEY = "retain-pdf-desktop";
let backendChild = null;
let backendStopping = false;
let splashWindow = null;
let mainWindow = null;

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
  const bundledWindows = path.join(backendRoot, "python", "python.exe");
  if (fs.existsSync(bundledWindows)) {
    return { command: bundledWindows, bundledHome: path.join(backendRoot, "python") };
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
  const pythonRuntime = resolvePythonRuntime(backendRoot);
  const scriptsDir = path.join(backendRoot, "scripts");
  const typstBin = resolveTypstBinary(backendRoot);
  const bundledFontPath = path.join(backendRoot, "fonts", "DroidSansFallbackFull.ttf");
  const bundledTypstFontDir = path.join(backendRoot, "fonts");
  const dataRoot = path.join(app.getPath("userData"), "data");
  const rustApiRoot = path.join(dataRoot, "rust_api");

  if (!fs.existsSync(backendBin)) {
    throw new Error(`missing bundled backend binary: ${backendBin}`);
  }
  if (!pythonRuntime.command) {
    throw new Error("missing python runtime");
  }
  if (!fs.existsSync(scriptsDir)) {
    throw new Error(`missing bundled scripts directory: ${scriptsDir}`);
  }

  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(rustApiRoot, { recursive: true });
  updateSplashProgress(34, "正在准备工作目录", "正在初始化本地数据目录");

  const env = {
    ...process.env,
    RUST_API_BIND_HOST: "127.0.0.1",
    RUST_API_PORT: "41000",
    RUST_API_SIMPLE_PORT: "42000",
    RUST_API_KEYS: DESKTOP_API_KEY,
    RUST_API_DATA_ROOT: dataRoot,
    RUST_API_ROOT: rustApiRoot,
    RUST_API_NORMAL_MAX_BYTES: String(200 * 1024 * 1024),
    RUST_API_NORMAL_MAX_PAGES: "600",
    RUST_API_PROJECT_ROOT: backendRoot,
    RUST_API_SCRIPTS_DIR: scriptsDir,
    PYTHON_BIN: pythonRuntime.command,
    PYTHONPATH: scriptsDir,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PDF_TRANSLATOR_TRUST_ENV_PROXY: "1",
    PDF_TRANSLATOR_DEEPSEEK_STREAM: "1",
    RETAIN_PDF_FONT_PATH: bundledFontPath,
    RETAIN_PDF_TYPST_FONT_DIRS: bundledTypstFontDir,
    RETAIN_PDF_TYPST_FONT_FAMILY: "Source Han Serif SC",
  };
  if (pythonRuntime.bundledHome) {
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
  await waitForPort("127.0.0.1", 41000, 30000);
  clearInterval(waitingTimer);
  updateSplashProgress(92, "本地服务已就绪", "正在加载主界面");
}

function createWindow() {
  const frontendRoot = path.join(__dirname, "app", "frontend");

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

app.whenReady().then(() => {
  createSplashWindow()
    .then(() => startBundledBackend())
    .then(() => {
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    })
    .catch((error) => {
      dialog.showErrorBox("RetainPDF startup failed", String(error && error.message ? error.message : error));
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendChild && !backendChild.killed) {
    backendStopping = true;
    backendChild.kill();
  }
});
