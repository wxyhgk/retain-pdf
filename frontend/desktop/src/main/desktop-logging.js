const fs = require("fs");
const path = require("path");

function createDesktopLogger(app) {
  let desktopLogPath = "";

  function resolveDesktopLogPath() {
    try {
      return path.join(app.getPath("userData"), "logs", "desktop-main.log");
    } catch (_error) {
      return "";
    }
  }

  function getDesktopLogPath() {
    if (!desktopLogPath) {
      desktopLogPath = resolveDesktopLogPath();
    }
    return desktopLogPath;
  }

  function setDesktopLogPath(value) {
    desktopLogPath = value || "";
  }

  function appendDesktopLog(message) {
    const logPath = getDesktopLogPath();
    if (!logPath) {
      return;
    }
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
    } catch (_error) {
      // Startup logging must never block application startup.
    }
  }

  function logDesktop(message) {
    console.log(message);
    appendDesktopLog(message);
  }

  function logDesktopError(message) {
    console.error(message);
    appendDesktopLog(message);
  }

  return {
    appendDesktopLog,
    getDesktopLogPath,
    logDesktop,
    logDesktopError,
    resolveDesktopLogPath,
    setDesktopLogPath,
  };
}

module.exports = {
  createDesktopLogger,
};
