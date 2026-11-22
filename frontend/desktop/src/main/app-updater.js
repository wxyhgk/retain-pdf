// 桌面端自动更新（electron-updater，2026-11-22 起）。
//
// - 只在打包后的 Windows（NSIS 安装版）和 Mac（Developer ID 签名 + 公证）上启用；Linux 的 deb、开发态
//   返回 supported:false，页面退回原来的「查 GitHub Releases、跳转下载」。
// - 启动后等一会儿检查一次，之后每 6 小时一次；有新版自动后台下载（按 .blockmap 只下变了的部分），
//   下好后页面提示「重启即可更新」。用户不点也行：下次正常退出时自动装（autoInstallOnAppQuit）。
// - 版本号是日期（2026.11.22，同一天再发是 2026.11.2201），electron-updater 按 semver 比大小。
// - 「重启并更新」调 quitAndInstall：走正常退出（before-quit 先收尾后端子进程），再由安装程序替换。
//
// 不直接 require electron：依赖都从参数传进来，测试里换成假的。
const UPDATE_STATUS_CHANNEL = "desktop:update-status";
const DEFAULT_CHECK_DELAY_MS = 30 * 1000;
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function notesText(releaseNotes) {
  if (typeof releaseNotes === "string") return releaseNotes;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes.map((item) => `${item?.note || ""}`.trim()).filter(Boolean).join("\n\n");
  }
  return "";
}

function createAppUpdater({
  platform,
  isPackaged,
  currentVersion = "",
  loadAutoUpdater,
  send = () => {},
  log = () => {},
  logError = () => {},
  timers = { setTimeout, clearTimeout, setInterval, clearInterval },
  checkDelayMs = DEFAULT_CHECK_DELAY_MS,
  checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
}) {
  const supported = Boolean(isPackaged) && (platform === "win32" || platform === "darwin");
  let updater = null;
  let started = false;
  let delayTimer = null;
  let intervalTimer = null;
  let current = {
    supported,
    state: "idle",
    currentVersion,
    version: "",
    notes: "",
    percent: 0,
    error: "",
  };

  function publish(patch) {
    current = { ...current, ...patch };
    send(UPDATE_STATUS_CHANNEL, current);
    return current;
  }

  function attach() {
    if (updater || !supported) return updater;
    updater = loadAutoUpdater();
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.logger = {
      info: (message) => log(`[updater] ${message}`),
      warn: (message) => log(`[updater] warn ${message}`),
      error: (message) => logError(`[updater] ${message}`),
      debug: () => {},
    };
    updater.on("checking-for-update", () => publish({ state: "checking", error: "" }));
    updater.on("update-available", (info) => publish({
      state: "downloading",
      version: `${info?.version || ""}`,
      notes: notesText(info?.releaseNotes),
      percent: 0,
    }));
    updater.on("download-progress", (progress) => publish({
      state: "downloading",
      percent: Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0))),
    }));
    updater.on("update-downloaded", (info) => publish({
      state: "downloaded",
      version: `${info?.version || current.version}`,
      notes: notesText(info?.releaseNotes) || current.notes,
      percent: 100,
    }));
    updater.on("update-not-available", (info) => publish({
      state: "latest",
      version: `${info?.version || ""}`,
      notes: "",
      percent: 0,
    }));
    updater.on("error", (error) => {
      logError(`[updater] ${error?.stack || error}`);
      publish({ state: "error", error: `${error?.message || error || "更新失败"}` });
    });
    return updater;
  }

  async function check() {
    if (!supported) return current;
    // 正在下载或已经下好：不重复检查，直接告诉页面现在的状态。
    if (current.state === "downloading" || current.state === "downloaded") return current;
    try {
      publish({ state: "checking", error: "" });
      await attach().checkForUpdates();
    } catch (error) {
      logError(`[updater] check failed: ${error?.stack || error}`);
      publish({ state: "error", error: `${error?.message || error || "检查更新失败"}` });
    }
    return current;
  }

  function start() {
    if (!supported || started) return;
    started = true;
    log(`[updater] enabled platform=${platform} version=${currentVersion}`);
    delayTimer = timers.setTimeout(() => { void check(); }, checkDelayMs);
    intervalTimer = timers.setInterval(() => { void check(); }, checkIntervalMs);
  }

  function install() {
    if (!supported || current.state !== "downloaded" || !updater) {
      return { ok: false, status: current };
    }
    log(`[updater] quit and install ${current.version}`);
    // isSilent=false：Windows 上显示安装进度；isForceRunAfter=true：装完重新打开。
    updater.quitAndInstall(false, true);
    return { ok: true, status: current };
  }

  function dispose() {
    if (delayTimer) timers.clearTimeout(delayTimer);
    if (intervalTimer) timers.clearInterval(intervalTimer);
    delayTimer = null;
    intervalTimer = null;
  }

  return {
    start,
    check,
    install,
    dispose,
    status: () => current,
  };
}

module.exports = { createAppUpdater, UPDATE_STATUS_CHANNEL, notesText };
