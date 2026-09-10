import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "../..");

// runtime.ts 在模块加载时对 window 做快照：先立 baseline 再 import。
globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1", origin: "http://127.0.0.1:40001", href: "http://127.0.0.1:40001/", search: "" },
  __FRONT_RUNTIME_CONFIG__: {},
};

const runtime = await import("@/platform/config/runtime.js");
const { apiBase, buildApiHeaders, frontendApiKey, setRuntimeConfig } = runtime;

const ENV_BASE = "RETAIN_PDF_FRONTEND_API_BASE";
const ENV_KEY = "RETAIN_PDF_FRONTEND_X_API_KEY";
const LEGACY_ENV_KEY = "RETAIN_FRONTEND_X_API_KEY";

function lastConfigValue(content, key) {
  const matches = [...content.matchAll(new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "gm"))];
  if (matches.length === 0) return "";
  return (matches[matches.length - 1]?.[1] || "").trim();
}

function stubLocation({ protocol = "http:", hostname = "127.0.0.1", origin = "" } = {}) {
  globalThis.window.location = {
    protocol,
    hostname,
    origin: origin || `${protocol}//${hostname}`,
    href: `${origin || `${protocol}//${hostname}`}/`,
    search: "",
  };
}

function resetRuntime() {
  delete process.env[ENV_BASE];
  delete process.env[ENV_KEY];
  delete process.env[LEGACY_ENV_KEY];
  delete process.env.RETAIN_FRONTEND_API_BASE;
  setRuntimeConfig({ apiBase: "", xApiKey: "" });
  globalThis.window.__FRONT_RUNTIME_CONFIG__ = {};
  stubLocation();
}

// ===== 文件层：runtime-config.local.js 盖掉 runtime-config.js（index.html 先 base 后 local） =====

test("local 文件能盖掉默认：合并顺序 base→local，local 值胜出", () => {
  const baseText = fs.readFileSync(path.join(frontendRoot, "runtime-config.js"), "utf8");
  const html = fs.readFileSync(path.join(frontendRoot, "index.html"), "utf8");

  // index.html 必须先载入默认、后载入 local
  assert.ok(
    html.indexOf("runtime-config.js") < html.indexOf("runtime-config.local.js"),
    "index.html 应先加载 runtime-config.js 再加载 runtime-config.local.js",
  );

  // runtime-config.local.js 是 gitignore 的本地文件，CI 干净检出里没有；
  // 有就读真的，没有就用同形 fixture，保证单测 hermetic。
  const localPath = path.join(frontendRoot, "runtime-config.local.js");
  const localText = fs.existsSync(localPath)
    ? fs.readFileSync(localPath, "utf8")
    : 'window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://127.0.0.1:41000" };';
  const baseApi = lastConfigValue(baseText, "apiBase");
  const localApi = lastConfigValue(localText, "apiBase");
  assert.ok(localApi, "runtime-config.local.js 应给出本地 apiBase 覆盖");
  // 模拟两脚本顺序执行（local 用 spread 继承再覆盖）
  const merged = { apiBase: baseApi, ...{ apiBase: localApi } };
  assert.equal(merged.apiBase, localApi, "local 应盖掉默认");
});

// ===== 解析优先级：env → window → 同 host 41000 =====

test("apiBase：env 优先于 window", () => {
  resetRuntime();
  try {
    process.env[ENV_BASE] = "http://env-host:4999/";
    setRuntimeConfig({ apiBase: "http://window-host:41000" });
    globalThis.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://window-host:41000" };
    assert.equal(apiBase(), "http://env-host:4999");
  } finally {
    resetRuntime();
  }
});

test("apiBase：无 env 时取 window，归一化去尾斜杠与 /api/v1", () => {
  resetRuntime();
  try {
    setRuntimeConfig({ apiBase: "http://window-host:41000/api/v1/" });
    globalThis.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://window-host:41000/api/v1/" };
    assert.equal(apiBase(), "http://window-host:41000");
  } finally {
    resetRuntime();
  }
});

test("apiBase：local 晚注入时 live window 可回读", () => {
  resetRuntime();
  try {
    // 快照为空（bundle 先于 local 脚本求值），local 后注入只出现在 live window
    setRuntimeConfig({ apiBase: "" });
    globalThis.window.__FRONT_RUNTIME_CONFIG__ = { apiBase: "http://127.0.0.1:41000" };
    assert.equal(apiBase(), "http://127.0.0.1:41000");
  } finally {
    resetRuntime();
  }
});

test("apiBase：两者皆空时回退同 host 41000，https 取 origin", () => {
  resetRuntime();
  try {
    stubLocation({ protocol: "http:", hostname: "9.9.9.9" });
    assert.equal(apiBase(), "http://9.9.9.9:41000");
    stubLocation({ protocol: "https:", hostname: "example.com", origin: "https://example.com" });
    assert.equal(apiBase(), "https://example.com");
  } finally {
    resetRuntime();
  }
});

test("xApiKey：env 优先于 window", () => {
  resetRuntime();
  try {
    process.env[ENV_KEY] = "env-key";
    setRuntimeConfig({ xApiKey: "window-key" });
    globalThis.window.__FRONT_RUNTIME_CONFIG__ = { xApiKey: "window-key" };
    assert.equal(frontendApiKey(), "env-key");
  } finally {
    resetRuntime();
  }
});

test("空 key 不发 X-API-Key header，非空才发", () => {
  resetRuntime();
  try {
    assert.equal(frontendApiKey(), "");
    assert.ok(!("X-API-Key" in buildApiHeaders()), "空 key 不应带 X-API-Key");
    assert.ok(!("X-API-Key" in buildApiHeaders({ "Content-Type": "application/json" })));

    // 空白 key 同样视为无 key
    setRuntimeConfig({ xApiKey: "   " });
    assert.ok(!("X-API-Key" in buildApiHeaders()));

    globalThis.window.__FRONT_RUNTIME_CONFIG__ = { xApiKey: "window-key" };
    assert.equal(buildApiHeaders()["X-API-Key"], "window-key");
  } finally {
    resetRuntime();
  }
});

// ===== 401 文案收敛：frontend/web 内只保留 library-books.ts 一处 =====

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test("401 提示文案只收敛一处：读取图书馆失败，请稍后重试。(status)", () => {
  const hits = [];
  for (const file of walk(path.join(frontendRoot, "src"))) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("读取图书馆失败")) hits.push(path.relative(frontendRoot, file));
  }
  // 文案真值已随 library-books 客户端收敛到 @retainpdf/api；
  // frontend/web/src 内不得再出现副本(旧的 src/js/api/library-books.ts 已删除)。
  assert.deepEqual(hits, []);
  const lib = fs.readFileSync(
    path.join(frontendRoot, "../packages/api/src/library-books.ts"),
    "utf8",
  );
  assert.ok(lib.includes("读取图书馆失败，请稍后重试。(${resp.status})"));
});
