const fs = require("fs");
const path = require("path");

function buildBackendEnv(options = {}) {
  const {
    apiPort,
    backendRoot,
    bundledFontPath,
    bundledPythonHome,
    bundledPythonImportPaths = [],
    bundledTitleBoldFontPath,
    bundledTypstFontDir,
    dataRoot,
    desktopApiKey,
    pythonRuntime,
    rustApiRoot,
    scriptsDir,
    simplePort,
    typstBin,
    typstPackageCachePath,
    typstPackagePath,
  } = options;
  const inheritHostPythonPath = options.inheritHostPythonPath === true;
  const jobsPort = options.jobsPort || 41002;
  const jobsMode = options.jobsMode || process.env.RUST_API_JOBS_MODE || "";
  const jobsSupervise = options.jobsSupervise ?? process.env.RUST_API_JOBS_SUPERVISE;
  const pipelineCommand = options.pipelineCommand || "";
  const entrypointMode = options.entrypointMode || "script";
  const env = {
    ...process.env,
    RUST_API_BIND_HOST: "127.0.0.1",
    RUST_API_PORT: String(apiPort),
    RUST_API_SIMPLE_PORT: String(simplePort),
    RUST_API_KEYS: desktopApiKey,
    RUST_API_DATA_ROOT: dataRoot,
    RUST_API_ROOT: rustApiRoot,
    RUST_API_NORMAL_MAX_BYTES: String(200 * 1024 * 1024),
    RUST_API_NORMAL_MAX_PAGES: "300",
    RUST_API_PROJECT_ROOT: backendRoot,
    RETAIN_OCR_PROVIDER_CONFIG: path.join(backendRoot, "config", "ocr_providers.json"),
    RUST_API_SCRIPTS_DIR: scriptsDir,
    RUST_API_PYTHON_ENTRYPOINT_MODE: entrypointMode,
    ...(pipelineCommand ? { RUST_API_PIPELINE_COMMAND: pipelineCommand } : {}),
    PYTHON_BIN: pythonRuntime.command,
    PYTHONPATH: [
      scriptsDir,
      ...bundledPythonImportPaths,
      inheritHostPythonPath ? process.env.PYTHONPATH || "" : "",
    ].filter(Boolean).join(path.delimiter),
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PDF_TRANSLATOR_TRUST_ENV_PROXY: "1",
    // 保留排版的 Word 导出由 retainpdf2doc（Node 包）生成，Python 流水线会起它。
    //
    // 装好的应用里没有仓库布局，所以必须显式告诉它 CLI 在哪；node 用 Electron 自己
    // （配 ELECTRON_RUN_AS_NODE=1，Python 侧会带上），这样不用再往包里塞一个 node。
    RETAINPDF2DOC_CLI: path.join(backendRoot, "retainpdf2doc", "dist", "cli.mjs"),
    RETAINPDF_NODE_BIN: process.execPath,
    // rpr 排版引擎（render.engine = "rpr"）的位置；node 同样是上面的 Electron。
    RETAIN_RPR_ENGINE_DIR: path.join(backendRoot, "rendering-engine"),
    RETAIN_PDF_FONT_PATH: bundledFontPath,
    RETAIN_PDF_TITLE_BOLD_FONT_PATH: bundledTitleBoldFontPath,
    RETAIN_PDF_TYPST_FONT_DIRS: bundledTypstFontDir,
    RETAIN_PDF_TYPST_FONT_FAMILY: "Source Han Serif SC",
    TYPST_PACKAGE_CACHE_PATH: typstPackageCachePath,
    // retain-jobsd (ADR-002 Phase 3: 壳监督 jobsd，改壳不杀任务)
    ...(jobsMode ? { RUST_API_JOBS_MODE: jobsMode } : {}),
    RUST_API_JOBS_PORT: String(jobsPort),
    ...(jobsSupervise ? { RUST_API_JOBS_SUPERVISE: String(jobsSupervise) } : {}),
  };
  // 命令行 retainpdf 靠这份记录找到桌面版起的后端（~/.retainpdf/run/backend.json）。
  env.RUST_API_WRITE_RUNTIME_FILE = "1";
  applyRetainpdfSettings(env, options.retainpdfSettings);
  if (fs.existsSync(typstPackagePath)) {
    env.TYPST_PACKAGE_PATH = typstPackagePath;
  }
  if (bundledPythonHome) {
    env.PYTHONHOME = bundledPythonHome;
  } else {
    delete env.PYTHONHOME;
  }
  if (fs.existsSync(typstBin)) {
    env.TYPST_BIN = typstBin;
  }
  return env;
}

/**
 * ~/.retainpdf 里的后端设置（`retainpdf config export` 的结果）作为默认值；
 * 已经在环境变量里给了的不覆盖（开发时手动指定的优先）。
 */
function applyRetainpdfSettings(env, settings) {
  if (!settings || typeof settings !== "object") return;
  const put = (name, value) => {
    if (value === null || value === undefined || value === "" || process.env[name]) return;
    env[name] = String(value);
  };
  const backend = settings.backend || {};
  put("RUST_API_MAX_RUNNING_JOBS", backend.max_running_jobs);
  put("RUST_API_SYNC_INTERVAL_SECS", backend.sync_interval_secs);
  put("RUST_API_BACKUP_INTERVAL_HOURS", backend.backup_interval_hours);
}

module.exports = {
  applyRetainpdfSettings,
  buildBackendEnv,
};
