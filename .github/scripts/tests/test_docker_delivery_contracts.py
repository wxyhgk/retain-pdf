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


def test_backend_image_ships_the_word_document_builder():
    """后端镜像里必须有 node 和 retainpdf2doc。

    保留排版的 Word 导出由 retainpdf2doc（Node 包）生成，Python 流水线起子进程调它。
    镜像里没有 Node 运行时或没有那份构建产物的话，导出必然失败——而且失败在前端会
    表现成"下载到一份打开什么都没有的空白文档"（保存对话框先建了文件）。

    v4.2.5 的 Mac 应用就是这么坏的:打包时漏带了这个包。
    """
    dockerfile = (REPO_ROOT / "ops/deployment/docker/backend/Dockerfile.app").read_text(encoding="utf-8")
    assert "AS docbuilder" in dockerfile, "没有构建 retainpdf2doc 的阶段"
    assert "/usr/local/bin/node" in dockerfile, "运行时镜像里没有 node"
    assert "retainpdf2doc/dist" in dockerfile, "没有把构建产物拷进运行时镜像"
    assert "RETAINPDF2DOC_CLI=" in dockerfile, (
        "没有设 RETAINPDF2DOC_CLI——镜像里没有仓库布局，流水线按相对路径找不到 CLI"
    )


def _dockerfile_stages(text: str) -> dict[str, str]:
    """阶段名 -> FROM 行（不含 AS 部分）。"""
    stages: dict[str, str] = {}
    for line in text.splitlines():
        if line.startswith("FROM ") and " AS " in line:
            head, name = line.rsplit(" AS ", 1)
            stages[name.strip()] = head
    return stages


def test_architecture_independent_js_builds_run_once_on_the_build_platform():
    """平台无关的 JS 构建只在构建机架构上跑一次。

    多架构构建时这些阶段若不钉 $BUILDPLATFORM，arm64 那份会在 QEMU 下重跑
    npm ci / npm run build（实测慢 6–10 倍，publish-current-web 曾卡在 arm64
    npm ci 87 分钟）。
    """
    web = _dockerfile_stages(_text("ops/deployment/docker/Dockerfile.web"))
    assert web["frontend-builder"].startswith("FROM --platform=$BUILDPLATFORM ")
    app = _dockerfile_stages(_text("ops/deployment/docker/backend/Dockerfile.app"))
    assert app["docbuilder"].startswith("FROM --platform=$BUILDPLATFORM ")
    assert app["typstsrc"].startswith("FROM --platform=$BUILDPLATFORM ")


def test_build_platform_stages_never_leak_build_architecture_binaries():
    """钉在构建机架构上的阶段，不能把依赖架构的东西拷进目标镜像。

    docbuilder 的 node 是构建机架构的；运行时 node 必须来自按目标架构拉取的阶段，
    否则 arm64 镜像会拿到 amd64 的 node。typstsrc 按 TARGETARCH 选下载包，
    不能看 uname -m（那是构建机架构）。
    """
    dockerfile = _text("ops/deployment/docker/backend/Dockerfile.app")
    stages = _dockerfile_stages(dockerfile)
    assert "--platform" not in stages["noderuntime"]
    assert "COPY --from=noderuntime /usr/local/bin/node /usr/local/bin/node" in dockerfile
    docbuilder_copies = [
        line for line in dockerfile.splitlines() if line.startswith("COPY --from=docbuilder ")
    ]
    assert docbuilder_copies
    assert all("retainpdf2doc/dist" in line or "retainpdf2doc/assets" in line for line in docbuilder_copies)
    typstsrc = _indented_section(dockerfile, "AS typstsrc", "AS docbuilder")
    assert "uname -m" not in typstsrc
    assert "ARG TARGETARCH" in typstsrc


def _cargo_workspace_members() -> list[str]:
    import tomllib

    return tomllib.loads(_text("Cargo.toml"))["workspace"]["members"]


