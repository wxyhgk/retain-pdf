# Rust 构建拆成「依赖层」和「源码层」（cargo-chef）：
# - planner 从工作区清单生成 recipe.json（只含依赖信息，源码改动不改变它）；
# - builder 先按 recipe 只编第三方依赖（约 270 个 crate），形成可缓存的层，
#   再拷工作区源码编自己的 crate。只改 Python / 文档 / 工作区 Rust 源码时，
#   依赖层整层命中缓存，只重编工作区里的 7 个 crate。
# 镜像就是 rust:1.89-slim-bookworm（Rust 1.89.0）加一个 cargo-chef 二进制；按多架构
# index digest 钉死，避免第三方 tag 被重推。升级 Rust 时 tag 与 digest 一起换，Debian 代号要与运行时镜像一致。
FROM lukemathwalker/cargo-chef:0.1.72-rust-1.89-slim-bookworm@sha256:8a67a5ad32d6cfc55169ac211afac52c20fc2a0676bdcc38e5f6b813070e4fa6 AS chef
WORKDIR /build

# 只拷工作区成员（根 Cargo.toml 的 members），不拷整个 backend/：
# backend/ 里大部分是 Python，拷进来会让任何 Python 改动都让这些层失效。
# release 二进制不读任何非 Rust 文件（include_str! 只出现在 #[cfg(test)] 里，
# backend/api/build.rs 只对 i686-pc-windows-gnu 生效）。
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY database/retainpdf-db ./database/retainpdf-db
COPY backend/api ./backend/api
COPY backend/cli ./backend/cli
COPY backend/jobs ./backend/jobs
COPY backend/packages/retainpdf-config ./backend/packages/retainpdf-config
COPY backend/packages/retainpdf-core ./backend/packages/retainpdf-core
COPY backend/packages/retainpdf-data ./backend/packages/retainpdf-data
COPY backend/packages/retainpdf-runner ./backend/packages/retainpdf-runner
COPY backend/packages/retainpdf-accounts ./backend/packages/retainpdf-accounts
COPY backend/packages/retainpdf-ai ./backend/packages/retainpdf-ai
COPY backend/packages/retainpdf-api-base ./backend/packages/retainpdf-api-base
COPY backend/packages/retainpdf-glossaries ./backend/packages/retainpdf-glossaries
COPY backend/packages/retainpdf-ingest ./backend/packages/retainpdf-ingest
COPY backend/packages/retainpdf-jobs ./backend/packages/retainpdf-jobs
COPY backend/packages/retainpdf-library ./backend/packages/retainpdf-library
COPY backend/packages/retainpdf-files ./backend/packages/retainpdf-files
COPY backend/packages/retainpdf-platform ./backend/packages/retainpdf-platform
COPY backend/packages/retainpdf-providers ./backend/packages/retainpdf-providers
COPY backend/packages/retainpdf-proc ./backend/packages/retainpdf-proc
RUN cargo chef prepare --recipe-path recipe.json

# 不装 libssl-dev / pkg-config：依赖树走 rustls + ring，没有 openssl / native-tls
# （有契约测试盯着 Cargo.lock）。ring 的 C 部分用基础镜像自带的 gcc / libc6-dev，
# ca-certificates 也是基础镜像自带的。
FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
# 依赖层：参数必须与下面的 cargo build 完全一致（profile / --workspace --bins /
# --locked），否则依赖会在源码层再编一遍。
RUN cargo chef cook --release --locked --workspace --bins --recipe-path recipe.json

