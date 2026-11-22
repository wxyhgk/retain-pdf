import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createLanShare, sanitizeRuntimeConfig, replaceSentinels, lanAddresses, qrSvg } = require("./lan-share.js");

const RUNTIME = {
  apiBase: "http://127.0.0.1:41000",
  xApiKey: "desktop-backend-key",
  modelApiKey: "sk-translate-real",
  paddleToken: "paddle-real",
  mineruToken: "",
  glmOcrToken: "glm-real",
  ocrProvider: "paddle",
  model: "glm-5.3-flash",
  developerConfig: { profiles: { anthropic: { apiKey: "sk-ant-real", model: "claude-haiku-5-5" }, qwen: { apiKey: "" } }, keys: [{ api_key: "list-real" }] },
};

async function withBackend(run) {
  const received = [];
  const backend = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ code: 0, data: { ok: true } }));
    });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const frontendRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lan-share-front-"));
  fs.writeFileSync(path.join(frontendRoot, "index.html"), "<html><body>home</body></html>");
  fs.writeFileSync(path.join(frontendRoot, "runtime-config.local.js"), "window.X={modelApiKey:'dev-local-real'}");
  fs.writeFileSync(path.join(frontendRoot, ".env"), "SECRET=dot-real");
  let saved = null;
  const share = createLanShare({
    frontendRoot: () => frontendRoot,
    getBackendBase: () => `http://127.0.0.1:${backend.address().port}`,
    getDesktopApiKey: () => "desktop-backend-key",
    getRuntimeConfig: () => RUNTIME,
    loadState: () => ({}),
    saveState: (state) => { saved = state; },
    logger: { warn() {}, error() {} },
    preferredPort: 0,
    host: "127.0.0.1",
    networkInterfaces: () => ({ en0: [{ family: "IPv4", address: "192.168.1.20", internal: false }] }),
  });
  try {
    await run({ share, received, saved: () => saved });
  } finally {
    await share.stop();
    await new Promise((resolve) => backend.close(resolve));
    fs.rmSync(frontendRoot, { recursive: true, force: true });
  }
}

function request(port, { method = "GET", urlPath = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    // agent:false：每次新连接。默认 agent 会复用 keep-alive 连接，关掉网关后拿到的是旧连接的 hang up。
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body) req.end(body);
    else req.end();
  });
}

test("runtime config for LAN pages carries no secrets: backend key dropped, every key replaced by a placeholder", () => {
  const clean = sanitizeRuntimeConfig(RUNTIME, "http://192.168.1.20:40100");
  assert.equal(clean.xApiKey, undefined);
  assert.equal(clean.apiBase, "http://192.168.1.20:40100");
  assert.equal(clean.modelApiKey, "@desktop:modelApiKey");
  assert.equal(clean.paddleToken, "@desktop:paddleToken");
  assert.equal(clean.mineruToken, "", "没设的照旧空，页面能如实提示缺 Key");
  assert.equal(clean.glmOcrToken, "@desktop:glmOcrToken");
  assert.equal(clean.developerConfig.profiles.anthropic.apiKey, "@desktop:developerConfig/profiles/anthropic/apiKey");
  assert.equal(clean.developerConfig.profiles.anthropic.model, "claude-haiku-5-5");
  assert.equal(clean.developerConfig.profiles.qwen.apiKey, "");
  assert.equal(clean.developerConfig.keys[0].api_key, "@desktop:developerConfig/keys/0/api_key");
  assert.equal(clean.model, "glm-5.3-flash");
  assert.equal(clean.lanShared, true);
  assert.equal(JSON.stringify(clean).includes("real"), false);
  assert.equal(RUNTIME.modelApiKey, "sk-translate-real", "不改原配置");
});

test("placeholders in request JSON are swapped for the desktop's real keys; unknown ones are refused", () => {
  const body = {
    translation: { api_key: "@desktop:developerConfig/profiles/anthropic/apiKey", model: "claude-haiku-5-5" },
    ocr: { provider: "paddle", paddle_token: "@desktop:paddleToken" },
    note: "plain",
  };
  assert.deepEqual(replaceSentinels(body, RUNTIME), {
    translation: { api_key: "sk-ant-real", model: "claude-haiku-5-5" },
    ocr: { provider: "paddle", paddle_token: "paddle-real" },
    note: "plain",
  });
  assert.equal(replaceSentinels({ k: "@desktop:modelApiKey" }, RUNTIME).k, "sk-translate-real");
  assert.deepEqual(replaceSentinels(["@desktop:developerConfig/keys/0/api_key"], RUNTIME), ["list-real"]);
  // 没设的、不存在的、不是密钥字段的、后端接口密钥：都拒掉
  for (const bad of ["@desktop:mineruToken", "@desktop:developerConfig/profiles/qwen/apiKey", "@desktop:whatever",
    "@desktop:model", "@desktop:xApiKey", "@desktop:developerConfig/profiles/anthropic/model", "@desktop:%E0%A4%A"]) {
    assert.throws(() => replaceSentinels({ k: bad }, RUNTIME), /desktop secret/, bad);
  }
});

test("QR code for the link is an SVG", () => {
  const svg = qrSvg("http://192.168.1.20:40100/?k=abc");
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  assert.notEqual(qrSvg("http://192.168.1.20:40100/?k=abd"), svg);
});

