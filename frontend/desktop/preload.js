const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("error", (event) => {
  ipcRenderer.send("desktop:renderer-issue", {
    type: "error",
    message: event?.message || "unknown renderer error",
    filename: event?.filename || "",
    lineno: event?.lineno || 0,
    colno: event?.colno || 0,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  ipcRenderer.send("desktop:renderer-issue", {
    type: "unhandledrejection",
    message: typeof reason === "string"
      ? reason
      : (reason?.message || String(reason || "unknown rejection")),
  });
});

contextBridge.exposeInMainWorld("retainPdfDesktop", {
  platform: process.platform,
  invoke(command, args = {}) {
    return ipcRenderer.invoke("desktop:invoke", command, args);
  },
  loadDesktopConfig() {
    return ipcRenderer.invoke("desktop:invoke", "load_desktop_config");
  },
  saveDesktopConfig(payload = {}) {
    return ipcRenderer.invoke("desktop:invoke", "save_desktop_config", { payload });
  },
  // 页面把 React 出错（带组件栈）报上来，主进程写进 desktop-main.log（web/src/platform/desktop/renderer-issue.ts）。
  reportRendererIssue(payload = {}) {
    ipcRenderer.send("desktop:renderer-issue", {
      type: String(payload?.type || "react"),
      message: String(payload?.message || ""),
      stack: String(payload?.stack || ""),
      componentStack: String(payload?.componentStack || ""),
    });
  },
  // 自动更新的状态推送（src/main/app-updater.js 的 desktop:update-status）；返回退订函数。
  onUpdateStatus(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:update-status", listener);
    return () => {
      ipcRenderer.removeListener("desktop:update-status", listener);
    };
  },
  onStartupProgress(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("startup-progress", listener);
    return () => {
      ipcRenderer.removeListener("startup-progress", listener);
    };
  },
});

contextBridge.exposeInMainWorld("__TAURI_INTERNALS__", {
  invoke(command, args = {}) {
    return window.retainPdfDesktop.invoke(command, args);
  },
});