# 源码层
COPY Cargo.toml Cargo.lock ./
COPY database/retainpdf-db ./database/retainpdf-db
COPY backend/api ./backend/api
COPY backend/cli ./backend/cli
COPY backend/jobs ./backend/jobs
COPY backend/packages/retainpdf-config ./backend/packages/retainpdf-config
COPY backend/packages/retainpdf-core ./backend/packages/retainpdf-core
COPY backend/packages/retainpdf-data ./backend/packages/retainpdf-data
COPY backend/packages/retainpdf-runner ./backend/packages/retainpdf-runner
COPY backend/packages/retainpdf-accounts ./backend/packages/retainpdf-accounts
COPY backend/packages/retainpdf-ai ./backend/packages/retainpdf-ai
COPY backend/packages/retainpdf-api-base ./backend/packages/retainpdf-api-base
COPY backend/packages/retainpdf-glossaries ./backend/packages/retainpdf-glossaries
COPY backend/packages/retainpdf-ingest ./backend/packages/retainpdf-ingest
COPY backend/packages/retainpdf-jobs ./backend/packages/retainpdf-jobs
COPY backend/packages/retainpdf-library ./backend/packages/retainpdf-library
COPY backend/packages/retainpdf-files ./backend/packages/retainpdf-files
COPY backend/packages/retainpdf-platform ./backend/packages/retainpdf-platform
COPY backend/packages/retainpdf-providers ./backend/packages/retainpdf-providers
COPY backend/packages/retainpdf-proc ./backend/packages/retainpdf-proc
# 编译期 include_str! 读入的契约文件（job_data 的数据集登记表），不在任何工作区成员目录里。
COPY backend/contracts/job-data.v1.schema.json ./backend/contracts/job-data.v1.schema.json
# COPY 保留构建上下文里的 mtime，可能比 cook 产物还旧；touch 一遍保证工作区
# crate 一定按真实源码重编，而不是沿用 cook 阶段的空壳。
RUN find database backend -name '*.rs' -exec touch {} + \
    && cargo build --release --locked --workspace --bins

FROM python:3.11-slim-bookworm AS python-lock

COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

WORKDIR /workspace

COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/ai/pyproject.toml ai/pyproject.toml
COPY backend/base/pyproject.toml base/pyproject.toml
COPY backend/math/pyproject.toml math/pyproject.toml
COPY backend/pipeline/pyproject.toml pipeline/pyproject.toml
COPY backend/translation/pyproject.toml translation/pyproject.toml
# 翻译 agent 包（retainpdf-translation-agent）：工作区成员，uv export 要它的 pyproject；
# 运行时镜像也装（翻译引擎 translation.engine=agent 用它，只依赖标准库）。
COPY backend/translation-agent/pyproject.toml translation-agent/pyproject.toml

RUN uv export \
    --locked \
    --no-dev \
    --no-emit-workspace \
    --format requirements-txt \
    --output-file /requirements-backend.txt

# typstsrc 只下载文件（按目标架构选包），不需要在目标架构上执行，所以钉在
# 构建机架构上跑，避免多架构构建时在 QEMU 下做 apt-get / 解压。
# 选包看 TARGETARCH（目标架构），不能看 uname -m（那是构建机架构）。
FROM --platform=$BUILDPLATFORM python:3.11-slim-bookworm AS typstsrc

ARG TYPST_VERSION=0.15.1
ARG CMARKER_VERSION=0.1.10
ARG MITEX_VERSION=0.2.7
ARG FX_VERSION=0.0.5
ARG TARGETARCH
ARG BUILDARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tar \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/typst /opt/typst/bin /opt/typst-packages/preview

RUN set -eux; \
    case "${TARGETARCH:?TARGETARCH is required}" in \
      amd64) TYPST_ARCH="x86_64" ;; \
      arm64) TYPST_ARCH="aarch64" ;; \
      *) echo "Unsupported architecture: $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${TYPST_ARCH}-unknown-linux-musl.tar.xz" \
    -o /tmp/typst/typst.tar.xz \
    && tar -xJf /tmp/typst/typst.tar.xz -C /tmp/typst \
    && cp /tmp/typst/typst-${TYPST_ARCH}-unknown-linux-musl/typst /opt/typst/bin/typst

