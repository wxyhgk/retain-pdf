const fs = require("fs");
const path = require("path");
const { createPythonRuntime } = require("./python-runtime");

function createBackendRuntime(app, options = {}) {
  const appRoot = options.appRoot || process.cwd();
  const pythonRuntime = createPythonRuntime({ isPackaged: app.isPackaged });

  function resolveBackendRoot() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "backend");
    }
    return path.join(appRoot, "app", "backend");
  }

  function resolveTypstBinary(backendRoot) {
    const bundledCandidates = process.platform === "win32"
      ? [path.join(backendRoot, "typst", "bin", "typst.exe")]
      : [path.join(backendRoot, "typst", "bin", "typst")];
    const candidates = app.isPackaged
      ? bundledCandidates
      : [
          ...bundledCandidates,
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

  return {
    ...pythonRuntime,
    resolveBackendBinary,
    resolveBackendRoot,
    resolveTypstBinary,
  };
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

module.exports = {
  createBackendRuntime,
};
