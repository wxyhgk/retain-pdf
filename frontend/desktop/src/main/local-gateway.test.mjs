import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createLocalGateway } from "./local-gateway.js";

function canProbePort(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function gatewayOptions(extra = {}) {
  return {
    canConnectToPort: canProbePort,
    logger: { warn() {}, error() {} },
    ...extra,
  };
}

function makeFrontendDir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-gateway-"));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

function getText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { agent: false }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on("error", reject);
  });
}

test("serves static files and inlines apiBase into html", async (t) => {
  const root = makeFrontendDir({
    "index.html": "<html><head></head><body>hi</body></html>",
    "app.js": "console.log(1)",
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => "http://127.0.0.1:41001",
    logger: { warn() {}, error() {} },
  }));
  const base = await gateway.start("127.0.0.1", 40001);
  t.after(() => gateway.stop());
  const page = await getText(`${base}/index.html`);
  assert.equal(page.status, 200);
  assert.match(page.body, /Object\.assign\(\{\},window\.__FRONT_RUNTIME_CONFIG__\|\|\{\},\{"apiBase":"http:\/\/127\.0\.0\.1:41001"\}\)/);
  const script = await getText(`${base}/app.js`);
  assert.equal(script.status, 200);
  assert.match(script.headers["content-type"], /javascript/);
  assert.equal(script.body, "console.log(1)");
});

test("rejects path traversal", async (t) => {
  const root = makeFrontendDir({ "index.html": "x" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => "",
    logger: { warn() {}, error() {} },
  }));
  const base = await gateway.start("127.0.0.1", 40001);
  t.after(() => gateway.stop());
  const evil = await getText(`${base}/..%2f..%2fetc%2fpasswd`);
  assert.ok([400, 404].includes(evil.status));
});

test("proxies /api with headers and streams SSE without buffering", async (t) => {
  const backend = http.createServer((req, res) => {
    assert.equal(req.headers["x-api-key"], "k123");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Transfer-Encoding": "chunked" });
    res.write('data: {"a":1}\n\n');
    setTimeout(() => {
      res.end('data: {"b":2}\n\n');
    }, 50);
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  t.after(() => backend.close());
  const backendPort = backend.address().port;
  const root = makeFrontendDir({ "index.html": "x" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => `http://127.0.0.1:${backendPort}`,
    logger: { warn() {}, error() {} },
  }));
  const base = await gateway.start("127.0.0.1", 40001);
  t.after(() => gateway.stop());
  const chunks = [];
  await new Promise((resolve, reject) => {
    const options = { agent: false, headers: { "x-api-key": "k123" } };
    http.get(`${base}/api/v1/ai/ask`, options, (res) => {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/event-stream");
      res.on("data", (chunk) => chunks.push(String(chunk)));
      res.on("end", resolve);
      res.on("error", reject);
    }).on("error", reject);
  });
  assert.match(chunks.join(""), /"a":1/);
  assert.match(chunks.join(""), /"b":2/);
});

test("returns 502 JSON when backend is down", async (t) => {
  const root = makeFrontendDir({ "index.html": "x" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => "http://127.0.0.1:9",
    logger: { warn() {}, error() {} },
  }));
  const base = await gateway.start("127.0.0.1", 40001);
  t.after(() => gateway.stop());
  const res = await getText(`${base}/api/v1/jobs?limit=1`);
  assert.equal(res.status, 502);
  assert.equal(JSON.parse(res.body).code, 1);
});

test("finds next free gateway port", async (t) => {
  const blocker = http.createServer((req, res) => res.end("busy"));
  await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  t.after(() => blocker.close());
  const busyPort = blocker.address().port;
  const root = makeFrontendDir({ "index.html": "x" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => "",
    canConnectToPort: async (_host, port) => port === busyPort,
    logger: { warn() {}, error() {} },
  }));
  const base = await gateway.start("127.0.0.1", busyPort);
  t.after(() => gateway.stop());
  assert.notEqual(base, `http://127.0.0.1:${busyPort}`);
});

test("inlines full runtime config including xApiKey", async (t) => {
  const root = makeFrontendDir({
    "index.html": "<html><head><script>window.__FRONT_RUNTIME_CONFIG__={xApiKey:\"\",ocrProvider:\"mineru\"};</script></head><body>x</body></html>",
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gateway = createLocalGateway(gatewayOptions({
    frontendRoot: root,
    getBackendBase: () => "http://127.0.0.1:41001",
    getRuntimeConfig: () => ({
      apiBase: "http://127.0.0.1:41001",
      xApiKey: "retain-pdf-desktop",
      ocrProvider: "paddle",
    }),
  }));
  const base = await gateway.start("127.0.0.1", 40001);
  t.after(() => gateway.stop());
  const page = await getText(`${base}/index.html`);
  assert.equal(page.status, 200);
  assert.match(page.body, /"xApiKey":"retain-pdf-desktop"/);
  assert.match(page.body, /"ocrProvider":"paddle"/);
});
