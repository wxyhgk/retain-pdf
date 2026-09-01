#!/usr/bin/env python3
"""RetainPDF 本地部署前端服务 + 反向代理。

职责：
  1. 静态托管 frontend/ 目录（前端页面、JS、node_modules 等）
  2. 把 /health 与 /api/* 反向代理到 Rust API，并自动注入 X-API-Key

这样前端与后端同源（无需 CORS），且浏览器原生下载（<a href> 直接导航）
也能带上鉴权头，避免「下载 401 missing X-API-Key」问题。

环境变量：
  WEB_PORT            监听端口（默认 40001）
  RUST_API_PROXY_TARGET  后端地址（默认 http://127.0.0.1:41000）
  BACKEND_KEY         后端鉴权 key（注入到 X-API-Key 头）
  FRONTEND_DIR        前端静态目录（默认本文件同级的 frontend/）
"""
import os
import sys
import http.server
import urllib.request
import urllib.error

BACKEND = os.environ.get("RUST_API_PROXY_TARGET", "http://127.0.0.1:41000")
API_KEY = os.environ.get("BACKEND_KEY", "")
FRONTEND_DIR = os.environ.get(
    "FRONTEND_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
)
PORT = int(os.environ.get("WEB_PORT", "40001"))

# 逐跳头，转发时不透传，由我们重新生成
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "content-length",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def _is_api(self):
        return self.path == "/health" or self.path.startswith("/api/")

    def _proxy(self):
        url = BACKEND + self.path
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length > 0 else None

        req = urllib.request.Request(url, data=body, method=self.command)
        for key, value in self.headers.items():
            low = key.lower()
            if low in HOP_BY_HOP or low in ("host", "x-api-key"):
                continue
            req.add_header(key, value)
        if API_KEY:
            req.add_header("X-API-Key", API_KEY)

        try:
            resp = urllib.request.urlopen(req, timeout=3600)
            status = resp.status
            headers = [(k, v) for k, v in resp.headers.items() if k.lower() not in HOP_BY_HOP]
            data = resp.read()
        except urllib.error.HTTPError as exc:
            status = exc.code
            headers = [(k, v) for k, v in exc.headers.items() if k.lower() not in HOP_BY_HOP]
            data = exc.read()
        except Exception as exc:  # noqa: BLE001 - 代理兜底，返回 502
            status = 502
            headers = [("Content-Type", "text/plain; charset=utf-8")]
            data = f"proxy error: {exc}".encode("utf-8")

        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self._is_api():
            self._proxy()
        else:
            super().do_GET()

    def do_POST(self):
        if self._is_api():
            self._proxy()
        else:
            self.send_error(404)

    def do_PUT(self):
        if self._is_api():
            self._proxy()
        else:
            self.send_error(404)

    def do_DELETE(self):
        if self._is_api():
            self._proxy()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        if self._is_api():
            self._proxy()
        else:
            super().do_OPTIONS()

    def log_message(self, fmt, *args):
        sys.stderr.write("[proxy] %s %s\n" % (self.address_string(), fmt % args))


def main():
    if not API_KEY:
        print("[proxy] 警告：BACKEND_KEY 未设置，后端接口将返回 401", file=sys.stderr)
    print(f"[proxy] 前端目录: {FRONTEND_DIR}", file=sys.stderr)
    print(f"[proxy] 代理目标: {BACKEND}", file=sys.stderr)
    print(f"[proxy] 监听: http://0.0.0.0:{PORT}", file=sys.stderr)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        httpd.serve_forever()


if __name__ == "__main__":
    main()