def _dockerfile_stage_body(text: str, name: str) -> str:
    """从 `FROM ... AS name` 到下一个 FROM 之间的内容。"""
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("FROM ") and line.endswith(f" AS {name}"))
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("FROM ")), len(lines))
    return "\n".join(lines[start:end])


def test_app_rust_dependencies_are_cached_in_their_own_layer():
    """Rust 第三方依赖单独成层（cargo-chef），先 cook 再拷源码。

    以前 `COPY backend ./backend` 在 `cargo build` 之前，而 backend/ 里大部分是
    Python：改一行 Python 就让 273 个依赖 crate 全部重编（amd64 约 8.7 分钟）。
    """
    dockerfile = _text("ops/deployment/docker/backend/Dockerfile.app")
    builder = _dockerfile_stage_body(dockerfile, "builder")
    assert "COPY backend ./backend" not in dockerfile
    assert "COPY --from=planner /build/recipe.json recipe.json" in builder
    cook = builder.index("cargo chef cook --")
    first_source_copy = min(
        builder.index(f"COPY {member} ") for member in _cargo_workspace_members()
    )
    assert cook < first_source_copy, "依赖层必须在拷工作区源码之前"
    assert builder.index("cargo build --") > first_source_copy

    # cook 与 build 的参数不一致，依赖会在源码层再编一遍，缓存形同虚设。
    def flags(command: str) -> set[str]:
        line = next(line for line in builder.splitlines() if command in line)
        tail = "--" + line.split(command, 1)[1]
        return {token for token in tail.split() if token.startswith("--") and token != "--recipe-path"}

    assert flags("cargo chef cook --") == flags("cargo build --") == {"--release", "--locked", "--workspace", "--bins"}


def test_app_rust_stages_copy_every_workspace_member():
    """planner / builder 都只拷工作区成员，而且一个都不能少。

    新增 members 而不改 Dockerfile 的话，`cargo chef prepare` 直接找不到清单失败。
    """
    dockerfile = _text("ops/deployment/docker/backend/Dockerfile.app")
    for stage in ("planner", "builder"):
        body = _dockerfile_stage_body(dockerfile, stage)
        assert "COPY Cargo.toml Cargo.lock ./" in body
        missing = [
            member for member in _cargo_workspace_members()
            if f"COPY {member} ./{member}" not in body
        ]
        assert missing == [], f"{stage} 阶段缺工作区成员：{missing}"


def test_app_rust_builder_matches_the_runtime_debian_release():
    """builder 编出来的二进制链接 glibc，Debian 代号必须与运行时镜像一致。"""
    stages = _dockerfile_stages(_text("ops/deployment/docker/backend/Dockerfile.app"))
    assert stages["chef"].startswith("FROM lukemathwalker/cargo-chef:")
    assert "@sha256:" in stages["chef"], "第三方镜像要按 digest 钉死"
    assert stages["planner"] == "FROM chef"
    assert stages["builder"] == "FROM chef"
    assert "-bookworm" in stages["chef"] and "-bookworm" in stages["runtime"]


def test_app_rust_builder_needs_no_openssl():
    """builder 不装 libssl-dev / pkg-config，前提是依赖树里没有 openssl。

    哪天有依赖引入 openssl-sys / native-tls，这里先失败，提醒把系统包加回去
    （或者换成 rustls 特性），而不是等镜像构建在 build script 里报找不到 OpenSSL。
    """
    builder = _dockerfile_stage_body(_text("ops/deployment/docker/backend/Dockerfile.app"), "builder")
    assert "libssl-dev" not in builder and "pkg-config" not in builder
    packages = {
        line.split('"')[1]
        for line in _text("Cargo.lock").splitlines()
        if line.startswith('name = "')
    }
    assert not packages & {"openssl", "openssl-sys", "native-tls"}
    assert "ring" in packages