RUN set -eux; \
    for pkg in cmarker:${CMARKER_VERSION} mitex:${MITEX_VERSION}; do \
      name="${pkg%%:*}"; \
      version="${pkg##*:}"; \
      mkdir -p "/tmp/typst/${name}" "/opt/typst-packages/preview/${name}/${version}"; \
      curl -fsSL "https://packages.typst.org/preview/${name}-${version}.tar.gz" \
        -o "/tmp/typst/${name}.tar.gz"; \
      tar -xzf "/tmp/typst/${name}.tar.gz" -C "/tmp/typst/${name}"; \
      cp -R "/tmp/typst/${name}/." "/opt/typst-packages/preview/${name}/${version}/"; \
    done

# fx publishes versioned, statically linked Linux binaries for both image
# architectures.  The upstream installer is version-aware but does not verify
# an artifact checksum, so the image downloads the immutable release artifact
# directly and pins the hashes verified for v0.0.5.
# `fx --version` 只有目标架构与构建机相同时才能直接执行；跨架构时由 sha256
# 保证拿到的是钉死的那份目标架构二进制。
RUN set -eux; \
    case "${TARGETARCH:?TARGETARCH is required}" in \
      amd64) \
        FX_ARCH="x86_64"; \
        FX_SHA256="d5639d173267774aa8228a474baf619a7076ac41a91023915007c865143429b1" \
        ;; \
      arm64) \
        FX_ARCH="aarch64"; \
        FX_SHA256="8bbcde6a41256c4fac4e0a022291cf02740419e27afabde3b8f45e7a4e393edb" \
        ;; \
      *) echo "Unsupported architecture for fx: $TARGETARCH"; exit 1 ;; \
    esac; \
    mkdir -p /tmp/fx /opt/fx/bin /opt/fx/licenses; \
    curl -fsSL --retry 5 --retry-all-errors --proto '=https' \
      "https://releases.fx.sh/v${FX_VERSION}/fx-linux-${FX_ARCH}.tar.gz" \
      -o /tmp/fx/fx.tar.gz; \
    echo "${FX_SHA256}  /tmp/fx/fx.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/fx/fx.tar.gz -C /tmp/fx; \
    install -m 0755 /tmp/fx/fx /opt/fx/bin/fx; \
    install -m 0644 /tmp/fx/LICENSE /opt/fx/licenses/LICENSE; \
    install -m 0644 /tmp/fx/THIRD_PARTY_NOTICES.md /opt/fx/licenses/THIRD_PARTY_NOTICES.md; \
    if [ "$TARGETARCH" = "$BUILDARCH" ]; then \
      test "$(/opt/fx/bin/fx --version)" = "$FX_VERSION"; \
    fi

# 保留排版的 Word 导出由 retainpdf2doc（Node 包）生成，Python 流水线会起它。
# 它的 dist/ 不进版本库，所以镜像里得自己构建一次。
# 产物是 esbuild 打出的自包含 .mjs（与架构无关），所以钉在构建机架构上只跑一次；
# 这个阶段的 node 二进制是构建机架构的，**不能**拷进运行时镜像——运行时的 node
# 从下面按目标架构拉取的 noderuntime 阶段拿。
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS docbuilder
WORKDIR /build
# 从仓库根的 lock 安装:workspace 集合必须齐全，少一份 manifest `npm ci` 就对不上。
COPY package.json package-lock.json ./
COPY frontend/desktop/package.json ./frontend/desktop/package.json
COPY frontend/web/package.json ./frontend/web/package.json
COPY frontend/packages/api/package.json ./frontend/packages/api/package.json
COPY frontend/packages/domain/package.json ./frontend/packages/domain/package.json
COPY frontend/packages/reader/package.json ./frontend/packages/reader/package.json
COPY frontend/packages/ui/package.json ./frontend/packages/ui/package.json
COPY contracts/package.json ./contracts/package.json
COPY backend/packages/retainpdf2doc/package.json ./backend/packages/retainpdf2doc/package.json
RUN npm ci --ignore-scripts
COPY backend/packages/retainpdf2doc/ ./backend/packages/retainpdf2doc/
RUN npm run build --workspace retainpdf2doc \
    && test -f backend/packages/retainpdf2doc/dist/cli.mjs

