"""Docker web 容器的 NGINX 只替本机来的请求补后端 key（防 DNS rebinding，2026-11-24）。

恶意网页把自己的域名解析到 127.0.0.1 时，浏览器带来的 Host 是那个域名；容器里后端监听 0.0.0.0、默认不查 Host，
NGINX 又会替没带 key 的请求补 key，两条叠在一起就能拿到全部权限。这里先静态核对模板和镜像接线，
再用真的 nginx 跑一遍渲染后的模板（CI 的 Ubuntu 镜像自带 nginx；本机没有就跳过，CI 上没有直接失败）。
"""
from __future__ import annotations

import http.client
import json
import os
import shutil
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
TEMPLATE = REPO_ROOT / "ops/deployment/docker/nginx.conf.template"
ALLOWED_HOSTS_SCRIPT = REPO_ROOT / "ops/deployment/docker/allowed-hosts.sh"
PROXY_KEY = "proxy-key-for-tests-0123456789"


def _text(relative: str) -> str:
    return (REPO_ROOT / relative).read_text(encoding="utf-8")


def test_every_location_that_injects_the_key_rejects_foreign_hosts() -> None:
    nginx = TEMPLATE.read_text(encoding="utf-8")
    assert "map $host $retainpdf_host_allowed {" in nginx
    assert "include /etc/nginx/retainpdf/allowed-hosts.map;" in nginx
    assert '"1:" "${RETAINPDF_PROXY_API_KEY}";' in nginx
    injecting = nginx.count("proxy_set_header X-API-Key $retainpdf_backend_api_key;")
    assert injecting >= 2
    assert nginx.count("if ($retainpdf_reject_host) {") == injecting


def test_image_and_delivery_wire_the_allowed_hosts_list() -> None:
    dockerfile = _text("ops/deployment/docker/Dockerfile.web")
    assert (
        "COPY ops/deployment/docker/allowed-hosts.sh /docker-entrypoint.d/16-retainpdf-allowed-hosts.sh" in dockerfile
    )
    assert "/docker-entrypoint.d/16-retainpdf-allowed-hosts.sh" in dockerfile.split("RUN chmod +x", 1)[1]
    assert "RETAINPDF_ALLOWED_HOSTS=\n" in _text("ops/deployment/docker/delivery/docker/web.env")
    assert "RETAINPDF_ALLOWED_HOSTS" in _text("ops/deployment/nginx/retainpdf.example.conf")


def _write_allowed_hosts(out_dir: Path, value: str | None) -> str:
    env = {"PATH": os.environ["PATH"], "RETAINPDF_ALLOWED_HOSTS_DIR": str(out_dir)}
    if value is not None:
        env["RETAINPDF_ALLOWED_HOSTS"] = value
    subprocess.run(["sh", str(ALLOWED_HOSTS_SCRIPT)], env=env, check=True, capture_output=True, cwd=out_dir)
    return (out_dir / "allowed-hosts.map").read_text(encoding="utf-8")


def test_allowed_hosts_script_normalizes_and_refuses_injection(tmp_path: Path) -> None:
    (tmp_path / "a-file.sh").write_text("", encoding="utf-8")
    written = _write_allowed_hosts(tmp_path, "PDF.Example.com:443, nas.local,bad;host evil$(x) *")
    assert written == "  pdf.example.com 1;\n  nas.local 1;\n"
    assert _write_allowed_hosts(tmp_path, None) == ""


