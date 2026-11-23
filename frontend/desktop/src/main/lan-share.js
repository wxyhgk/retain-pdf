// 局域网共享（2026-11-22 起）：同一局域网里的手机、平板、别的电脑用浏览器打开这台电脑上的 RetainPDF。
//
// 和本机网关（local-gateway.js，只听 127.0.0.1、给 Electron 窗口用）分开：
// - 听 0.0.0.0 的另一个端口，默认关，设置里打开；
// - 访问码：二维码 / 链接里带 ?k=<访问码>，第一次打开换成 HttpOnly cookie，之后没有 cookie 一律 401；
//   访问码可以重置，重置后所有已连上的设备立刻失效；
// - 后端的接口密钥只在这里加（x-api-key），浏览器拿不到；转发时去掉浏览器的 Origin / Referer
//   （单机后端只放行本机来源）；
// - 用户定的（2026-11-22）：别的设备能用全部功能，翻译和 OCR 用电脑上存好的 Key。写进页面的运行配置里，
//   所有密钥都换成占位符（@desktop:…），页面照常当 Key 已填好、照常组装提交；转发 JSON 请求时把占位符
//   换成电脑上真正的 Key。Key 不出现在别的设备上，但拿到访问码的人能用它发请求（包括指向别的服务地址），
//   所以访问码只给信任的设备，设置页也这么提示。
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const LAN_SHARE_PREFERRED_PORT = 40100;
const LAN_SHARE_MAX_OFFSET = 20;
const COOKIE_NAME = "retainpdf_lan";
const SENTINEL_PREFIX = "@desktop:";
const MAX_JSON_BODY = 8 * 1024 * 1024;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// 运行配置里名字像密钥的字段（modelApiKey、paddleToken、developerConfig 里的 apiKey……）一律换成占位符，
// 占位符记的是字段在配置里的路径：@desktop:paddleToken、@desktop:developerConfig/profiles/qwen/apiKey。
// developerConfig 没有固定形状，所以按名字认，不按清单认。
const SECRET_KEY_PATTERN = /(api_?key|token|secret|password)$/i;
// 后端接口密钥由网关自己加，不进页面，也不许用占位符换出来。
const NEVER_EXPOSED = new Set(["xApiKey"]);

function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(key) && !NEVER_EXPOSED.has(key);
}

function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

function sameToken(a, b) {
  const left = Buffer.from(`${a || ""}`);
  const right = Buffer.from(`${b || ""}`);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function maskSecrets(value, trail) {
  if (Array.isArray(value)) return value.map((item, index) => maskSecrets(item, [...trail, `${index}`]));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (NEVER_EXPOSED.has(key) && trail.length === 0) continue;
    if (isSecretKey(key) && typeof item === "string") {
      // 空的照旧空：页面能如实提示缺 Key。
      out[key] = item.trim() ? `${SENTINEL_PREFIX}${[...trail, key].map(encodeURIComponent).join("/")}` : item;
    } else {
      out[key] = maskSecrets(item, [...trail, key]);
    }
  }
  return out;
}

/**
 * 写进局域网页面的运行配置：去掉后端密钥（网关自己加），所有密钥换成占位符。
 * apiBase 指回局域网地址本身（同源）。
 */
function sanitizeRuntimeConfig(config, origin) {
  const source = config && typeof config === "object" ? config : {};
  const clean = maskSecrets(JSON.parse(JSON.stringify(source)), []);
  clean.apiBase = origin;
  clean.lanShared = true;
  return clean;
}

/** 占位符 → 电脑上真正的 Key；路径不存在、不是密钥字段、值为空的都返回 undefined。 */
function secretForSentinel(sentinel, config) {
  let trail;
  try {
    trail = sentinel.slice(SENTINEL_PREFIX.length).split("/").map(decodeURIComponent);
  } catch {
    return undefined;
  }
  const last = trail.at(-1) || "";
  if (!isSecretKey(last) || (trail.length === 1 && NEVER_EXPOSED.has(last))) return undefined;
  let node = config;
  for (const key of trail) {
    if (!node || typeof node !== "object" || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return typeof node === "string" && node.trim() ? node : undefined;
}

/** 把 JSON 里所有占位符换成真 Key；有认不出的占位符就抛错（不把占位符发给服务商）。 */
function replaceSentinels(value, config) {
  if (typeof value === "string") {
    if (!value.startsWith(SENTINEL_PREFIX)) return value;
    const secret = secretForSentinel(value, config);
    if (!secret) throw new Error(`unknown or empty desktop secret ${value}`);
    return secret;
  }
  if (Array.isArray(value)) return value.map((item) => replaceSentinels(item, config));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceSentinels(item, config)]));
  }
  return value;
}

