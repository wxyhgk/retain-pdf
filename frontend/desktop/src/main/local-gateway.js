// Same-origin local gateway for the desktop frontend.
//
// Problem: the backend port floats (dynamic fallback) while the frontend
// used file:// + baked fallbacks, so a stale 41000 could silently win.
// This gateway removes discovery entirely:
//   - it serves the frontend over http://127.0.0.1:<gateway>/ (any free port;
//     only Electron itself loads this URL),
//   - it inlines the real apiBase into every HTML page, and
//   - it reverse-proxies /api/* to the backend (streaming, no buffering,
//     so SSE survives).
// No new dependencies: plain node:http.

const fs = require("fs");
const http = require("http");
const path = require("path");

const GATEWAY_PREFERRED_PORT = 40001;
const GATEWAY_MAX_OFFSET = 50;

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
};

function createLocalGateway(options = {}) {
  const logger = options.logger || console;
  const frontendRoot = options.frontendRoot || "";
  const getBackendBase = typeof options.getBackendBase === "function" ? options.getBackendBase : () => "";
  // Full runtime config to inline (apiBase, xApiKey, providers, model).
  // Defaults to just the backend base; callers with user config pass more.
  const getRuntimeConfig = typeof options.getRuntimeConfig === "function"
    ? options.getRuntimeConfig
    : () => ({ apiBase: getBackendBase() });
  const canConnectToPort = options.canConnectToPort || null;
  let server = null;
  let baseUrl = "";

  function injectRuntimeConfig(html) {
    // Merge, never replace: the global also carries xApiKey, provider
    // tokens and model settings. Replacing it drops the API key and every
    // authenticated request answers 401.
    const config = getRuntimeConfig() || {};
    const snippet = `<script>window.__FRONT_RUNTIME_CONFIG__=Object.assign({},window.__FRONT_RUNTIME_CONFIG__||{},${JSON.stringify(config)});</script>`;
    if (html.includes("</body>")) {
      return html.replace("</body>", `${snippet}</body>`);
    }
    return `${html}${snippet}`;
  }

  function resolveFilePath(urlPath) {
    let pathname = "";
    try {
      pathname = decodeURIComponent(urlPath.split("?")[0]);
    } catch {
      return null;
    }
    if (pathname.includes("\0")) {
      return null;
    }
    const joined = path.normalize(path.join(frontendRoot, pathname === "/" ? "/index.html" : pathname));
    const root = path.normalize(frontendRoot);
    if (joined !== root && !joined.startsWith(root + path.sep)) {
      return null;
    }
    return joined;
  }

  function serveStatic(req, res, backendBase) {
    const filePath = resolveFilePath(req.url || "/");
    if (!filePath) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("bad request");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      let body = data;
      if (ext === ".html") {
        body = Buffer.from(injectRuntimeConfig(data.toString("utf8"), backendBase), "utf8");
      }
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      res.end(body);
    });
  }

  function proxyApi(req, res, backendBase) {
    let target = null;
    try {
      target = new URL(req.url || "/", backendBase);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 1, message: "bad gateway request" }));
      return;
    }
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    const proxyRequest = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: req.method,
        headers,
      },
      (proxyResponse) => {
        const outHeaders = { ...proxyResponse.headers };
        // Never let intermediaries buffer event streams.
        delete outHeaders["content-length"];
        res.writeHead(proxyResponse.statusCode || 502, outHeaders);
        proxyResponse.pipe(res, { end: true });
      },
    );
    proxyRequest.on("timeout", () => {
      proxyRequest.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 1, message: "backend gateway timeout" }));
      }
    });
    proxyRequest.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 1, message: "backend unavailable" }));
      } else {
        res.end();
      }
    });
    req.pipe(proxyRequest, { end: true });
  }

  function requestHandler(req, res) {
    const backendBase = getBackendBase();
    const urlPath = (req.url || "/").split("?")[0];
    if (urlPath === "/api" || urlPath.startsWith("/api/")) {
      if (!backendBase) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: 1, message: "backend not ready" }));
        return;
      }
      proxyApi(req, res, backendBase);
      return;
    }
    serveStatic(req, res, backendBase);
  }

  async function findFreePort(host, preferred) {
    for (let offset = 0; offset <= GATEWAY_MAX_OFFSET; offset += 1) {
      const port = preferred + offset;
      if (!canConnectToPort) {
        return port;
      }
      try {
        const busy = await canConnectToPort(host, port);
        if (!busy) {
          return port;
        }
      } catch {
        return port;
      }
    }
    throw new Error(`网关端口 ${preferred} 起 ${GATEWAY_MAX_OFFSET} 个端口均被占用`);
  }

  // Start listening. Resolves to the base URL, e.g. http://127.0.0.1:40001.
  // getBackendBase is read per request, so backend restarts need no gateway restart.
  async function start(host = "127.0.0.1", preferredPort = GATEWAY_PREFERRED_PORT) {
    if (server) {
      return baseUrl;
    }
    const port = await findFreePort(host, preferredPort);
    await new Promise((resolve, reject) => {
      const created = http.createServer(requestHandler);
      created.once("error", reject);
      created.listen(port, host, () => {
        created.removeListener("error", reject);
        server = created;
        baseUrl = `http://${host}:${port}`;
        logger.warn(`[desktop] local gateway listening on ${baseUrl}`);
        resolve();
      });
    });
    return baseUrl;
  }

  async function stop() {
    if (!server) {
      return;
    }
    const closing = server;
    server = null;
    baseUrl = "";
    await new Promise((resolve) => closing.close(resolve));
  }

  function getBaseUrl() {
    return baseUrl;
  }

  return {
    getBaseUrl,
    injectRuntimeConfig,
    start,
    stop,
  };
}

module.exports = {
  GATEWAY_MAX_OFFSET,
  GATEWAY_PREFERRED_PORT,
  createLocalGateway,
};
