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

test("阅读页提问的互动块（OpenUI）：说明文件和检查器的位置指向打包进来的那两个目录（prepare-app.mjs 拷的）", () => {
  const path = require("node:path");
  const backendRoot = path.join("/Applications", "RetainPDF.app", "Contents", "Resources", "backend");
  const env = buildBackendEnv({
    apiPort: 41001,
    backendRoot,
    bundledFontPath: "/f.otf",
    bundledPythonImportPaths: [],
    bundledTitleBoldFontPath: "/fb.otf",
    bundledTypstFontDir: "/fonts",
    dataRoot: "/data",
    desktopApiKey: "desktop-key",
    pythonRuntime: { command: "/python" },
    rustApiRoot: "/rust-api",
    scriptsDir: "/pipeline",
    simplePort: 42001,
    typstBin: "/typst",
    typstPackageCachePath: "/typst-cache",
    typstPackagePath: "/typst-packages",
  });
  assert.equal(env.RUST_API_OPENUI_DIR, path.join(backendRoot, "contracts", "openui"));
  assert.equal(env.RUST_API_OPENUI_CHECK_DIR, path.join(backendRoot, "openui-check"));
});