// 局域网上不开放的接口（2026-11-22，后端提醒：网关替访问者带后端密钥，等于给了电脑主人的权限）。
// 「全部功能」指看书、上传、翻译、改书库；碰得到电脑本身的管理接口只能在电脑上用：
// 恢复备份（覆盖数据库）、同步文件夹（能指向电脑上任意路径）、上传字体、下载运行资源、任务内部文件、
// 内部接口、账号管理；密钥库只许读（读接口不含明文），不许改。
const LAN_BLOCKED = [
  { prefix: "/api/v1/admin" },
  { prefix: "/api/v1/backups" },
  { prefix: "/api/v1/sync" },
  { prefix: "/api/v1/fonts/upload" },
  { prefix: "/api/v1/runtime-assets/download" },
  { prefix: "/api/v1/internal" },
  { pattern: /^\/api\/v1\/jobs\/[^/]+\/files\/internal(\/|$)/ },
  { prefix: "/api/v1/credentials", methods: ["POST", "PUT", "PATCH", "DELETE"] },
  // 检测服务商、列模型、问一次模型、查余额：单机后端允许连本机和内网地址（为了本机的 Ollama、vLLM），
  // 局域网访客能借它让这台电脑去请求 127.0.0.1 / 内网服务并读回部分返回（SSRF，后端 2026-11-22 提醒）。
  // 只放 GET /providers/ocr（服务商列表），检测留给电脑主人在本机做。
  { prefix: "/api/v1/providers", methods: ["POST", "PUT", "PATCH", "DELETE"] },
];

/** 这个请求在局域网上是不是被拦。路径先解码、去掉重复的斜杠、转小写再比，绕不过去。 */
function isBlockedOnLan(method, rawPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawPath, "http://lan.local").pathname);
  } catch {
    return true;
  }
  pathname = pathname.replace(/\/{2,}/g, "/").toLowerCase();
  const verb = `${method || "GET"}`.toUpperCase();
  return LAN_BLOCKED.some((rule) => {
    if (rule.methods && !rule.methods.includes(verb)) return false;
    if (rule.pattern) return rule.pattern.test(pathname);
    return pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
  });
}

function parseCookies(header) {
  const cookies = {};
  for (const part of `${header || ""}`.split(";")) {
    const index = part.indexOf("=");
    if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return cookies;
}

/** 链接 → 二维码 SVG（qrcode-generator，纯 JS、无依赖）。 */
function qrSvg(text) {
  const qrcode = require("qrcode-generator");
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

/** 本机的局域网 IPv4 地址（跳过回环和链路本地）。 */
function lanAddresses(networkInterfaces = os.networkInterfaces) {
  const result = [];
  for (const [name, entries] of Object.entries(networkInterfaces() || {})) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : `IPv${entry.family}`;
      if (family !== "IPv4" || entry.internal || `${entry.address}`.startsWith("169.254.")) continue;
      result.push({ name, address: entry.address });
    }
  }
  return result;
}

