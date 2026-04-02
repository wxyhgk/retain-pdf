FROM rust:1.81-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/rust_api/Cargo.toml backend/rust_api/Cargo.lock ./backend/rust_api/
COPY backend/rust_api/src ./backend/rust_api/src

WORKDIR /build/backend/rust_api
RUN cargo build --release


FROM python:3.11-slim-bookworm AS runtime

ARG TYPST_VERSION=0.14.2

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PROJECT_ROOT=/app \
    RUST_API_ROOT=/app/backend/rust_api \
    RUST_API_DATA_ROOT=/data \
    OUTPUT_ROOT=/data/jobs \
    PYTHON_BIN=python3 \
    TYPST_BIN=/usr/local/bin/typst \
    DEFAULT_FONT_PATH=/usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Regular.otf \
    TYPST_FONT_FAMILY="Source Han Serif SC" \
    RUST_API_PORT=41000 \
    RUST_API_SIMPLE_PORT=42000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    fonts-noto-cjk \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/typst.tar.xz \
      "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
    && mkdir -p /tmp/typst \
    && tar -xJf /tmp/typst.tar.xz -C /tmp/typst --strip-components=1 \
    && install -m 0755 /tmp/typst/typst /usr/local/bin/typst \
    && rm -rf /tmp/typst /tmp/typst.tar.xz

RUN mkdir -p /usr/local/share/fonts/source-han-serif \
    && ln -sf /usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc /usr/local/share/fonts/source-han-serif/SourceHanSerifSC-Regular.otf \
    && fc-cache -f

COPY docker/requirements-app.txt /tmp/requirements-app.txt
RUN pip install --no-cache-dir -r /tmp/requirements-app.txt

COPY --from=builder /build/backend/rust_api/target/release/rust_api /usr/local/bin/rust_api
COPY backend/scripts /app/backend/scripts
COPY backend/rust_api/auth.local.example.json /app/backend/rust_api/auth.local.example.json
COPY docker/entrypoint-app.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && mkdir -p /app/backend/rust_api /app/backend/scripts /data/uploads /data/downloads /data/db /data/jobs

VOLUME ["/data"]

EXPOSE 41000 42000

ENTRYPOINT ["/entrypoint.sh"]
