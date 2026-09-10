from __future__ import annotations

import json
from pathlib import Path

import pytest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]


def _text(relative: str) -> str:
    return (REPO_ROOT / relative).read_text(encoding="utf-8")


def _workspace_manifests() -> list[str]:
    package = json.loads(_text("package.json"))
    manifests: set[str] = set()
    for pattern in package["workspaces"]:
        for workspace in REPO_ROOT.glob(pattern):
            manifest = workspace / "package.json"
            if manifest.is_file():
                manifests.add(manifest.relative_to(REPO_ROOT).as_posix())
    return sorted(manifests)


def _indented_section(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index]


def _nginx_location(text: str, declaration: str) -> str:
    start = text.index(declaration)
    end = text.index("\n  }", start)
    return text[start:end]


def _dockerignore_rules(relative: str) -> set[str]:
    return {
        line.strip()
        for line in _text(relative).splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def test_web_dockerfile_copies_every_workspace_manifest_and_app_builder() -> None:
    dockerfile = _text("ops/deployment/docker/Dockerfile.web")

    assert "COPY package.json package-lock.json ./" in dockerfile
    assert "COPY frontend/web/ ./frontend/web/" in dockerfile
    missing = [
        manifest
        for manifest in _workspace_manifests()
        if f"COPY {manifest} ./{manifest}" not in dockerfile
    ]
    assert missing == [], f"Dockerfile.web is missing workspace manifests: {missing}"


def test_web_runtime_image_installs_json_config_writer() -> None:
    dockerfile = _text("ops/deployment/docker/Dockerfile.web")
    apk_install = next(
        line for line in dockerfile.splitlines() if line.startswith("RUN apk add ")
    )

    assert "jq" in apk_install.split()


def test_compose_waits_for_app_readiness_not_liveness() -> None:
    compose = _text("ops/deployment/docker/delivery/docker-compose.yml")
    app = _indented_section(compose, "  app:\n", "\n  web:\n")

    assert "http://127.0.0.1:41000/ready" in app
    assert "http://127.0.0.1:41000/health" not in app
    assert "condition: service_healthy" in compose


def test_compose_publishes_every_service_on_loopback_by_default() -> None:
    compose = _text("ops/deployment/docker/delivery/docker-compose.yml")

    assert (
        '"${HOST_BIND_ADDRESS:-127.0.0.1}:${WEB_PORT:-40001}:80"' in compose
    )
    assert (
        '"${HOST_BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-41000}:41000"' in compose
    )
    assert (
        '"${HOST_BIND_ADDRESS:-127.0.0.1}:${APP_SIMPLE_PORT:-42000}:42000"'
        in compose
    )


def test_web_proxy_key_is_server_side_and_browser_key_defaults_empty() -> None:
    web_env = _text("ops/deployment/docker/delivery/docker/web.env")
    dockerfile = _text("ops/deployment/docker/Dockerfile.web")
    nginx = _text("ops/deployment/docker/nginx.conf.template")
    runtime_entrypoint = _text("ops/deployment/docker/entrypoint-web.sh")

    assert "RETAINPDF_PROXY_API_KEY=replace-with-your-backend-key" in web_env
    assert "FRONT_X_API_KEY=\n" in web_env
    assert 'ENV RETAINPDF_PROXY_API_KEY=""' in dockerfile
    assert '"${RETAINPDF_PROXY_API_KEY}"' in nginx
    assert "proxy_set_header X-API-Key $retainpdf_backend_api_key;" in nginx
    assert "RETAINPDF_PROXY_API_KEY" not in runtime_entrypoint


@pytest.mark.parametrize(
    "declaration",
    [
        "location = /api/v1/ai/ask {",
        "location ~ ^/api/v1/jobs/[^/]+/live-events$ {",
    ],
)
def test_nginx_sse_locations_disable_response_buffering(declaration: str) -> None:
    nginx = _text("ops/deployment/docker/nginx.conf.template")
    location = _nginx_location(nginx, declaration)

    assert "proxy_buffering off;" in location
    assert "proxy_cache off;" in location
    assert "add_header X-Accel-Buffering no always;" in location
    assert "proxy_read_timeout 1h;" in location


def test_internal_nginx_preserves_forwarded_client_and_streams_large_requests() -> None:
    nginx = _text("ops/deployment/docker/nginx.conf.template")
    api_location = _nginx_location(nginx, "location /api/ {")

    assert nginx.count("proxy_set_header X-Real-IP $remote_addr;") == 3
    assert nginx.count("proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;") == 3
    assert "proxy_request_buffering off;" in api_location
    assert "proxy_read_timeout 1h;" in api_location
    assert "proxy_send_timeout 1h;" in api_location
    assert "client_body_timeout 1h;" in api_location


def test_host_nginx_example_keeps_backend_private_and_sse_streaming() -> None:
    nginx = _text("ops/deployment/nginx/retainpdf.example.conf")

    assert "server 127.0.0.1:40001;" in nginx
    assert "41000" not in nginx
    assert "42000" not in nginx
    assert "listen 443 ssl;" in nginx
    assert "http2 on;" in nginx
    assert 'auth_basic "RetainPDF";' in nginx
    assert "client_max_body_size 256m;" in nginx
    assert "location = /api/v1/ai/ask {" in nginx
    assert "location ~ ^/api/v1/jobs/[^/]+/live-events$ {" in nginx
    assert nginx.count("proxy_buffering off;") == 2
    assert nginx.count("add_header X-Accel-Buffering no always;") == 2
    assert "proxy_request_buffering off;" in nginx


@pytest.mark.parametrize("relative", [".dockerignore"])
def test_dockerignore_excludes_local_credentials_and_runtime_overrides(
    relative: str,
) -> None:
    rules = _dockerignore_rules(relative)
    required = {
        "**/.env",
        "**/.env.*",
        "**/*.env",
        "**/auth.local.json",
        "**/*credentials*.json",
        "**/runtime-config.local.js",
    }

    assert required <= rules, f"{relative} is missing: {sorted(required - rules)}"