def test_desktop_bundle_ships_the_word_document_builder():
    """桌面打包同理:要带上 retainpdf2doc，并把路径和 node 告诉后端。"""
    prepare = (REPO_ROOT / "frontend/desktop/scripts/prepare-app.mjs").read_text(encoding="utf-8")
    assert "retainpdf2doc" in prepare, "prepare-app 没有把 retainpdf2doc 打进 app/backend"

    env = (REPO_ROOT / "frontend/desktop/src/main/backend-env.js").read_text(encoding="utf-8")
    assert "RETAINPDF2DOC_CLI" in env, "没有把 CLI 路径传给后端"
    assert "RETAINPDF_NODE_BIN" in env, (
        "没有把 node 传给后端；装好的应用里没有系统 node，要用 Electron 自己"
    )


def test_no_workspace_package_builds_itself_during_npm_ci():
    """workspace 包不能带 `prepare` 脚本。

    镜像构建为了利用缓存，会先只拷 manifest 再 `npm ci`。那一刻包的 `scripts/` 还不
    存在——而 npm 10（node:22 镜像里自带的那个）**不理会 `--ignore-scripts`**，仍然去跑
    workspace 的 `prepare`，于是
    `Cannot find module '.../retainpdf2doc/scripts/build.mjs'`，两个镜像一起构建失败。
    本机 npm 11 会跳过，所以这个差异在本地看不出来。

    构建要由显式的 `npm run build --workspace <pkg>` 触发，不靠 npm 的生命周期钩子。
    """
    import json

    root = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    offenders = []
    for pattern in root.get("workspaces", []):
        for manifest in sorted(REPO_ROOT.glob(f"{pattern}/package.json")):
            if "node_modules" in manifest.parts:
                continue
            scripts = json.loads(manifest.read_text(encoding="utf-8")).get("scripts", {})
            if "prepare" in scripts:
                offenders.append(str(manifest.relative_to(REPO_ROOT)))
    assert not offenders, (
        f"这些 workspace 包带了 prepare 脚本，会在只有 manifest 的 npm ci 阶段炸掉："
        f"{offenders}。改成显式 build 脚本。"
    )


def test_the_desktop_packaging_chain_builds_the_document_builder():
    """桌面打包链条必须自己构建 retainpdf2doc。

    去掉 `prepare` 之后，`npm ci` 不再顺带把 dist 建出来；打包链条不显式构建的话，
    `prepare-app.mjs` 会因为找不到 dist/cli.mjs 直接失败。
    """
    import json

    desktop = json.loads((REPO_ROOT / "frontend/desktop/package.json").read_text(encoding="utf-8"))
    chain = desktop["scripts"]["prepare-app"]
    assert "build:doc" in chain or "retainpdf2doc" in chain, (
        f"prepare-app 没有构建 retainpdf2doc：{chain}"
    )


def _workflow_job(workflow: str, name: str) -> str:
    import re

    source = _text(f".github/workflows/{workflow}")
    match = re.search(rf"^  {re.escape(name)}:\n(.*?)(?=^  [\w-]+:|\Z)", source, re.M | re.S)
    assert match is not None, f"missing {name} in {workflow}"
    return match.group(1)


def test_release_docker_builds_each_platform_on_a_native_runner():
    """arm64 不再用 QEMU 模拟（v4.2.6 里 arm64 cargo build 要 58.7 分钟）。

    构建定义在 build-docker-images.yml（main 预构建与 release-docker 回退构建共用）。"""
    for workflow_name in ("release-docker.yml", "build-docker-images.yml", "prebuild-release-candidates.yml"):
        assert "setup-qemu-action" not in _text(f".github/workflows/{workflow_name}")
    build = _workflow_job("build-docker-images.yml", "build")
    assert "ubuntu-24.04-arm" in build
    assert "platform: ${{ fromJSON(inputs.platform_matrix) }}" in build
    assert "platforms: ${{ matrix.platform }}" in build
    assert "push-by-digest=true" in build
    # artifact 名里不能带 `/`，必须用 slug 而不是 matrix.platform。
    assert "docker-digest-${{ matrix.target.name }}-${{ steps.platform.outputs.slug }}-${{ github.run_id }}" in build