function createLanShare({
  frontendRoot,
  getBackendBase,
  getDesktopApiKey,
  getRuntimeConfig,
  loadState,
  saveState,
  logger = console,
  networkInterfaces = os.networkInterfaces,
  renderQr = qrSvg,
  preferredPort = LAN_SHARE_PREFERRED_PORT,
  host = "0.0.0.0",
}) {
  let server = null;
  let port = 0;
  let state = { enabled: false, token: "", ...(loadState?.() || {}) };

  function persist(patch) {
    state = { ...state, ...patch };
    saveState?.(state);
    return state;
  }

  function ensureToken() {
    if (!state.token) persist({ token: newToken() });
    return state.token;
  }

  function sendText(res, status, body, type = "text/plain; charset=utf-8") {
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  }

  function unauthorized(req, res) {
    if ((req.url || "").startsWith("/api")) {
      sendText(res, 401, JSON.stringify({ code: 401, message: "需要局域网共享的访问码" }), "application/json");
      return;
    }
    sendText(
      res,
      401,
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        + "<title>RetainPDF</title><body style='font-family:system-ui;padding:32px;line-height:1.6'>"
        + "<h2>需要访问码</h2><p>请在电脑上打开 RetainPDF → 设置 → 局域网共享，用手机扫二维码，或打开那里显示的完整链接。</p></body>",
      "text/html; charset=utf-8",
    );
  }

  function serveStatic(req, res) {
    const urlPath = (req.url || "/").split("?")[0];
    let pathname = "";
    try {
      pathname = decodeURIComponent(urlPath);
    } catch {
      sendText(res, 400, "bad request");
      return;
    }
    // 开发态的前端目录里有 runtime-config.local.js（开发者本机的 Key）：局域网上一律给空脚本，
    // 页面照常加载（index.html 引用了它）。点开头的文件也不给。打包版本来就不带它（check-frontend-bundle.mjs）。
    const baseName = path.posix.basename(pathname);
    if (baseName === "runtime-config.local.js") {
      sendText(res, 200, "/* not served over LAN */", "text/javascript; charset=utf-8");
      return;
    }
    if (pathname.split("/").some((part) => part.startsWith("."))) {
      sendText(res, 404, "not found");
      return;
    }
    const root = path.normalize(frontendRoot());
    const filePath = path.normalize(path.join(root, pathname === "/" ? "/index.html" : pathname));
    if (pathname.includes("\0") || (filePath !== root && !filePath.startsWith(root + path.sep))) {
      sendText(res, 400, "bad request");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        sendText(res, 404, "not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      let body = data;
      if (ext === ".html") {
        const origin = `http://${req.headers.host || `127.0.0.1:${port}`}`;
        const config = sanitizeRuntimeConfig(getRuntimeConfig(), origin);
        const snippet = `<script>window.__FRONT_RUNTIME_CONFIG__=Object.assign({},window.__FRONT_RUNTIME_CONFIG__||{},${JSON.stringify(config)});</script>`;
        const html = data.toString("utf8");
        body = Buffer.from(html.includes("</body>") ? html.replace("</body>", `${snippet}</body>`) : `${html}${snippet}`, "utf8");
      }
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      res.end(body);
    });
  }

  function forward(req, res, body) {
    let target;
    try {
      target = new URL(req.url || "/", getBackendBase());
    } catch {
      sendText(res, 503, JSON.stringify({ code: 1, message: "backend not ready" }), "application/json");
      return;
    }
    const headers = { ...req.headers };
    for (const name of ["host", "connection", "origin", "referer", "cookie", "x-api-key", "authorization"]) {
      delete headers[name];
    }
    headers["x-api-key"] = getDesktopApiKey();
    if (body) headers["content-length"] = Buffer.byteLength(body);
    const proxyRequest = http.request(
      { hostname: target.hostname, port: target.port, path: `${target.pathname}${target.search}`, method: req.method, headers },
      (proxyResponse) => {
        const outHeaders = { ...proxyResponse.headers };
        delete outHeaders["content-length"];
        delete outHeaders["access-control-allow-origin"];
        res.writeHead(proxyResponse.statusCode || 502, outHeaders);
        proxyResponse.pipe(res, { end: true });
      },
    );
    proxyRequest.on("error", () => {
      if (!res.headersSent) sendText(res, 502, JSON.stringify({ code: 1, message: "backend unavailable" }), "application/json");
      else res.end();
    });
    if (body) proxyRequest.end(body);
    else req.pipe(proxyRequest, { end: true });
  }

  function proxyApi(req, res) {
    if (!getBackendBase()) {
      sendText(res, 503, JSON.stringify({ code: 1, message: "backend not ready" }), "application/json");
      return;
    }
    const isJson = /application\/json/i.test(`${req.headers["content-type"] || ""}`);
    if (!isJson || !["POST", "PUT", "PATCH"].includes(req.method || "")) {
      forward(req, res, null);
      return;
    }
    // JSON 请求（建任务、检测 Key……）先读完，把占位符换成真 Key 再转发；上传（multipart）照旧流式转发。
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY) {
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.includes(SENTINEL_PREFIX)) {
        forward(req, res, raw);
        return;
      }
      try {
        forward(req, res, JSON.stringify(replaceSentinels(JSON.parse(raw), getRuntimeConfig())));
      } catch (error) {
        logger.warn?.(`[lan-share] rejected request with desktop secret placeholder: ${error?.message || error}`);
        sendText(res, 400, JSON.stringify({ code: 400, message: "电脑上没有设置对应的 Key，请在电脑的设置里填好再试" }), "application/json");
      }
    });
  }

  function handler(req, res) {
    const url = new URL(req.url || "/", "http://lan.local");
    const token = state.token;
    const fromQuery = url.searchParams.get("k");
    if (fromQuery) {
      if (!sameToken(fromQuery, token)) {
        unauthorized(req, res);
        return;
      }
      url.searchParams.delete("k");
      res.writeHead(302, {
        "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
        Location: `${url.pathname}${url.search}`,
        "Cache-Control": "no-store",
      });
      res.end();
      return;
    }
    if (!sameToken(parseCookies(req.headers.cookie)[COOKIE_NAME], token)) {
      unauthorized(req, res);
      return;
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (isBlockedOnLan(req.method, req.url || "/")) {
        sendText(res, 403, JSON.stringify({ code: 403, message: "局域网共享不开放这个功能，请在那台电脑上操作" }), "application/json");
        return;
      }
      proxyApi(req, res);
      return;
    }
    serveStatic(req, res);
  }

  async function listen() {
    for (let offset = 0; offset <= LAN_SHARE_MAX_OFFSET; offset += 1) {
      const candidate = preferredPort ? preferredPort + offset : 0;
      try {
        const created = await new Promise((resolve, reject) => {
          const instance = http.createServer(handler);
          instance.once("error", reject);
          instance.listen(candidate, host, () => {
            instance.removeListener("error", reject);
            resolve(instance);
          });
        });
        return created;
      } catch (error) {
        if (error?.code !== "EADDRINUSE" || !preferredPort) throw error;
      }
    }
    throw new Error(`lan share ports ${preferredPort}..${preferredPort + LAN_SHARE_MAX_OFFSET} all busy`);
  }

  async function start() {
    ensureToken();
    if (server) return status();
    server = await listen();
    port = server.address().port;
    logger.warn?.(`[lan-share] listening on ${host}:${port}`);
    return status();
  }

  async function stop() {
    if (!server) return status();
    const closing = server;
    server = null;
    port = 0;
    // 已连上的长连接（进度流）也断掉，关了就是真的关了。
    closing.closeAllConnections?.();
    await new Promise((resolve) => closing.close(resolve));
    return status();
  }

  async function setEnabled(enabled) {
    persist({ enabled: Boolean(enabled) });
    return enabled ? start() : stop();
  }

  async function resetToken() {
    persist({ token: newToken() });
    // 重新起一次，断掉旧访问码已经连着的长连接。
    if (server) {
      await stop();
      await start();
    }
    return status();
  }

  function status() {
    const running = Boolean(server);
    const addresses = running ? lanAddresses(networkInterfaces) : [];
    return {
      enabled: Boolean(state.enabled),
      running,
      port,
      urls: addresses.map(({ name, address }) => {
        const url = `http://${address}:${port}/?k=${state.token}`;
        return { name, url, display: `http://${address}:${port}`, qrSvg: renderQr(url) };
      }),
    };
  }

  async function startIfEnabled() {
    if (state.enabled) {
      try {
        await start();
      } catch (error) {
        logger.error?.(`[lan-share] failed to start: ${error?.stack || error}`);
      }
    }
  }

  return { start, stop, setEnabled, resetToken, status, startIfEnabled };
}

module.exports = {
  createLanShare,
  sanitizeRuntimeConfig,
  replaceSentinels,
  lanAddresses,
  isBlockedOnLan,
  qrSvg,
  LAN_SHARE_PREFERRED_PORT,
};
