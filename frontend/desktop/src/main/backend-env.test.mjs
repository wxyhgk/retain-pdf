import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildBackendEnv } = require("./backend-env.js");

test("没有 RetainPDF 自己的 AI 了（2026-11-03）：不给 Rust 的 AI 代理和 Python AI 服务任何环境变量", () => {
  const env = buildBackendEnv({
    apiPort: 41001,
    backendRoot: "C:\\RetainPDF\\backend",
    bundledFontPath: "C:\\RetainPDF\\font.otf",
    bundledPythonImportPaths: [],
    bundledTitleBoldFontPath: "C:\\RetainPDF\\font-bold.otf",
    bundledTypstFontDir: "C:\\RetainPDF\\fonts",
    dataRoot: "C:\\RetainPDF\\data",
    desktopApiKey: "desktop-key",
    pythonRuntime: { command: "C:\\RetainPDF\\python.exe" },
    rustApiRoot: "C:\\RetainPDF\\rust-api",
    scriptsDir: "C:\\RetainPDF\\pipeline",
    simplePort: 42001,
    typstBin: "C:\\RetainPDF\\typst.exe",
    typstPackageCachePath: "C:\\RetainPDF\\typst-cache",
    typstPackagePath: "C:\\RetainPDF\\typst-packages",
  });

  const leftovers = Object.keys(env).filter((key) => /^(RUST_API_AI_|RETAIN_AI_)/.test(key) && !(key in process.env));
  assert.deepEqual(leftovers, []);
  assert.equal(env.RUST_API_PORT, "41001");
  assert.doesNotMatch(env.PYTHONPATH, /ai_service/);
});
