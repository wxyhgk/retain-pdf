#!/usr/bin/env bash
#
# 本地开发栈的启停。
#
# 为什么需要它：`dev_stack.py` 只起后端（rust api + jobsd + ai），静态服务要另起
# 一条命令，而且两边一共要七个环境变量（API key 还得从 runtime-config.local.js
# 里抠出来）。每次重来都手敲一遍，敲错一个 agent 终端就连不上。
#
# 更要紧的是 **nohup**：直接在终端里跑的进程活不过会话，关掉窗口或者会话结束就
# 全没了，再开一次要等一分钟 cargo。这里全部 nohup + disown。
#
#   ops/development/dev.sh up               起（首次或改过 Rust 之后）
#   ops/development/dev.sh up --fast        起（跳过 cargo build，改前端时用）
#   ops/development/dev.sh up --same-origin 起，前端与 API 同源（见下）
#   ops/development/dev.sh up --host 127.0.0.1  后端只监听本机（key 是默认值时自动这样）
#   ops/development/dev.sh down             停
#   ops/development/dev.sh status           看端口和健康状况
#   ops/development/dev.sh logs             跟日志
#
# `--same-origin` 换用 `serve_same_origin.py`：静态资源和 `/api` 都挂在
# STATIC_PORT 上，浏览器不必直连 API 端口。WSL2 的 localhost 转发会按端口失效
# （40001 通、41000 不通），同源之后只剩一个端口要转发。代价是没有这层问题、也
# 不需要绕开 CORS 时多一跳代理。
#
# API key **不写进这个脚本**，运行时从 runtime-config.local.js（gitignored）读。
set -uo pipefail
# 开 job control：后台任务会进**自己的进程组**。
# nohup 只挡 SIGHUP，挡不住给整个进程组发的 SIGTERM —— 实测被调用方收尾时
# 一起带走了（日志里是 "received signal 15"）。
set -m

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="${TMPDIR:-/tmp}/retainpdf-dev"
STATIC_PORT=40001
API_PORT=41000
# 和 dev_stack.py 的 DEFAULT_API_KEY 一致：用它时后端只能监听本机。
DEFAULT_API_KEY="dev-local-key"
# data-root 默认指向主 checkout —— worktree 里开发时共用同一份 data，
# 不然每个 worktree 都要重新跑一遍 OCR 和翻译。
DATA_ROOT="${RETAINPDF_DATA_ROOT:-$HOME/Code/retain-pdf/data}"

mkdir -p "$RUN_DIR"

# ---------------------------------------------------------------- 环境

load_env() {
  local cfg="$REPO/frontend/web/runtime-config.local.js"
  if [[ ! -f "$cfg" ]]; then
    echo "找不到 $cfg —— 没有它后端起不来（API key 在里面）" >&2
    return 1
  fi
  RUST_API_KEYS="$(grep -oE 'xApiKey:[[:space:]]*"[^"]*"' "$cfg" | sed 's/.*"\(.*\)"/\1/')"
  if [[ -z "$RUST_API_KEYS" ]]; then
    echo "从 $cfg 里没抠出 xApiKey" >&2
    return 1
  fi
  export RUST_API_KEYS
  export RETAIN_AI_API_KEYS="$RUST_API_KEYS"
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
  # 默认 SDK 链接不了 C 程序（arm64e.x1），得指到这个。
  export SDKROOT="${SDKROOT:-/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk}"
  export PYTHONPATH="$REPO/backend/ai:$REPO/backend/base:$REPO/backend/math:$REPO/backend/pipeline:$REPO/backend/translation:$REPO/backend/translation-agent"
  # agent 终端：走真 shell，并把思考档位和 provider 参数透给 fx。
  export RETAIN_AI_FX_SHELL_MODE=1
  export RETAIN_AI_FX_REASONING_EFFORTS="${RETAIN_AI_FX_REASONING_EFFORTS:-low,high,max}"
  export RETAIN_AI_FX_UPSTREAM_EXTRA="${RETAIN_AI_FX_UPSTREAM_EXTRA:-{\"thinking\":{\"type\":\"enabled\"}}}"
}

port_pids() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $2}' | sort -u
}

# ---------------------------------------------------------------- 命令

# 组装 dev_stack 的启动参数。
#
# 单独成函数**是为了能验证它**：这几行原来内联在 cmd_up 里，而 cmd_up 会杀端口、
# 起后台进程，没法在测试里跑。于是这段一直没被任何东西守着 —— 直到它真的坏了。
#
# 坏法是这样的：macOS 自带 bash 3.2，`set -u` 下展开**空数组**会报
# `unbound variable`。所以 `"${build_flag[@]}"` 在不带 --fast 时直接炸，
# 也就是**改过 Rust 之后必须走的那条路**。而报错指向脚本行号，看不出是空数组。
# `${arr[@]+"${arr[@]}"}` 是 3.2 安全的写法：数组为空时整个展开消失。
#
# 后端监听地址：默认 0.0.0.0（既定做法，见 test_dev_sh.py）。但 key 还是默认的
# dev-local-key 时，dev_stack.py 拒绝在非本机地址上监听（"a non-default RUST_API_KEYS
# value is required for non-loopback listening"），`up` 就起不来。这时退回 127.0.0.1，
# 并在 `up` 里说一声；要别的地址用 `up --host <地址>`（或环境变量 API_HOST）。
api_host() {
  if [[ -n "${API_HOST:-}" ]]; then
    printf '%s' "$API_HOST"
  elif [[ ",${RUST_API_KEYS:-}," == *",$DEFAULT_API_KEY,"* || -z "${RUST_API_KEYS:-}" ]]; then
    printf '127.0.0.1'
  else
    printf '0.0.0.0'
  fi
}

