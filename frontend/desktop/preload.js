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
