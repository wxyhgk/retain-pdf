FROM rust:1.89-slim-bookworm AS builder

ARG TYPST_VERSION=0.14.2
ARG CMARKER_VERSION=0.1.8
ARG MITEX_VERSION=0.2.6

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY backend ./backend
COPY database ./database
COPY contracts ./contracts
COPY resources/fonts ./resources/fonts

WORKDIR /build
RUN cargo build --release --locked --workspace --bins

FROM python:3.11-slim-bookworm AS python-lock

COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

WORKDIR /workspace

COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/ai/pyproject.toml ai/pyproject.toml
COPY backend/pipeline/pyproject.toml pipeline/pyproject.toml

RUN uv export \
    --locked \
    --no-dev \
    --no-emit-workspace \
    --format requirements-txt \
    --output-file /requirements-backend.txt

FROM python:3.11-slim-bookworm AS typstsrc

ARG TYPST_VERSION=0.14.2
ARG CMARKER_VERSION=0.1.8
ARG MITEX_VERSION=0.2.6
ARG FX_VERSION=0.0.5

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tar \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/typst /opt/typst/bin /opt/typst-packages/preview

RUN set -eux; \
    ARCH="$(uname -m)"; \
    case "$ARCH" in \
      x86_64) TYPST_ARCH="x86_64" ;; \
      aarch64) TYPST_ARCH="aarch64" ;; \
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;; \
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
RUN set -eux; \
    ARCH="$(uname -m)"; \
    case "$ARCH" in \
      x86_64) \
        FX_ARCH="x86_64"; \
        FX_SHA256="d5639d173267774aa8228a474baf619a7076ac41a91023915007c865143429b1" \
        ;; \
      aarch64) \
        FX_ARCH="aarch64"; \
        FX_SHA256="8bbcde6a41256c4fac4e0a022291cf02740419e27afabde3b8f45e7a4e393edb" \
        ;; \
      *) echo "Unsupported architecture for fx: $ARCH"; exit 1 ;; \
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
    test "$(/opt/fx/bin/fx --version)" = "$FX_VERSION"

FROM python:3.11-slim-bookworm AS runtime

ARG CMARKER_VERSION=0.1.8
ARG MITEX_VERSION=0.2.6
ARG FX_VERSION=0.0.5
ARG RETAINPDF_UID=10001
ARG RETAINPDF_GID=10001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROJECT_ROOT=/app \
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
COPY backend/ai /app/services/ai
RUN pip install --no-cache-dir --no-deps /app/services/pipeline /app/services/ai
COPY backend/api/auth.local.example.json /app/services/api/auth.local.example.json
COPY ops/deployment/docker/backend/entrypoint-app.sh /entrypoint.sh

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
    && chown -R retainpdf:retainpdf /data /tmp/retainpdf

VOLUME ["/data"]

EXPOSE 41000 42000

USER retainpdf:retainpdf

ENTRYPOINT ["/entrypoint.sh"]