# rpr 排版引擎（render.engine = "rpr_fit" / "rpr"）：engine/ 是 sync.sh 复制进仓库的纯 JS 源码，
# 运行时 npm 依赖 mathjax-full 与 fontkit（都是纯 JS、无安装脚本、与架构无关），所以和 docbuilder 一样
# 钉在构建机架构上装一次，产物整目录拷进运行时镜像，由下面的 noderuntime 的 node 去跑。
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS rprengine
WORKDIR /build/rendering-engine
COPY backend/rendering-engine/package.json backend/rendering-engine/package-lock.json ./
# mathjax-full 里只有 js/ 被 require；es5/（浏览器包）、ts/（源码）、components/ 删掉省 30MB。
RUN npm ci --omit=dev --ignore-scripts \
    && rm -rf node_modules/mathjax-full/es5 node_modules/mathjax-full/ts node_modules/mathjax-full/components
COPY backend/rendering-engine/engine ./engine
COPY backend/rendering-engine/UPSTREAM ./UPSTREAM
RUN test -f engine/bin/rpr-retain.js \
    && test -f node_modules/mathjax-full/package.json \
    && test -f node_modules/fontkit/package.json \
    && node -e 'require("./engine/src/retain/run"); require("./engine/src/retain/measured"); require("fontkit")'

# 运行时用的 node：按目标架构拉取官方镜像，只取二进制，不在里面执行任何命令。
FROM node:22-bookworm-slim AS noderuntime

FROM python:3.11-slim-bookworm AS runtime

ARG CMARKER_VERSION=0.1.10
ARG MITEX_VERSION=0.2.7
ARG FX_VERSION=0.0.5
ARG RETAINPDF_UID=10001
ARG RETAINPDF_GID=10001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROJECT_ROOT=/app \
    RETAINPDF2DOC_CLI=/app/services/retainpdf2doc/dist/cli.mjs \
    RETAIN_RPR_ENGINE_DIR=/app/services/rendering-engine \
    RUST_API_ROOT=/app/services/api \
    RUST_API_DATA_ROOT=/data \
    OUTPUT_ROOT=/data/jobs \
    HOME=/data/runtime-home \
    TMPDIR=/tmp/retainpdf \
    XDG_CACHE_HOME=/data/runtime-home/.cache \
    XDG_CONFIG_HOME=/data/runtime-home/.config \
    PYTHON_BIN=python3 \
    RETAIN_OCR_PROVIDER_CONFIG=/app/services/config/ocr_providers.json \
    TYPST_BIN=/usr/local/bin/typst \
    TYPST_PACKAGE_PATH=/app/backend/typst-packages \
    TYPST_PACKAGE_CACHE_PATH=/data/typst-package-cache \
    RETAIN_PDF_FONT_PATH=/usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Regular.otf \
    RETAIN_PDF_TITLE_BOLD_FONT_PATH=/usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Bold.otf \
    RETAIN_PDF_TYPST_FONT_DIRS=/usr/local/share/fonts/source-han-serif \
    RETAIN_PDF_TYPST_FONT_FAMILY="Source Han Serif SC" \
    RUST_API_AI_SUPERVISE=1 \
    RUST_API_AI_COMMAND=python3 \
    RUST_API_AI_ARGS="-m retainpdf_ai" \
    RUST_API_AI_CWD=/app/services/ai \
    RETAIN_AI_FX_COMMAND=/usr/local/bin/fx \
    RETAIN_AI_FX_EXPECTED_VERSION=${FX_VERSION} \
    RETAIN_AI_FX_AGENT_CLI_COMMAND=/usr/local/bin/retainpdf-agent \
    RETAIN_AI_FX_STATE_ROOT=/data/agent-runtime/fx \
    FX_AUTO_UPGRADE=0 \
    CMARKER_VERSION=${CMARKER_VERSION} \
    MITEX_VERSION=${MITEX_VERSION} \
    RUST_API_BIND_HOST=0.0.0.0 \
    RUST_API_PORT=41000 \
    RUST_API_SIMPLE_PORT=42000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    fonts-noto-cjk \
    passwd \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=typstsrc /opt/typst/bin/typst /usr/local/bin/typst
