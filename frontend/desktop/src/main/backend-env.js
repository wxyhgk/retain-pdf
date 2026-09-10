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
  const aiServicePort = options.aiServicePort || 41100;
  const aiServiceRoot = options.aiServiceRoot || path.join(backendRoot, "ai_service");
  const jobsPort = options.jobsPort || 41002;
  const jobsMode = options.jobsMode || process.env.RUST_API_JOBS_MODE || "";
  const jobsSupervise = options.jobsSupervise ?? process.env.RUST_API_JOBS_SUPERVISE;
  const pipelineCommand = options.pipelineCommand || "";
  const entrypointMode = options.entrypointMode || "script";
  const bundledAgentCommand = path.join(
    backendRoot,
    "bin",
    process.platform === "win32" ? "retainpdf-agent.exe" : "retainpdf-agent",
  );
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
    // 前端 /api/v1/ai/* 由 Rust 反代到 retainpdf-ai
    RUST_API_AI_SERVICE_BASE: `http://127.0.0.1:${aiServicePort}`,
    // Rust supervises the Python AI process in packaged builds. Its
    // AiServiceConfig reads the RUST_API_* names and then overwrites the
    // child's RETAIN_AI_* values, so both layers must receive the relocated
    // port instead of letting the supervisor fall back to 41100.
    RUST_API_AI_HOST: "127.0.0.1",
    RUST_API_AI_PORT: String(aiServicePort),
    PYTHON_BIN: pythonRuntime.command,
    PYTHONPATH: [
      scriptsDir,
      aiServiceRoot,
      ...bundledPythonImportPaths,
      inheritHostPythonPath ? process.env.PYTHONPATH || "" : "",
    ].filter(Boolean).join(path.delimiter),
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PDF_TRANSLATOR_TRUST_ENV_PROXY: "1",
    RETAIN_PDF_FONT_PATH: bundledFontPath,
    RETAIN_PDF_TITLE_BOLD_FONT_PATH: bundledTitleBoldFontPath,
    RETAIN_PDF_TYPST_FONT_DIRS: bundledTypstFontDir,
    RETAIN_PDF_TYPST_FONT_FAMILY: "Source Han Serif SC",
    TYPST_PACKAGE_CACHE_PATH: typstPackageCachePath,
    // retainpdf-ai（main 进程 spawn 时再叠一层也可）
    RETAIN_AI_HOST: "127.0.0.1",
    RETAIN_AI_PORT: String(aiServicePort),
    RETAIN_AI_API_KEYS: desktopApiKey,
    RETAIN_AI_RUST_API_KEY: desktopApiKey,
    RETAIN_AI_RUST_API_BASE: `http://127.0.0.1:${apiPort}`,
    RETAIN_AI_DATA_ROOT: dataRoot,
    RETAIN_AI_FX_AGENT_CLI_COMMAND:
      process.env.RETAIN_AI_FX_AGENT_CLI_COMMAND || bundledAgentCommand,
    // retain-jobsd (ADR-002 Phase 3: 壳监督 jobsd，改壳不杀任务)
    ...(jobsMode ? { RUST_API_JOBS_MODE: jobsMode } : {}),
    RUST_API_JOBS_PORT: String(jobsPort),
    ...(jobsSupervise ? { RUST_API_JOBS_SUPERVISE: String(jobsSupervise) } : {}),
    ...(process.env.RUST_API_AI_SUPERVISE ? { RUST_API_AI_SUPERVISE: process.env.RUST_API_AI_SUPERVISE } : {}),
  };
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

module.exports = {
  buildBackendEnv,
};