def test_release_docker_never_exports_gha_caches():
    """gha 缓存按 ref 隔离，tag run 写的缓存下个 tag 读不到，只会挤掉 main 的缓存。

    （v4.2.6 一个 tag 写了 3.8GB、多花约 6 分钟导出。）构建缓存改走 Docker Hub
    的 registry 缓存，build job 里不应再出现 type=gha。
    """
    build = _workflow_job("build-docker-images.yml", "build")
    assert "type=gha" not in build
    cache_from = [line.strip() for line in build.splitlines() if line.strip().startswith("cache-from:")]
    cache_to = [line.strip() for line in build.splitlines() if line.strip().startswith("cache-to:")]
    assert cache_from == ["cache-from: ${{ steps.cache.outputs.from }}"]
    assert cache_to == ["cache-to: ${{ steps.cache.outputs.to }}"]


def test_release_docker_registry_cache_is_shared_across_tags_but_written_only_when_logged_in():
    """registry 缓存跨 tag 可读；只有会推送（已登录 Docker Hub）的路径才写。

    PR / push=false 的 dispatch 没有登录，写缓存会失败；每个平台一个 ref，
    amd64 / arm64 两个 job 并行写才不会互相覆盖。
    """
    build = _workflow_job("build-docker-images.yml", "build")
    cache_step = _indented_section(build, "      - name: Resolve build cache\n", "      - name: Build and push\n")
    assert (
        "CACHE_REF: ${{ steps.hub.outputs.user }}/${{ matrix.target.repo }}:buildcache-${{ steps.platform.outputs.slug }}"
        in cache_step
    )
    assert "PUSH_IMAGE: ${{ inputs.push }}" in cache_step
    assert 'echo "from=type=registry,ref=${CACHE_REF}"' in cache_step
    write_branch = _indented_section(cache_step, 'if [ "$PUSH_IMAGE" = "true" ]; then', "else")
    assert "type=registry,ref=${CACHE_REF},mode=max,ignore-error=true" in write_branch
    read_only_branch = _indented_section(cache_step, "else", "fi")
    assert 'echo "to=" >> "$GITHUB_OUTPUT"' in read_only_branch

    # 写缓存的条件必须与登录条件是同一个开关。
    login = _indented_section(build, "      - name: Login to Docker Hub\n", "      - name: Generate build args\n")
    assert "if: inputs.push" in login
    # 缓存 ref 用到的 namespace / slug 要在缓存步骤之前解析好。
    assert build.index("id: hub") < build.index("id: cache")
    assert build.index("id: platform") < build.index("id: cache")


def test_release_docker_merge_keeps_the_candidate_identity_contract():
    """merge 合成多架构 manifest，并写出 publish 期望的同一份 candidate JSON。"""
    merge = _workflow_job("build-docker-images.yml", "merge")
    publish = _workflow_job("release-docker.yml", "publish")
    assert "docker buildx imagetools create --tag" in merge
    assert "pattern: docker-digest-${{ matrix.target.name }}-*-${{ github.run_id }}" in merge
    assert "name: docker-candidate-${{ matrix.target.name }}-${{ github.run_id }}" in merge
    assert "{target: $target, repo: $repo, digest: $digest, revision: $revision, version: $version, platforms: $platforms}" in merge
    assert "    needs: build\n" in merge
    assert "    needs: [prepare, build]\n" in publish
    for target in ("app", "web"):
        assert f"name: docker-candidate-{target}-${{{{ github.run_id }}}}" in publish


