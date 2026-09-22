#!/usr/bin/env python3
"""Serve the web frontend and the Rust API from a single origin.

``serve_static`` still owns static files, ``runtime-config`` injection, cache
headers and the frontend's own ``/health``; this script only adds forwarding of
``/api/*`` to the Rust API so the browser never needs to reach the API port.

Why one origin: under WSL2, localhost forwarding can fail per port — the
frontend port forwards to Windows while the API port does not — which leaves
the Windows browser unable to reach ``http://127.0.0.1:<api-port>`` even though
the API answers inside the distro. Serving both from one port sidesteps the
forwarding entirely and keeps the API same-origin (no CORS).

Settings (flags win over the environment)
    --host / --port / --root   as in ``serve_static.py``
    --api-base                 Rust API root, default ``http://127.0.0.1:41000``
    --api-key                  ``X-API-Key`` to add when the request carries none
"""

from __future__ import annotations

import argparse
import functools
import importlib.util
import json
import os
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]

# 逐跳头不透传，由本进程重新生成；content-length 不在其中。
HOP_BY_HOP = frozenset({
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
})

API_METHODS = ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")


def load_serve_static():
    """Import the sibling ``serve_static.py`` without requiring it on sys.path."""
    spec = importlib.util.spec_from_file_location(
        "retain_serve_static", HERE / "serve_static.py"
    )
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load serve_static.py from {HERE}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def first_api_key_from_auth(path: Path) -> str:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    keys = payload.get("api_keys")
    if isinstance(keys, list) and keys:
        return str(keys[0]).strip()
    return ""


def resolve_api_key(cli_value: str) -> str:
    """Resolve the backend key. Mirrors serve_static's precedence, then adds
    ``RUST_API_KEYS`` (what ``ops/development/dev_stack.py`` configures) and the
    repository's own ``backend/api/auth.local.json``."""
    for name in ("RETAIN_PDF_PROXY_API_KEY", "RETAIN_PDF_FRONTEND_X_API_KEY"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    if cli_value:
        return cli_value
    from_env_keys = os.environ.get("RUST_API_KEYS", "").strip()
    if from_env_keys:
        return from_env_keys.split(",")[0].strip()
    return first_api_key_from_auth(REPO_ROOT / "backend" / "api" / "auth.local.json")


def build_handler(serve_static, api_base: str, api_key: str):
    class SameOriginHandler(serve_static.FrontendRequestHandler):
        """Static assets from ``serve_static``, ``/api/*`` forwarded upstream."""

        def _api_path(self) -> str:
            path = urllib.parse.urlsplit(self.path).path
            if path == "/api" or path.startswith("/api/"):
                return path
            return ""

        def _forward(self) -> None:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length > 0 else None

            request = urllib.request.Request(api_base + self.path, data=body, method=self.command)
            for name, value in self.headers.items():
                lowered = name.lower()
                if lowered in HOP_BY_HOP or lowered in ("host", "x-api-key"):
                    continue
                request.add_header(name, value)
            # 前端已带 key 时尊重它（设置页可能配了另一把），缺失才补。
            client_key = self.headers.get("X-API-Key")
            if client_key:
                request.add_header("X-API-Key", client_key)
            elif api_key:
                request.add_header("X-API-Key", api_key)

            try:
                response = urllib.request.urlopen(request, timeout=3600)
            except urllib.error.HTTPError as exc:
                response = exc
            except Exception as exc:  # noqa: BLE001 - 代理兜底，报 502
                self._send_plain(502, f"proxy error: {exc}")
                return

            with response:
                status = getattr(response, "status", None) or response.code
                headers = [
                    (name, value)
                    for name, value in response.headers.items()
                    if name.lower() not in HOP_BY_HOP
                ]
                if response.headers.get("Content-Length") is not None:
                    # 长度已知：透传长度并流式转发，避免大 PDF / ZIP 全量进内存。
                    self._send_headers(status, headers)
                    if self.command != "HEAD":
                        shutil.copyfileobj(response, self.wfile, 64 * 1024)
                    return
                # 上游用 chunked：长度未知，缓冲后自行声明长度，保持连接语义正确。
                payload = response.read()
                headers = [(n, v) for n, v in headers if n.lower() != "content-length"]
                headers.append(("Content-Length", str(len(payload))))
                self._send_headers(status, headers)
                if self.command != "HEAD":
                    self.wfile.write(payload)

        def _send_headers(self, status: int, headers) -> None:
            self.send_response(status)
            for name, value in headers:
                self.send_header(name, value)
            self.end_headers()

        def _send_plain(self, status: int, message: str) -> None:
            payload = message.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _dispatch(self) -> None:
            if self._api_path():
                self._forward()
                return
            delegate = getattr(super(SameOriginHandler, self), "do_" + self.command, None)
            if delegate is None:
                self.send_error(501, "Unsupported method (%r)" % self.command)
                return
            delegate()

        do_GET = _dispatch
        do_HEAD = _dispatch
        do_POST = _dispatch
        do_PUT = _dispatch
        do_PATCH = _dispatch
        do_DELETE = _dispatch
        do_OPTIONS = _dispatch

    return SameOriginHandler


def parse_args(argv=None) -> argparse.Namespace:
    serve_static = load_serve_static()
    parser = argparse.ArgumentParser(
        description="Serve the Retain PDF frontend and the Rust API on one origin.",
    )
    parser.add_argument("--host", default=serve_static.DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=serve_static.DEFAULT_PORT)
    parser.add_argument("--root", default=str(REPO_ROOT / "frontend" / "web"))
    parser.add_argument(
        "--api-base",
        default=os.environ.get("RETAIN_PDF_PROXY_API_BASE", "http://127.0.0.1:41000"),
    )
    parser.add_argument("--api-key", default="")
    return parser, serve_static, parser.parse_args(argv)


def main(argv=None) -> int:
    parser, serve_static, args = parse_args(argv)

    root = Path(args.root).resolve()
    if not root.exists():
        parser.error(f"frontend root does not exist: {root}")

    api_base = args.api_base.rstrip("/")
    api_key = resolve_api_key(args.api_key)
    handler = build_handler(serve_static, api_base, api_key)

    print(f"[same-origin] frontend {root}", flush=True)
    print(f"[same-origin] /api/* -> {api_base}", flush=True)
    print(
        "[same-origin] X-API-Key "
        + ("resolved; injected when the request omits it" if api_key else "not found; pass --api-key"),
        flush=True,
    )

    with serve_static.ThreadingHTTPServer(
        (args.host, args.port), functools.partial(handler, directory=str(root))
    ) as httpd:
        print(f"[same-origin] listening on http://{args.host}:{args.port}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
