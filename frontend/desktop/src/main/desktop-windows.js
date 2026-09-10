const fs = require("fs");
const path = require("path");
const { BrowserWindow, Menu, Tray, dialog, nativeImage, shell } = require("electron");

function createDesktopWindows(app, options = {}) {
  const appRoot = options.appRoot || process.cwd();
  const loadDesktopConfig = options.loadDesktopConfig;
  const saveDesktopConfig = options.saveDesktopConfig;
  const logDesktop = options.logDesktop || console.log;
  const logDesktopError = options.logDesktopError || console.error;
  const updateSplashProgress = options.updateSplashProgress || (() => {});
  const isQuitting = typeof options.isQuitting === "function" ? options.isQuitting : () => false;
  const markQuitting = typeof options.markQuitting === "function" ? options.markQuitting : () => {};
  let mainWindow = null;
  let tray = null;
  let closeToTrayHintShown = false;

  function resolveWindowIcon() {
    return path.join(appRoot, "assets", "RetainPDF-logo.png");
  }

  /**
   * Menu bar / system tray icon.
   * Issue #76: using the 1024² window logo made the macOS menu-bar glyph huge.
   * Prefer dedicated trayTemplate assets (16 + @2x 32); fall back to a resized logo.
   * On macOS, template images follow light/dark menu bar automatically.
   */
  function resolveTrayIcon() {
    const trayDir = path.join(appRoot, "assets", "tray");
    const templatePath = path.join(trayDir, "trayTemplate.png");
    if (process.platform === "darwin" && fs.existsSync(templatePath)) {
      // Path must end with "Template.png" so Electron also picks @2x for retina.
      return templatePath;
    }

    const logoPath = resolveWindowIcon();
    let image = nativeImage.createFromPath(logoPath);
    if (image.isEmpty() && fs.existsSync(templatePath)) {
      image = nativeImage.createFromPath(templatePath);
    }
    if (image.isEmpty()) {
      return logoPath;
    }

    // Logical size ~16–18 pt in menu bar / notification area.
    const size = process.platform === "darwin" ? 18 : 16;
    const resized = image.resize({ width: size, height: size, quality: "best" });
    if (process.platform === "darwin") {
      resized.setTemplateImage(true);
    }
    return resized;
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
    if (typeof loadDesktopConfig !== "function" || typeof saveDesktopConfig !== "function") {
      closeToTrayHintShown = true;
      return;
    }
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
    const trayIcon = resolveTrayIcon();
    tray = new Tray(trayIcon);
    // Ensure template mode even if path-based load did not auto-mark it.
    if (process.platform === "darwin" && trayIcon && typeof trayIcon !== "string") {
      try {
        tray.setImage(trayIcon);
      } catch (_err) {
        /* ignore */
      }
    }
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
            markQuitting();
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

  function createWindow() {
    const frontendRoot = resolveFrontendRoot();
    logDesktop(`[desktop] creating main window frontendRoot=${frontendRoot}`);

    mainWindow = new BrowserWindow({
      width: 1480,
      height: 960,
      minWidth: 1200,
      minHeight: 760,
      autoHideMenuBar: true,
      show: false,
      icon: resolveWindowIcon(),
      webPreferences: {
        preload: path.join(appRoot, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const indexPath = path.join(frontendRoot, "index.html");
    const frontendBaseUrl = typeof options.getFrontendBaseUrl === "function"
      ? options.getFrontendBaseUrl()
      : "";
    if (frontendBaseUrl) {
      // Served by the local gateway: same origin for pages and /api/*, and
      // the real apiBase is inlined into the HTML. Falls back to file below.
      const indexUrl = `${String(frontendBaseUrl).replace(/\/+$/, "")}/index.html`;
      logDesktop(`[desktop] loading frontend via gateway ${indexUrl}`);
      mainWindow.loadURL(indexUrl);
    } else {
      logDesktop(`[desktop] loading frontend index=${indexPath}`);
      mainWindow.loadFile(indexPath);
    }

    mainWindow.on("close", (event) => {
      if (isQuitting()) {
        return;
      }
      event.preventDefault();
      hideMainWindowToTray();
    });

    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      logDesktop(`[desktop][renderer][level=${level}] ${sourceId || "unknown"}:${line || 0} ${message || ""}`);
    });

    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      const detail = `code=${errorCode} url=${validatedURL || "unknown"} error=${errorDescription || "unknown"}`;
      logDesktopError(`[desktop] renderer load failed: ${detail}`);
      dialog.showErrorBox("RetainPDF 页面加载失败", detail);
    });

    mainWindow.webContents.on("render-process-gone", (_event, details) => {
      const detail = `reason=${details?.reason || "unknown"} exitCode=${details?.exitCode ?? "unknown"}`;
      logDesktopError(`[desktop] renderer process gone: ${detail}`);
      dialog.showErrorBox("RetainPDF 渲染进程异常退出", detail);
    });

    mainWindow.webContents.once("did-finish-load", () => {
      logDesktop("[desktop] frontend loaded; showing main window");
      updateSplashProgress(100, "准备完成", "正在进入主界面");
      mainWindow.show();
      if (typeof options.closeSplashWindow === "function") {
        options.closeSplashWindow();
      }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      const target = `${url || ""}`.trim();
      if (!target || target === "about:blank") {
        return { action: "deny" };
      }
      // 应用内页面：在主窗口打开，禁止 shell.openExternal（否则像「乱跳浏览器」）。
      // 也不要 silent deny，否则对照阅读入口会「点了没反应」。
      try {
        const next = new URL(target);
        let current = null;
        try {
          current = new URL(mainWindow.webContents.getURL() || "http://127.0.0.1/");
        } catch {
          current = null;
        }
        const sameOrigin = current && next.origin === current.origin;
        const isAppHtml = /\/(reader|index|detail)\.html(?:[?#]|$)/i.test(next.pathname);
        const isLocalDev = /^(localhost|127\.0\.0\.1)$/i.test(next.hostname || "");
        if (next.protocol === "file:" || sameOrigin || (isLocalDev && isAppHtml)) {
          logDesktop(`[desktop] in-app navigate (no openExternal): ${target}`);
          // 主窗口内导航，保证「对照阅读」等入口可用
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(target).catch((err) => {
              logDesktopError(`[desktop] loadURL failed: ${err?.message || err}`);
            });
          }
          return { action: "deny" };
        }
        if (next.protocol === "http:" || next.protocol === "https:") {
          shell.openExternal(target);
        }
      } catch (err) {
        logDesktopError(`[desktop] windowOpenHandler parse failed: ${err?.message || err}`);
      }
      return { action: "deny" };
    });
  }




  function showExistingDesktopWindow(splashWindow) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow();
      return true;
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      if (splashWindow.isMinimized()) {
        splashWindow.restore();
      }
      splashWindow.show();
      splashWindow.focus();
      return true;
    }
    return false;
  }

  function hasLiveMainWindow() {
    return !!mainWindow && !mainWindow.isDestroyed();
  }

  function setCloseToTrayHintShown(value) {
    closeToTrayHintShown = !!value;
  }

  function resolveFrontendRoot() {
    const generatedFrontendRoot = path.join(appRoot, "app", "frontend");
    if (app.isPackaged) {
      return generatedFrontendRoot;
    }
    if (fs.existsSync(path.join(generatedFrontendRoot, "index.html"))) {
      return generatedFrontendRoot;
    }
    const sourceFrontendRoot = path.resolve(appRoot, "..", "frontend");
    if (fs.existsSync(path.join(sourceFrontendRoot, "index.html"))) {
      return sourceFrontendRoot;
    }
    return generatedFrontendRoot;
  }

  return {
    createTray,
    createWindow,
    hasLiveMainWindow,
    resolveFrontendRoot,
    resolveWindowIcon,
    setCloseToTrayHintShown,
    showExistingDesktopWindow,
    showMainWindow,
  };
}

module.exports = {
  createDesktopWindows,
};
