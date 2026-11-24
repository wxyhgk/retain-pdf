#!/bin/sh
# 装成 /docker-entrypoint.d/16-retainpdf-allowed-hosts.sh，排在 20-envsubst-on-templates.sh 前面。
# 把 RETAINPDF_ALLOWED_HOSTS（逗号或空格分隔的主机名，可带端口，端口会去掉）写成 NGINX map 的条目：
# 只有这些名字、本机名和 IP 字面量来的请求，NGINX 才替它补后端 key（防 DNS rebinding，见 nginx.conf.template）。
# 只收 [a-z0-9.-]，别的字符整条跳过并警告，不让环境变量往 NGINX 配置里塞东西。文件总会写（可能是空的）。
set -eu
set -f  # 名单里的 * 之类不能展开成文件名
out_dir="${RETAINPDF_ALLOWED_HOSTS_DIR:-/etc/nginx/retainpdf}"
out="$out_dir/allowed-hosts.map"
mkdir -p "$out_dir"
tmp="$out.tmp"
: > "$tmp"
for item in $(printf '%s' "${RETAINPDF_ALLOWED_HOSTS:-}" | tr ',' ' '); do
  name="$(printf '%s' "$item" | tr 'A-Z' 'a-z' | sed 's/:[0-9]*$//')"
  case "$name" in
    "" ) continue ;;
    *[!a-z0-9.-]* )
      echo "WARNING: retainpdf-allowed-hosts: skipping invalid hostname in RETAINPDF_ALLOWED_HOSTS" >&2
      continue ;;
  esac
  printf '  %s 1;\n' "$name" >> "$tmp"
done
mv "$tmp" "$out"
count="$(wc -l < "$out" | tr -d ' ')"
echo "retainpdf-allowed-hosts: $count extra hostname(s) allowed besides localhost and IP literals" >&2
