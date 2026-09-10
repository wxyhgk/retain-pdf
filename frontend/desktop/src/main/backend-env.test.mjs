import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildBackendEnv } = require("./backend-env.js");

test("passes a relocated AI port to both Rust proxy and supervised Python child", () => {
  const env = buildBackendEnv({
    apiPort: 41001,
    aiServicePort: 41101,
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

  assert.equal(env.RUST_API_AI_SERVICE_BASE, "http://127.0.0.1:41101");
  assert.equal(env.RUST_API_AI_HOST, "127.0.0.1");
  assert.equal(env.RUST_API_AI_PORT, "41101");
  assert.equal(env.RETAIN_AI_HOST, "127.0.0.1");
  assert.equal(env.RETAIN_AI_PORT, "41101");
});
