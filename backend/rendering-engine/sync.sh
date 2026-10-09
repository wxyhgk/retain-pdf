#!/usr/bin/env bash
# 把 rpr 排版引擎（retain-pdf-rendering，MIT）的运行时文件复制进本目录的 engine/。
#
#   backend/rendering-engine/sync.sh [REF] [REPO]
#
# REF  默认 main（可填分支、标签或提交号）
# REPO 默认 ~/Code/retain-pdf-rendering（也可用 RPR_ENGINE_REPO 指定）
#
# 用 git archive 从指定提交取文件，不碰引擎仓库的工作区。只复制运行时需要的最小集合：
# bin/rpr-retain.js、bin/rpr-fit.js、src/（rpr-fit 要用 fit-model）、data/fonts（不含思源宋体）、package.json、LICENSE。
# 同步完写 UPSTREAM（来源仓库与提交）和 engine/COMMIT（引擎报告里的 engine.commit）。
# 运行时 npm 依赖只有 mathjax-full（本目录的 package.json 锁版本），之后跑一次：
#   npm ci --omit=dev
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ref="${1:-main}"
repo="${2:-${RPR_ENGINE_REPO:-$HOME/Code/retain-pdf-rendering}}"
paths=(bin/rpr-retain.js bin/rpr-fit.js src data/fonts package.json LICENSE)

if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
  echo "sync.sh: $repo 不是 git 仓库" >&2
  exit 1
fi
commit="$(git -C "$repo" rev-parse --verify "$ref^{commit}")"
remote="$(git -C "$repo" config --get remote.origin.url || true)"

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
git -C "$repo" archive --format=tar "$commit" -- "${paths[@]}" | tar -x -C "$staging"
# 引擎自带思源宋体（data/fonts/source-han-serif，46 MB）；retain-pdf 的 resources/fonts 已有同一份，
# 调用时用 --font-path 传进去，这里不重复带。后备字体（data/fonts/fallback）照常带上。
rm -rf "$staging/data/fonts/source-han-serif"

rm -rf "$here/engine"
mkdir -p "$here/engine"
cp -R "$staging/." "$here/engine/"
printf '%s\n' "$commit" > "$here/engine/COMMIT"
cat > "$here/UPSTREAM" <<META
repo=${remote:-$repo}
ref=$ref
commit=$commit
synced_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
paths=${paths[*]}
META
echo "synced $commit -> $here/engine"
