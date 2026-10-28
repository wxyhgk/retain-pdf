// 渲染进程 → 主进程的 IPC：桌面配置、打开目录、命令行工具、选文件夹、把窗口拿到前面，以及渲染进程报错。
// 不依赖别的服务，插件树一建好就注册；dispose 时撤掉。
const fs = require("fs");
const path = require("path");

function createIpcPlugin({
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
}) {
  async function openDirectory(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const result = await shell.openPath(dir);
    if (result) {
      throw new Error(result);
    }
  }

  async function invoke(event, command, args = {}) {
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
        const outputDir = path.join(resolveDataRoot(), "jobs");
        await openDirectory(outputDir);
        return { ok: true, outputDir };
      }
      case "open_backup_directory": {
        // 设置 → 备份：数据库备份放在数据目录的 backups/db（见 retainpdf-db 的 backup.rs）。
        const backupDir = path.join(resolveDataRoot(), "backups", "db");
        await openDirectory(backupDir);
        return { ok: true, backupDir };
      }
      case "cli_status":
        return cliInstaller.status();
      case "install_cli":
        return cliInstaller.install();
      case "pick_directory": {
        // 同步设置里「选择文件夹」：系统的文件夹选择框，可新建文件夹。取消时返回 path: null。
        const owner = BrowserWindow.getFocusedWindow() || undefined;
        const result = await dialog.showOpenDialog(owner, {
          title: `${args?.title || "选择文件夹"}`,
          defaultPath: typeof args?.defaultPath === "string" && args.defaultPath ? args.defaultPath : undefined,
          properties: ["openDirectory", "createDirectory"],
        });
        return { path: result.canceled ? null : (result.filePaths[0] || null) };
      }
      case "focus_window": {
        // 点「任务跑完」的系统通知：窗口可能缩在托盘、最小化了，或者被别的窗口挡着。
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return { ok: false };
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        return { ok: true };
      }
      default:
        throw new Error(`unsupported desktop command: ${command}`);
    }
  }

  function onRendererIssue(_event, payload = {}) {
    const type = payload?.type || "unknown";
    const message = payload?.message || "unknown renderer issue";
    const filename = payload?.filename || "";
    const lineno = payload?.lineno || 0;
    const colno = payload?.colno || 0;
    logDesktopError(`[desktop][renderer-issue] type=${type} file=${filename} line=${lineno} col=${colno} message=${message}`);
  }

  function ipc(ctx) {
    ctx.effect(() => {
      ipcMain.handle("desktop:invoke", invoke);
      return () => ipcMain.removeHandler("desktop:invoke");
    }, "ipc desktop:invoke");
    ctx.effect(() => {
      ipcMain.on("desktop:renderer-issue", onRendererIssue);
      return () => ipcMain.removeListener("desktop:renderer-issue", onRendererIssue);
    }, "ipc desktop:renderer-issue");
  }
  return ipc;
}

module.exports = { createIpcPlugin };
