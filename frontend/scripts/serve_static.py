#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import json
import mimetypes
import os
import socketserver
import urllib.parse
from pathlib import Path


DEFAULT_HOST = os.environ.get("RETAIN_PDF_FRONTEND_BIND_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.environ.get("RETAIN_PDF_FRONTEND_PORT", "40001"))
DEFAULT_ROOT = Path(
    os.environ.get("RETAIN_PDF_FRONTEND_ROOT", "/home/wxyhgk/tmp/Code/frontend")
).resolve()
DEFAULT_OCR_PROVIDER = os.environ.get("RETAIN_PDF_FRONTEND_OCR_PROVIDER", "").strip()
DEFAULT_PADDLE_TOKEN = os.environ.get("RETAIN_PDF_FRONTEND_PADDLE_TOKEN", "").strip()
DEFAULT_MINERU_TOKEN = os.environ.get("RETAIN_PDF_FRONTEND_MINERU_TOKEN", "").strip()
DEFAULT_MODEL_API_KEY = os.environ.get("RETAIN_PDF_FRONTEND_MODEL_API_KEY", "").strip()
DEFAULT_MODEL = os.environ.get("RETAIN_PDF_FRONTEND_MODEL", "deepseek-v4-flash").strip()
DEFAULT_BASE_URL = os.environ.get("RETAIN_PDF_FRONTEND_BASE_URL", "https://api.deepseek.com/v1").strip()


def default_api_base() -> str:
    configured = os.environ.get("RETAIN_PDF_FRONTEND_API_BASE", "").strip()
    if configured:
        return configured
    if DEFAULT_HOST in ("", "0.0.0.0", "::"):
        return "http://1.94.67.196:41000"
    return f"http://{DEFAULT_HOST}:41000"


def read_x_api_key_from_auth(auth_path: Path) -> str:
    try:
        payload = json.loads(auth_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    api_keys = payload.get("api_keys")
    if isinstance(api_keys, list) and api_keys:
        return str(api_keys[0]).strip()
    return ""


def default_x_api_key(frontend_root: Path | None = None) -> str:
    """Backend X-API-Key only (not model/OCR secrets). Prefer env, then auth.local.json."""
    configured = os.environ.get("RETAIN_PDF_FRONTEND_X_API_KEY", "").strip()
    if configured:
        return configured
    roots = []
    if frontend_root is not None:
        roots.append(Path(frontend_root).resolve())
    roots.append(DEFAULT_ROOT)
    seen: set[Path] = set()
    for root in roots:
        root = root.resolve()
        if root in seen:
            continue
        seen.add(root)
        key = read_x_api_key_from_auth(root.parent / "backend" / "rust_api" / "auth.local.json")
        if key:
            return key
    return ""


DEFAULT_API_BASE = default_api_base()
DEFAULT_X_API_KEY = default_x_api_key()

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class FrontendRequestHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "retain-pdf-frontend/1.0"
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self) -> None:
        if self.path == "/health":
            payload = {
                "ok": True,
                "service": "retain-pdf-frontend",
                "root": str(Path(self.directory).resolve()),
            }
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        if self.path == "/runtime-config.local.js":
            # Chính sách khai：Các tệp đĩa chỉ chứa các mục nhập không phải khóa；Khóa không vào kho/Hồ sơ địa phương。
            # - model/OCR key：Chỉ tiêm nếu biến môi trường tương ứng được đặt rõ ràng（Trống theo mặc định → UI Cổng vào có hiệu lực）
            # - Hậu phương X-API-Key：Có sẵn từ env Hoặc auth.local.json rót vào，Thuận tiện cho việc kết nối cục bộ Rust API
            root = Path(self.directory).resolve()
            disk_local = root / "runtime-config.local.js"
            chunks: list[str] = []
            if disk_local.is_file():
                chunks.append(disk_local.read_text(encoding="utf-8"))
            else:
                chunks.append(
                    "window.__FRONT_RUNTIME_CONFIG__ = {\n"
                    "  ...(window.__FRONT_RUNTIME_CONFIG__ || {}),\n"
                    f"  apiBase: {json.dumps(DEFAULT_API_BASE)},\n"
                    f"  ocrProvider: {json.dumps(DEFAULT_OCR_PROVIDER or 'paddle')},\n"
                    f"  model: {json.dumps(DEFAULT_MODEL)},\n"
                    f"  baseUrl: {json.dumps(DEFAULT_BASE_URL)},\n"
                    "};\n"
                )

            x_key = default_x_api_key(root)
            model_key = DEFAULT_MODEL_API_KEY  # only non-empty when env set
            paddle = DEFAULT_PADDLE_TOKEN
            mineru = DEFAULT_MINERU_TOKEN
            if x_key or model_key or paddle or mineru:
                patches: list[str] = []
                if x_key:
                    patches.append(
                        f'if (!c.xApiKey) c.xApiKey = {json.dumps(x_key)};'
                    )
                if model_key:
                    patches.append(
                        f'if (!c.modelApiKey) c.modelApiKey = {json.dumps(model_key)};'
                    )
                if paddle:
                    patches.append(
                        f'if (!c.paddleToken) c.paddleToken = {json.dumps(paddle)};'
                    )
                if mineru:
                    patches.append(
                        f'if (!c.mineruToken) c.mineruToken = {json.dumps(mineru)};'
                    )
                chunks.append(
                    "(function () {\n"
                    "  var c = window.__FRONT_RUNTIME_CONFIG__ = "
                    "window.__FRONT_RUNTIME_CONFIG__ || {};\n"
                    "  " + "\n  ".join(patches) + "\n"
                    "})();\n"
                )

            script = "".join(chunks).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(script)))
            self.end_headers()
            self.wfile.write(script)
            return
        super().do_GET()

    def end_headers(self) -> None:
        path = urllib.parse.urlsplit(self.path).path
        if path == "/runtime-config.local.js":
            self.send_header("Cache-Control", "no-store")
        elif path.startswith(("/vendor/", "/src/assets/", "/dist/")):
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        elif path.endswith((".js", ".css", ".html")) or path in ("/", "/index.html"):
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        super().log_message(format, *args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Retain PDF frontend as static files.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = Path(args.root).resolve()
    if not root.exists():
        raise SystemExit(f"frontend root does not exist: {root}")
    handler = functools.partial(FrontendRequestHandler, directory=str(root))
    with ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(
            f"retain-pdf-frontend serving {root} on http://{args.host}:{args.port}",
            flush=True,
        )
        httpd.serve_forever()


if __name__ == "__main__":
    main()