# ---- 真的 nginx ----


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class _EchoKey(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - http.server 的接口
        body = json.dumps({"x_api_key": self.headers.get("X-API-Key")}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args) -> None:  # noqa: ANN002
        return


def _render(template: str, *, proxy_key: str, listen: int, upstream: int, root: Path, map_file: Path) -> str:
    # 照官方镜像的 envsubst：只换定义了的变量（这里只有 RETAINPDF_PROXY_API_KEY）
    server = template.replace("${RETAINPDF_PROXY_API_KEY}", proxy_key)
    server = server.replace("include /etc/nginx/mime.types;", "")
    server = server.replace("include /etc/nginx/conf.d/mjs.types.conf;", "")
    server = server.replace("include /etc/nginx/retainpdf/allowed-hosts.map;", f"include {map_file};")
    server = server.replace("listen 80;", f"listen 127.0.0.1:{listen};")
    server = server.replace("http://app:41000", f"http://127.0.0.1:{upstream}")
    server = server.replace("root /usr/share/nginx/html;", f"root {root};")
    temp = root.parent
    return (
        f"pid {temp}/nginx.pid;\nerror_log {temp}/error.log;\nevents {{}}\nhttp {{\n"
        f"  access_log off;\n  client_body_temp_path {temp}/body;\n  proxy_temp_path {temp}/proxy;\n"
        f"  fastcgi_temp_path {temp}/fastcgi;\n  uwsgi_temp_path {temp}/uwsgi;\n  scgi_temp_path {temp}/scgi;\n"
        f"{server}\n}}\n"
    )


@pytest.fixture()
def nginx_binary() -> str:
    found = shutil.which("nginx") or next(
        (path for path in ("/usr/sbin/nginx", "/opt/homebrew/bin/nginx") if Path(path).exists()), None
    )
    if found is None:
        if os.environ.get("CI"):
            pytest.fail("CI 上找不到 nginx：这条防 DNS rebinding 的测试必须真跑")
        pytest.skip("本机没有 nginx")
    return found


def _serve(nginx: str, tmp_path: Path, *, proxy_key: str, allowed: str | None):
    upstream = ThreadingHTTPServer(("127.0.0.1", 0), _EchoKey)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    root = tmp_path / "html"
    root.mkdir()
    map_dir = tmp_path / "map"
    map_dir.mkdir()
    _write_allowed_hosts(map_dir, allowed)
    listen = _free_port()
    conf = tmp_path / "nginx.conf"
    conf.write_text(
        _render(
            TEMPLATE.read_text(encoding="utf-8"),
            proxy_key=proxy_key,
            listen=listen,
            upstream=upstream.server_address[1],
            root=root,
            map_file=map_dir / "allowed-hosts.map",
        ),
        encoding="utf-8",
    )
    check = subprocess.run([nginx, "-t", "-p", str(tmp_path), "-e", "stderr", "-c", str(conf)], capture_output=True, text=True)
    assert check.returncode == 0, check.stderr
    process = subprocess.Popen(
        [nginx, "-p", str(tmp_path), "-e", "stderr", "-c", str(conf), "-g", "daemon off; master_process off;"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            socket.create_connection(("127.0.0.1", listen), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.05)
    return listen, process, upstream


def _get(port: int, path: str, host: str, key: str | None = None) -> tuple[int, dict]:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    headers = {"Host": host}
    if key is not None:
        headers["X-API-Key"] = key
    connection.request("GET", path, headers=headers)
    response = connection.getresponse()
    status, body = response.status, response.read()
    connection.close()
    return status, json.loads(body or b"{}")


def test_nginx_only_injects_the_key_for_local_or_listed_hosts(nginx_binary: str, tmp_path: Path) -> None:
    port, process, upstream = _serve(nginx_binary, tmp_path, proxy_key=PROXY_KEY, allowed="pdf.example.com")
    try:
        for host in (f"127.0.0.1:{port}", "localhost", f"localhost:{port}", "[::1]", "app.localhost", "pdf.example.com"):
            assert _get(port, "/api/v1/jobs", host) == (200, {"x_api_key": PROXY_KEY}), host
        # DNS rebinding：外来域名、只由 0-9a-f 组成的域名（像 IPv6 但不是）都不补 key，直接 403
        for host in ("evil.example", f"evil.example:{port}", "abc.cafe", "dead.beef"):
            status, body = _get(port, "/api/v1/jobs", host)
            assert status == 403, host
            assert body["error"]["details"]["reason"] == "host_not_allowed"
        status, _ = _get(port, "/api/v1/jobs/job-1/progress/stream", "evil.example")
        assert status == 403
        # 自己带 key 的照常转发，不换成代理的 key
        assert _get(port, "/api/v1/jobs", "evil.example", key="client-key") == (200, {"x_api_key": "client-key"})
        assert _get(port, "/api/v1/jobs", "localhost", key="client-key") == (200, {"x_api_key": "client-key"})
    finally:
        process.terminate()
        process.wait(timeout=10)
        upstream.shutdown()


def test_multi_user_overlay_without_proxy_key_is_not_blocked(nginx_binary: str, tmp_path: Path) -> None:
    """多用户叠加配置不补 key（浏览器靠登录会话），外来 Host 也照常转给后端，不 403。"""
    port, process, upstream = _serve(nginx_binary, tmp_path, proxy_key="", allowed=None)
    try:
        assert _get(port, "/api/v1/jobs", "pdf.example.com") == (200, {"x_api_key": None})
    finally:
        process.terminate()
        process.wait(timeout=10)
        upstream.shutdown()