stack_argv() {
  local fast="${1:-}"
  local build_flag=()
  [[ "$fast" == "--fast" ]] && build_flag=(--no-build)
  printf '%s ' --host "$(api_host)" --port "$API_PORT" --data-root "$DATA_ROOT" --no-sync \
    ${build_flag[@]+"${build_flag[@]}"}
  printf '\n'
}

cmd_down() {
  local killed=0
  for port in "$STATIC_PORT" "$API_PORT" 41002 41100 42000; do
    for pid in $(port_pids "$port"); do
      kill "$pid" 2>/dev/null && killed=1
    done
  done
  # dev_stack 自己会带起子进程，按名字兜一次底。
  pkill -f "ops/development/dev_stack.py" 2>/dev/null && killed=1
  pkill -f "frontend/web/scripts/serve_static.py" 2>/dev/null && killed=1
  pkill -f "frontend/web/scripts/serve_same_origin.py" 2>/dev/null && killed=1
  sleep 1
  if [[ "$killed" == 1 ]]; then echo "已停"; else echo "本来就没在跑"; fi
}

cmd_up() {
  local fast=""
  local same_origin=""
  # `${@+"$@"}`：bash 3.2 下 `set -u` 展开空的 "$@" 同样会报 unbound，
  # 和 stack_argv 里那个空数组是同一类坑。
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --fast) fast="--fast" ;;
      --same-origin) same_origin=1 ;;
      --host)
        [[ $# -ge 2 ]] || { echo "--host 后面要跟地址" >&2; return 2; }
        API_HOST="$2"; shift ;;
      --host=*) API_HOST="${1#--host=}" ;;
      *) echo "未知参数: $1（用法见 $0）" >&2; return 2 ;;
    esac
    shift
  done
  load_env || return 1
  if [[ -z "${API_HOST:-}" && "$(api_host)" == "127.0.0.1" ]]; then
    echo "API key 还是默认的 ${DEFAULT_API_KEY}，后端只监听 127.0.0.1（换成别的 key 才能绑 0.0.0.0）"
  fi
  # 先停：端口被占着起不来，而「起不来」的报错往往指向别处（之前有过一次
  # 主 checkout 的 jobsd 残留在 41002，表现是 502/503 风暴）。
  cmd_down >/dev/null

  # 静态服务默认 serve_static.py；--same-origin 换成 serve_same_origin.py，
  # 由它把 /api 一起转发，浏览器就只剩 STATIC_PORT 一个端口要够得着。
  # key 不用传：load_env 已经 export RUST_API_KEYS，那个脚本直接读环境变量，
  # 免得 key 出现在命令行上（ps 可见）。
  local static_entry="serve_static.py"
  local static_extra=""
  if [[ -n "$same_origin" ]]; then
    static_entry="serve_same_origin.py"
    static_extra="--api-base http://127.0.0.1:$API_PORT"
  fi

  nohup python3 "$REPO/frontend/web/scripts/$static_entry" \
    --host 0.0.0.0 --port "$STATIC_PORT" --root "$REPO/frontend/web" $static_extra \
    >"$RUN_DIR/static.log" 2>&1 &
  disown

  nohup python3 "$REPO/ops/development/dev_stack.py" $(stack_argv "$fast") \
    >"$RUN_DIR/stack.log" 2>&1 &
  disown

  echo -n "等后端就绪"
  for _ in $(seq 1 180); do
    if curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/health" 2>/dev/null; then
      echo " ✓"
      cmd_status
      return 0
    fi
    if ! pgrep -f "ops/development/dev_stack.py" >/dev/null 2>&1; then
      echo " ✗"
      echo "dev_stack 退出了，最后几行："
      tail -n 15 "$RUN_DIR/stack.log"
      return 1
    fi
    echo -n "."
    sleep 1
  done
  echo " ✗ 超时"
  tail -n 15 "$RUN_DIR/stack.log"
  return 1
}

cmd_status() {
  local health
  health="$(curl -s "http://127.0.0.1:$API_PORT/health" 2>/dev/null)"
  if [[ -n "$health" ]]; then
    python3 -c "
import json,sys
d=json.loads(sys.argv[1])['data']
print(f\"  后端    rust={d['status']} ai={d['ai_service']} jobsd={d['jobsd']} db={d['db']}\")
" "$health" 2>/dev/null || echo "  后端    在跑（/health 解析不了）"
  else
    echo "  后端    没在跑"
  fi
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$STATIC_PORT/reader.html" 2>/dev/null)"
  echo "  静态    reader.html -> ${code:-没在跑}"
  if pgrep -f "frontend/web/scripts/serve_same_origin.py" >/dev/null 2>&1; then
    echo "  同源    /api 也走 ${STATIC_PORT}（浏览器不用够到 ${API_PORT}）"
  fi
  echo "  阅读页  http://127.0.0.1:$STATIC_PORT/reader.html?job_id=<JOB_ID>"
  echo "  日志    $RUN_DIR/{stack,static}.log"
}

cmd_logs() { tail -f "$RUN_DIR/stack.log" "$RUN_DIR/static.log"; }

case "${1:-status}" in
  up)     shift; cmd_up "${@+"$@"}" ;;
  argv)   stack_argv "${2:-}" ;;  # 只组装参数（测试用），key 从环境变量 RUST_API_KEYS 读
  down)   cmd_down ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  *)      echo "用法: $0 {up [--fast] [--same-origin] [--host <地址>]|down|status|logs|argv [--fast]}" >&2; exit 2 ;;
esac
