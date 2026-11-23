#!/usr/bin/env bash
# 在一个干净的发行版容器里装 RetainPDF 的 deb，确认自带的 Python 和 Rust 程序能起来（#162）。
#
#   linux_package_smoke.sh <deb 文件>
#
# 给 linux-package-trial.yml 用：每个镜像（ubuntu:20.04 … debian:12）跑一遍。apt 按 deb 的 Depends 装依赖，
# 所以这里同时验了 Depends 写够没有。检查项：
#   1. 自带 python3 清掉 LD_LIBRARY_PATH 后能导入 ssl、sqlite3、ctypes、lzma、bz2、zlib、hashlib、decimal 和主要依赖（fitz、PIL、pikepdf、requests）；
#   2. retainpdf-pipeline、retainpdf（CLI）能打印帮助；
#   3. rust_api、retain-jobsd、retainpdf 的 ldd 没有 not found，起来几秒内没报 GLIBC_ 版本不够；
#   4. Electron 主程序的 ldd 里缺什么库只打印出来，不算失败（看 deb 的 Depends 要不要补）。
set -euo pipefail

deb="${1:?usage: linux_package_smoke.sh <deb>}"
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq "$deb" file >/dev/null
echo "== installed: $(dpkg-deb -f "$deb" Package) $(dpkg-deb -f "$deb" Version)"
echo "== Depends: $(dpkg-deb -f "$deb" Depends)"

package="$(dpkg-deb -f "$deb" Package)"
# 文件清单先落盘再查：pipefail 下 dpkg -L | grep -m1 会因 grep 先退出让 dpkg 吃 SIGPIPE（exit 141）。
files="$(mktemp)"
dpkg -L "$package" >"$files"
python="$(grep -m1 '/resources/backend/python/bin/python3$' "$files")"
backend="$(dirname "$(dirname "$(dirname "$python")")")"
echo "== backend root: $backend"

failed=0
check() {
  local label="$1"; shift
  if "$@"; then echo "ok   $label"; else echo "FAIL $label"; failed=1; fi
}

check "python imports" env -u LD_LIBRARY_PATH "$python" -c '
import ssl, sqlite3, ctypes, lzma, bz2, zlib, hashlib, decimal
import fitz, PIL.Image, pikepdf, requests
print(ssl.OPENSSL_VERSION, sqlite3.sqlite_version)
'
check "python loads its own interpreter" env -u LD_LIBRARY_PATH "$python" -c '
import sys
maps = open("/proc/self/maps").read()
assert "libpython" not in maps or sys.prefix in maps, "libpython loaded from outside the bundle"
'
check "retainpdf-pipeline --help" sh -c "env -u LD_LIBRARY_PATH '$backend/python/bin/retainpdf-pipeline' --help >/dev/null"

for binary in rust_api retain-jobsd retainpdf; do
  path="$backend/bin/$binary"
  if [ ! -x "$path" ]; then echo "FAIL $binary missing at $path"; failed=1; continue; fi
  check "$binary ldd" sh -c "! ldd '$path' 2>&1 | grep -q 'not found'"
done
check "retainpdf --help" sh -c "'$backend/bin/retainpdf' --help >/dev/null"
# rust_api 没有 --help，一运行就起服务：跑 5 秒，只看是不是一启动就因为 glibc / 动态库失败。
log="$(mktemp)"
set +e
timeout 5 "$backend/bin/rust_api" >"$log" 2>&1
status=$?
set -e
if grep -Eq 'GLIBC_[0-9.]+.*not found|error while loading shared libraries' "$log"; then
  echo "FAIL rust_api start (exit $status)"; cat "$log"; failed=1
else
  echo "ok   rust_api start (exit $status; 124 = still running after 5 s)"
  # 退出码不是 124 时把它说了什么印出来（容器里没有配置和数据目录，起不来是预期的，要看是不是这个原因）
  if [ "$status" -ne 124 ]; then sed -n '1,15p' "$log" | sed 's/^/     rust_api: /'; fi
fi

electron=""
while read -r f; do
  if [ -f "$f" ] && [ -x "$f" ] && file -b "$f" 2>/dev/null | grep -q ELF; then electron="$f"; break; fi
done < <(grep -E '^/opt/[^/]+/[^/.]+$' "$files" || true)
if [ -n "$electron" ]; then
  missing="$(ldd "$electron" 2>/dev/null | grep 'not found' || true)"
  if [ -n "$missing" ]; then echo "warn Electron $electron missing libraries (consider deb Depends):"; echo "$missing"; else echo "ok   Electron ldd"; fi
fi

exit "$failed"