test("only LAN IPv4 addresses are offered (no loopback / link-local / IPv6)", () => {
  const found = lanAddresses(() => ({
    lo0: [{ family: "IPv4", address: "127.0.0.1", internal: true }],
    en0: [{ family: "IPv4", address: "192.168.1.20", internal: false }, { family: "IPv6", address: "fe80::1", internal: false }],
    en5: [{ family: 4, address: "10.0.0.8", internal: false }, { family: "IPv4", address: "169.254.3.3", internal: false }],
  }));
  assert.deepEqual(found.map((item) => item.address), ["192.168.1.20", "10.0.0.8"]);
});

test("gateway: no access code → 401; the code in the link becomes an HttpOnly cookie; pages get the sanitized config", async () => {
  await withBackend(async ({ share, saved }) => {
    const status = await share.setEnabled(true);
    assert.equal(status.running, true);
    assert.equal(saved().enabled, true);
    const token = saved().token;
    assert.match(token, /^[0-9a-f]{48}$/);
    assert.equal(status.urls[0].url, `http://192.168.1.20:${status.port}/?k=${token}`);
    assert.equal(status.urls[0].display, `http://192.168.1.20:${status.port}`);
    assert.match(status.urls[0].qrSvg, /^<svg[\s\S]*<\/svg>$/);

    assert.equal((await request(status.port)).status, 401);
    assert.equal((await request(status.port, { urlPath: "/api/v1/jobs" })).status, 401);
    assert.equal((await request(status.port, { urlPath: "/?k=wrong" })).status, 401);

    const login = await request(status.port, { urlPath: `/reader.html?job=1&k=${token}` });
    assert.equal(login.status, 302);
    assert.equal(login.headers.location, "/reader.html?job=1", "访问码不留在地址栏");
    assert.match(login.headers["set-cookie"][0], /HttpOnly/);
    const cookie = login.headers["set-cookie"][0].split(";")[0];

    const page = await request(status.port, { headers: { cookie } });
    assert.equal(page.status, 200);
    assert.match(page.body, /"lanShared":true/);
    assert.match(page.body, /"modelApiKey":"@desktop:modelApiKey"/);
    assert.doesNotMatch(page.body, /-real|desktop-backend-key|xApiKey/);

    const local = await request(status.port, { urlPath: "/runtime-config.local.js", headers: { cookie } });
    assert.equal(local.status, 200, "页面引用了它，给空脚本");
    assert.doesNotMatch(local.body, /real/, "开发态的本机配置不给局域网");
    assert.equal((await request(status.port, { urlPath: "/.env", headers: { cookie } })).status, 404);
    assert.equal((await request(status.port, { urlPath: "/%2e%2e/etc/passwd", headers: { cookie } })).status, 404);
  });
});

test("gateway: adds the backend key, strips the browser's Origin, swaps placeholders in JSON bodies", async () => {
  await withBackend(async ({ share, received, saved }) => {
    const { port } = await share.setEnabled(true);
    const cookie = `retainpdf_lan=${saved().token}`;
    const job = await request(port, {
      method: "POST",
      urlPath: "/api/v1/jobs",
      headers: { cookie, "content-type": "application/json", origin: "http://192.168.1.50:5173", "x-api-key": "from-phone" },
      body: JSON.stringify({ translation: { api_key: "@desktop:modelApiKey" }, ocr: { paddle_token: "@desktop:paddleToken" } }),
    });
    assert.equal(job.status, 200);
    const forwarded = received.at(-1);
    assert.equal(forwarded.headers["x-api-key"], "desktop-backend-key");
    assert.equal(forwarded.headers.origin, undefined);
    assert.equal(forwarded.headers.cookie, undefined);
    assert.deepEqual(JSON.parse(forwarded.body), { translation: { api_key: "sk-translate-real" }, ocr: { paddle_token: "paddle-real" } });
    assert.equal(job.headers["access-control-allow-origin"], undefined);

    const refused = await request(port, {
      method: "POST",
      urlPath: "/api/v1/jobs",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ocr: { mineru_token: "@desktop:mineruToken" } }),
    });
    assert.equal(refused.status, 400, "电脑上没设的 Key 不转发占位符");
    assert.equal(received.length, 1);

    const get = await request(port, { urlPath: "/api/v1/jobs?limit=5", headers: { cookie } });
    assert.equal(get.status, 200);
    assert.equal(received.at(-1).url, "/api/v1/jobs?limit=5");
  });
});

test("resetting the access code locks out devices that used the old one; turning it off stops listening", async () => {
  await withBackend(async ({ share, saved }) => {
    await share.setEnabled(true);
    const oldCookie = `retainpdf_lan=${saved().token}`;
    const after = await share.resetToken();
    assert.notEqual(saved().token, oldCookie.split("=")[1]);
    assert.equal((await request(after.port, { headers: { cookie: oldCookie } })).status, 401);
    assert.equal((await request(after.port, { headers: { cookie: `retainpdf_lan=${saved().token}` } })).status, 200);

    const off = await share.setEnabled(false);
    assert.equal(off.running, false);
    assert.deepEqual(off.urls, []);
    assert.equal(saved().enabled, false);
    await assert.rejects(request(after.port), /ECONNREFUSED/);
  });
});