def test_backend_image_ships_the_rpr_engine():
    """render.engine = "rpr" 的引擎（backend/rendering-engine）要进后端镜像。

    引擎是纯 JS（engine/）加运行时 npm 依赖 mathjax-full 与 fontkit，同 retainpdf2doc 一样钉在
    构建机架构上装一次，整目录拷进运行时镜像，再用 RETAIN_RPR_ENGINE_DIR 告诉流水线；
    node 用 noderuntime 那份。少了任何一环，rpr 路线都会悄悄回退 Typst。
    """
    dockerfile = _text("ops/deployment/docker/backend/Dockerfile.app")
    stages = _dockerfile_stages(dockerfile)
    assert stages["rprengine"].startswith("FROM --platform=$BUILDPLATFORM ")
    section = _dockerfile_stage_body(dockerfile, "rprengine")
    assert "COPY backend/rendering-engine/package.json backend/rendering-engine/package-lock.json" in section
    assert "npm ci --omit=dev --ignore-scripts" in section
    assert "COPY backend/rendering-engine/engine ./engine" in section
    # 构建时自检：两个运行时依赖都装上了，引擎两个入口都能加载（缺 fontkit 会让引擎写 PDF 失败、回退 Typst）。
    assert "test -f node_modules/fontkit/package.json" in section
    assert 'require("fontkit")' in section
    copies = [line for line in dockerfile.splitlines() if line.startswith("COPY --from=rprengine ")]
    assert copies == ["COPY --from=rprengine /build/rendering-engine /app/services/rendering-engine"]
    assert "RETAIN_RPR_ENGINE_DIR=/app/services/rendering-engine" in dockerfile


def test_rpr_engine_copy_is_pinned_and_complete():
    """引擎是按提交复制进来的：来源与提交号、运行时最小集合、锁定的 mathjax-full 与 fontkit 都要在。"""
    root = REPO_ROOT / "backend" / "rendering-engine"
    upstream = dict(
        line.split("=", 1) for line in (root / "UPSTREAM").read_text(encoding="utf-8").splitlines() if "=" in line
    )
    assert len(upstream.get("commit", "")) == 40
    assert (root / "engine" / "COMMIT").read_text(encoding="utf-8").strip() == upstream["commit"]
    for relative in (
        "bin/rpr-retain.js",
        "src/retain/run.js",
        "src/typeset/index.js",
        "src/text/measurer.js",
        "src/output",
        "data/fonts",
        "package.json",
        "LICENSE",
    ):
        assert (root / "engine" / relative).exists(), relative
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    # mathjax-full：公式；fontkit：引擎直接写 PDF 时嵌入、整形字体。
    assert package["dependencies"] == {"fontkit": "2.0.4", "mathjax-full": "3.2.1"}
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    assert lock["packages"]["node_modules/mathjax-full"]["version"] == "3.2.1"
    assert lock["packages"]["node_modules/fontkit"]["version"] == "2.0.4"
    # 后备字体随引擎带上；思源宋体用 resources/fonts 那份（sync.sh 不复制）。
    assert (root / "engine" / "data" / "fonts" / "fallback" / "LibertinusSerif-Regular.otf").is_file()
    assert (root / "engine" / "data" / "fonts" / "fallback" / "NOTICE").is_file()
    assert not (root / "engine" / "data" / "fonts" / "source-han-serif").exists()
    assert (root / "sync.sh").stat().st_mode & 0o111


def test_desktop_bundle_ships_the_rpr_engine():
    prepare = _text("frontend/desktop/scripts/prepare-app.mjs")
    assert '"backend", "rendering-engine"' in prepare
    assert '"engine", "node_modules", "package.json", "UPSTREAM"' in prepare
    # 依赖是否齐全按 package.json 的全部 dependencies 判断（旧 node_modules 可能缺 fontkit）。
    assert ".dependencies" in prepare and "rprEngineDeps" in prepare
    env = _text("frontend/desktop/src/main/backend-env.js")
    assert 'RETAIN_RPR_ENGINE_DIR: path.join(backendRoot, "rendering-engine")' in env
    assert "RETAINPDF_NODE_BIN" in env
