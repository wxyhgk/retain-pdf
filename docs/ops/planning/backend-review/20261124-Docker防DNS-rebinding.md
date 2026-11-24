# Docker 防 DNS rebinding

2026-11-24。API 往企业级靠的审计（运维与安全方向）的 H1。分支 `fix/docker-host-check`。

## 问题

两条各自合理的规矩叠在一起出了洞，以前的记录（[局域网暴露与占位 key](./20261024-局域网暴露与占位key.md)、
[单机来源和主机校验](../api-reorg/20261022-单机来源和主机校验.md)）没有一起讨论过：

1. web 容器的 NGINX 替没带 `X-API-Key` 的请求补上后端 key（`nginx.conf.template`，`server_name _`，`Host` 原样转发）；
2. 容器里后端监听 `0.0.0.0`（`delivery/docker/app.env`），后端只在监听回环或配了 `RUST_API_ALLOWED_HOSTS` 时才查 `Host`
   （`retainpdf-core/src/config/origin_policy.rs` 的 `allows_host`）。

宿主机端口默认只开在 `127.0.0.1:40001`，挡得住别的机器，挡不住本机浏览器：用户打开恶意网页，对方把自己的域名解析到
`127.0.0.1`，页面就能以同源身份调 `http://<那个域名>:40001/api/*`，NGINX 补 key，后端不查 `Host`——删书、恢复备份、
改凭据都行。

## 决定

- 在 NGINX 这一层按 `Host` 判断（后端看不出请求是不是经过 NGINX、外面暴露没有，在后端拒绝会让默认部署起不来）：
  - `map $host $retainpdf_host_allowed`：`localhost`、`*.localhost`、IPv4 字面量、IPv6 字面量（必须带冒号——只由
    `0-9a-f` 和点组成的域名如 `abc.cafe` 不算）、`RETAINPDF_ALLOWED_HOSTS` 里的主机名算本机；
  - 只有本机 `Host` 且请求没带 key 时才补后端 key；自己带 `X-API-Key` 的照常转发（攻击者拿不到 key）；
  - 别的 `Host`、没带 key、而且本来会补 key 时，`/api/` 和进度流直接 403，信封和后端一样，`error.details.reason`
    为 `host_not_allowed`，`message` 说明去 `web.env` 写 `RETAINPDF_ALLOWED_HOSTS`；
  - 多用户叠加配置不补 key（`RETAINPDF_PROXY_API_KEY` 为空），不拦，行为不变。
- `RETAINPDF_ALLOWED_HOSTS`（`web.env`，逗号或空格分隔，可带端口）由新的入口脚本 `allowed-hosts.sh`
  （镜像里是 `/docker-entrypoint.d/16-retainpdf-allowed-hosts.sh`，排在模板展开前面）写成 `allowed-hosts.map`，
  只收 `[a-z0-9.-]`，别的整条跳过并警告，`set -f` 防通配符展开。
- **升级影响**：用域名（宿主机 NGINX 示例、局域网机器名）访问的部署，升级后要在 `web.env` 写上主机名，否则 `/api/` 403。
  交付包 README、宿主机 NGINX 示例、`docs/core/api/index.md` 写明。

## 测试

- `.github/scripts/tests/test_docker_nginx_host_check.py`：静态核对每个补 key 的 location 都有拦截、镜像接上脚本；
  真跑入口脚本（大小写、端口、非法字符、`*`）；**用真的 nginx 跑渲染后的模板**，对着假后端发不同 `Host` 的请求：
  本机名、IP、`[::1]`、`*.localhost`、名单里的域名补 key，`evil.example`、`abc.cafe`、`dead.beef` 403（含进度流），
  自带 key 照常转发，多用户（不补 key）不拦。CI 的 Ubuntu 自带 nginx，CI 上找不到 nginx 直接失败；本机没有 nginx 跳过。
- 没在真容器里跑（本机 Docker 守护进程没开）；镜像构建在 CI 的 web 镜像流水线。
