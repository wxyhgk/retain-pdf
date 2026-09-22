#!/usr/bin/env bash
# 从源码启动 RetainPDF（无 Docker；面向 WSL2 这类 localhost 转发不可靠的环境）。
#
# 后端交给官方入口 ops/development/dev_stack.py：它负责 uv sync + cargo build，
# 然后拉起 rust_api，并由 rust_api 托管 jobsd 与 AI 服务。
# 前端交给 frontend/web/scripts/serve_same_origin.py：同源托管前端静态资源，
# 并把 /api 转发到后端，浏览器因此只需访问一个端口。
#
# 环境变量（都可省略）：
#   WEB_PORT          前端端口，默认 40001
#   RUST_API_PORT     后端端口，默认 41000
#   RUST_API_SIMPLE_PORT  同步翻译端口，默认 42000
#   RUST_API_KEYS     后端鉴权 key；不设时 dev_stack.py 兜底 dev-local-key
#   TYPST_BIN         typst 可执行文件；不设时用 PATH 上的 typst
#   NO_BUILD=1        跳过 uv sync / cargo build
#
# 用法：ops/development/run_from_source.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_PORT="${WEB_PORT:-40001}"
API_PORT="${RUST_API_PORT:-41000}"
SIMPLE_PORT="${RUST_API_SIMPLE_PORT:-42000}"
DATA_ROOT="${RUST_API_DATA_ROOT:-$REPO_ROOT/data}"
LOG_DIR="$REPO_ROOT/data"

# 后端与代理必须用同一把 key：dev_stack.py 在 RUST_API_KEYS 未设时兜底 dev-local-key，
# 这里用同样的兜底，并 export 出去，避免一端一个值导致全部接口 401。
BACKEND_KEY="${RUST_API_KEYS:-dev-local-key}"
export RUST_API_KEYS="$BACKEND_KEY"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "[run] 错误：找不到 python3。" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

# ---- 1. 前端运行时配置：只写同源 apiBase，不放任何密钥 ----
# 密钥由 serve_same_origin.py 在转发 /api 时注入；模型 / OCR 凭据请填在
# 「设置 → 凭据」，不要写进这个文件（见 runtime-config.local.example.js 的约定）。
cat > "$REPO_ROOT/frontend/web/runtime-config.local.js" <<'EOF'
// 由 ops/development/run_from_source.sh 生成：前端与后端同源。
// 这里只放非密钥配置；密钥请用「设置 → 凭据」。
window.__FRONT_RUNTIME_CONFIG__ = {
  ...(window.__FRONT_RUNTIME_CONFIG__ || {}),
  apiBase: window.location.origin,
};
EOF
echo "[run] 已写入 frontend/web/runtime-config.local.js (apiBase=同源)"

# ---- 2. 后端（官方 dev_stack.py） ----
backend_up() {
  curl -fsS -m 2 "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1
}

if backend_up; then
  echo "[run] 后端已在运行（:${API_PORT}），跳过启动"
else
  STACK_ARGS=(--port "$API_PORT" --simple-port "$SIMPLE_PORT" --data-root "$DATA_ROOT")
  if [ "${NO_BUILD:-0}" = "1" ]; then
    STACK_ARGS+=(--no-sync --no-build)
  fi
  echo "[run] 启动后端（首次会 uv sync + cargo build，比较慢）..."
  nohup "$PYTHON_BIN" "$REPO_ROOT/ops/development/dev_stack.py" "${STACK_ARGS[@]}" \
    > "$LOG_DIR/dev-stack.log" 2>&1 &
  STACK_PID=$!
  echo "[run] 后端日志：data/dev-stack.log"

  echo -n "[run] 等待后端就绪"
  READY=0
  for _ in $(seq 1 300); do
    if backend_up; then
      READY=1
      break
    fi
    if ! kill -0 "$STACK_PID" 2>/dev/null; then
      break
    fi
    echo -n "."
    sleep 2
  done

  if [ "$READY" != "1" ]; then
    echo ""
    echo "[run] 错误：后端未就绪，请查看 data/dev-stack.log" >&2
    exit 1
  fi
  echo " -> ok"
fi

# ---- 3. 前端同源服务（静态资源 + /api 转发） ----
if curl -fsS -m 2 "http://127.0.0.1:${WEB_PORT}/health" >/dev/null 2>&1; then
  echo "[run] 前端已在运行（:${WEB_PORT}），跳过启动"
else
  echo "[run] 启动前端同源服务 ..."
  nohup "$PYTHON_BIN" "$REPO_ROOT/frontend/web/scripts/serve_same_origin.py" \
    --port "$WEB_PORT" \
    --root "$REPO_ROOT/frontend/web" \
    --api-base "http://127.0.0.1:${API_PORT}" \
    --api-key "$BACKEND_KEY" \
    > "$LOG_DIR/frontend.log" 2>&1 &
  echo "[run] 前端日志：data/frontend.log"
  sleep 2
fi

# ---- 4. 展示访问地址 ----
HOST_IP="$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || true)"
[ -n "$HOST_IP" ] || HOST_IP="127.0.0.1"

echo ""
echo "=============================="
echo "  浏览器访问（前端 + API 同源）:"
echo "    http://127.0.0.1:${WEB_PORT}"
if [ "$HOST_IP" != "127.0.0.1" ]; then
  echo "    http://${HOST_IP}:${WEB_PORT}     # WSL2 下 localhost 转发失效时用这个"
fi
echo "  后端直连（仅本机）: http://127.0.0.1:${API_PORT}/health"
echo "=============================="
