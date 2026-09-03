#!/usr/bin/env bash
# RetainPDF 一键启动脚本（本地源码部署，无 Docker / nginx）
#
# 职责：
#   1. 自动检测宿主机可访问的本机 IP（WSL2 用 eth0，规避 localhost 转发失效问题）
#   2. 用 run.env 里的配置生成前端 runtime-config.local.js 与后端 auth.local.json
#   3. 幂等启动后端(41000/42000)与前端代理(40001)，日志写入 data/*.log
#
# 用法：cp run.env.example run.env && ./run.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_ROOT/run.env"

# ---- 默认值（可被 run.env 覆盖）----
BACKEND_KEY="${BACKEND_KEY:-}"
OCR_PROVIDER="${OCR_PROVIDER:-paddle}"
MINERU_TOKEN="${MINERU_TOKEN:-}"
PADDLE_TOKEN="${PADDLE_TOKEN:-}"
MODEL_API_KEY="${MODEL_API_KEY:-}"
MODEL="${MODEL:-deepseek-v4-flash}"
BASE_URL="${BASE_URL:-https://api.deepseek.com/v1}"
APP_PORT="${APP_PORT:-41000}"
SIMPLE_PORT="${SIMPLE_PORT:-42000}"
WEB_PORT="${WEB_PORT:-40001}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
TYPST_BIN="${TYPST_BIN:-typst}"

if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

if [ -z "$BACKEND_KEY" ]; then
  echo "[run] 错误：BACKEND_KEY 未设置。请先复制 run.env.example 为 run.env 并填写。" >&2
  exit 1
fi

# ---- 1. 检测本机 IP ----
detect_ip() {
  ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1
}
HOST_IP="$(detect_ip || true)"
[ -n "$HOST_IP" ] || HOST_IP="127.0.0.1"
echo "[run] 本机 IP: $HOST_IP"

# ---- 2. 生成前端运行时配置（同源访问，由 proxy.py 反向代理到后端）----
cat > "$REPO_ROOT/frontend/runtime-config.local.js" <<EOF
window.__FRONT_RUNTIME_CONFIG__ = {
  ...(window.__FRONT_RUNTIME_CONFIG__ || {}),
  apiBase: window.location.origin,
  xApiKey: "${BACKEND_KEY}",
  ocrProvider: "${OCR_PROVIDER}",
  mineruToken: "${MINERU_TOKEN}",
  paddleToken: "${PADDLE_TOKEN}",
  modelApiKey: "${MODEL_API_KEY}",
  model: "${MODEL}",
  baseUrl: "${BASE_URL}",
};
EOF
echo "[run] 已写入 frontend/runtime-config.local.js (apiBase=同源，经 proxy.py 转发)"

# ---- 3. 生成后端鉴权配置 ----
cat > "$REPO_ROOT/backend/rust_api/auth.local.json" <<EOF
{
  "api_keys": ["${BACKEND_KEY}"],
  "max_running_jobs": 4,
  "simple_port": ${SIMPLE_PORT}
}
EOF
echo "[run] 已写入 backend/rust_api/auth.local.json"

# ---- 4. 启动后端 ----
BIN="$REPO_ROOT/backend/rust_api/target/release/rust_api"
if [ ! -x "$BIN" ]; then
  echo "[run] 错误：未找到 rust_api 二进制。请先编译：" >&2
  echo "        cd $REPO_ROOT/backend/rust_api && cargo build --release --locked" >&2
  exit 1
fi
if curl -fsS -m 2 "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
  echo "[run] 后端已在运行（:${APP_PORT}），跳过启动"
else
  echo "[run] 启动后端 ..."
  env \
    RUST_API_BIND_HOST=0.0.0.0 \
    RUST_API_PORT="$APP_PORT" \
    RUST_API_SIMPLE_PORT="$SIMPLE_PORT" \
    RUST_API_DATA_ROOT="$REPO_ROOT/data" \
    RUST_API_SCRIPTS_DIR="$REPO_ROOT/backend/scripts" \
    PYTHON_BIN="$PYTHON_BIN" \
    TYPST_BIN="$TYPST_BIN" \
    RETAIN_PDF_FONT_PATH="$REPO_ROOT/backend/fonts/SourceHanSerifSC-Regular.otf" \
    RETAIN_PDF_TITLE_BOLD_FONT_PATH="$REPO_ROOT/backend/fonts/SourceHanSerifSC-Bold.otf" \
    RETAIN_PDF_TYPST_FONT_FAMILY="Source Han Serif SC" \
    RETAIN_PDF_TYPST_FONT_DIRS="$REPO_ROOT/backend/fonts" \
    nohup "$BIN" > "$REPO_ROOT/data/rust_api.log" 2>&1 &
  echo "[run] 后端已启动，日志：data/rust_api.log"
fi

# ---- 5. 启动前端（反向代理：静态托管 + /api 转发并注入鉴权头）----
if [ ! -f "$REPO_ROOT/frontend/dist/app.bundle.js" ]; then
  echo "[run] 警告：frontend/dist 不存在，前端可能未构建。" >&2
  echo "       如修改过前端源码，请执行：cd $REPO_ROOT/frontend && npm ci && npm run build" >&2
fi
if curl -fsS -m 2 "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
  echo "[run] 前端已在运行（:${WEB_PORT}），跳过启动"
else
  echo "[run] 启动前端代理 ..."
  env \
    WEB_PORT="$WEB_PORT" \
    RUST_API_PROXY_TARGET="http://127.0.0.1:${APP_PORT}" \
    BACKEND_KEY="$BACKEND_KEY" \
    FRONTEND_DIR="$REPO_ROOT/frontend" \
    nohup python3 "$REPO_ROOT/proxy.py" > "$REPO_ROOT/data/frontend.log" 2>&1 &
  echo "[run] 前端代理已启动，日志：data/frontend.log"
fi

echo ""
echo "=============================="
echo "  前端:  http://${HOST_IP}:${WEB_PORT}   (或 http://127.0.0.1:${WEB_PORT})"
echo "  后端:  http://${HOST_IP}:${APP_PORT}   (/health)"
echo "  同步:  http://${HOST_IP}:${SIMPLE_PORT}"
echo "=============================="