COPY --from=typstsrc /opt/typst-packages /app/backend/typst-packages
COPY --from=typstsrc /opt/fx/bin/fx /usr/local/bin/fx
COPY --from=typstsrc /opt/fx/licenses /usr/share/licenses/fx

RUN mkdir -p /usr/local/share/fonts/source-han-serif

COPY resources/fonts /usr/local/share/fonts/source-han-serif
COPY ops/deployment/docker/backend/fontconfig/65-source-han-serif-alias.conf /etc/fonts/conf.d/65-source-han-serif-alias.conf

RUN fc-scan /usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Regular.otf >/dev/null \
    && fc-scan /usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Bold.otf >/dev/null \
    && fc-cache -f

COPY --from=python-lock /requirements-backend.txt /tmp/requirements-backend.txt
RUN pip install --no-cache-dir --require-hashes -r /tmp/requirements-backend.txt

COPY --from=builder /build/target/release/rust_api /usr/local/bin/rust_api
COPY --from=builder /build/target/release/retain-jobsd /usr/local/bin/retain-jobsd
COPY --from=builder /build/target/release/retainpdf-agent /usr/local/bin/retainpdf-agent
COPY backend/config /app/services/config
COPY backend/pipeline /app/services/pipeline
# Node 运行时:直接从官方 node 镜像取二进制（两边都是 bookworm，ABI 一致），
# 比 apt 装一个过时的 nodejs 干净。必须来自按目标架构拉取的 noderuntime，
# 不能来自钉在构建机架构上的 docbuilder。
COPY --from=noderuntime /usr/local/bin/node /usr/local/bin/node
COPY --from=docbuilder /build/backend/packages/retainpdf2doc/dist /app/services/retainpdf2doc/dist
COPY --from=docbuilder /build/backend/packages/retainpdf2doc/assets /app/services/retainpdf2doc/assets
COPY --from=rprengine /build/rendering-engine /app/services/rendering-engine
COPY backend/ai /app/services/ai
# 底座包（阶段事件、JSON 落盘、路径、本地密钥）：pipeline 依赖它。
COPY backend/base /app/services/base
# 公式包（LaTeX 登记表、公式检查）：pipeline 依赖它；登记表 json 随包数据装进去。
COPY backend/math /app/services/math
# 翻译包（retainpdf-translation）：pipeline 的翻译 worker 外壳调它；提示词随包数据装进去。
COPY backend/translation /app/services/translation
# 翻译 agent 包：翻译包的 agent 引擎（workflow/agent_flow.py）调它，只用标准库。
COPY backend/translation-agent /app/services/translation-agent
RUN pip install --no-cache-dir --no-deps /app/services/base /app/services/math /app/services/translation-agent /app/services/translation /app/services/pipeline /app/services/ai
COPY backend/api/auth.local.example.json /app/services/api/auth.local.example.json
COPY ops/deployment/docker/backend/entrypoint-app.sh /entrypoint.sh
COPY ops/deployment/docker/backend/api-key.sh /usr/local/lib/retainpdf/api-key.sh

RUN groupadd --gid "${RETAINPDF_GID}" retainpdf \
    && useradd \
      --uid "${RETAINPDF_UID}" \
      --gid "${RETAINPDF_GID}" \
      --home-dir /data/runtime-home \
      --no-create-home \
      --shell /usr/sbin/nologin \
      retainpdf \
    && chmod +x /entrypoint.sh \
    && mkdir -p \
      /app/services/api \
      /data/uploads \
      /data/downloads \
      /data/db \
      /data/jobs \
      /data/typst-package-cache \
      /data/agent-runtime/fx \
      /data/runtime-home/.cache \
      /data/runtime-home/.config \
      /tmp/retainpdf \
      /run/retainpdf-key \
    && chown -R retainpdf:retainpdf /data /tmp/retainpdf /run/retainpdf-key \
    && chmod 0700 /run/retainpdf-key

VOLUME ["/data"]

EXPOSE 41000 42000

USER retainpdf:retainpdf

ENTRYPOINT ["/entrypoint.sh"]
