# 本地从源码运行（无 Docker / WSL2）

不装 Docker，直接用 `dev.sh` 把后端与前端跑起来。这份文档另外说明 WSL2 下一个
常见问题：Windows 浏览器访问不到 WSL 里的后端端口。

## 一、运行形态

| 组件 | 入口 | 说明 |
| --- | --- | --- |
| 起停 | `ops/development/dev.sh` | 收口下面两个进程、注入七个环境变量、nohup 托管 |
| 后端 | `ops/development/dev_stack.py` | `uv sync` + `cargo build` 后拉起 `rust_api`，再由 `rust_api` 托管 `jobsd` |
| 前端 | `frontend/web/scripts/serve_static.py` | 静态托管 `frontend/web`（`dist/` 与 `vendor/` 已提交） |
| 前端（同源） | `frontend/web/scripts/serve_same_origin.py` | `up --same-origin` 时换用它：静态托管之外，把 `/api` 也转发到后端 |

同源那个脚本复用 `serve_static.py` 的静态托管与缓存头，只多两件事：转发 `/api`，
以及把 `apiBase` 钉成当前 origin（否则浏览器会拿着配置文件里的 `:41000` 直连后端）。

## 二、前置依赖

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Rust | 1.70+ | 编译根 Cargo workspace |
| uv | 最新 | 创建 `backend/.venv`，由 `dev_stack.py` 调用 |
| Python | 3.11（`backend/pyproject.toml` 要求 `>=3.11,<3.12`） | 运行 `retainpdf-pipeline` |
| Typst | 0.15.1（与 CI 的 `.github/actions/setup-test-typst` 一致） | PDF 重排渲染 |
| Node.js | 22（与 CI 各 workflow 一致） | 仅当需要重新构建前端时才用到 |
| lsof | — | `dev.sh down` / `status` 靠它按端口找进程 |

Typst 需要落在 `PATH` 上，或用 `TYPST_BIN` 指定可执行文件；两者都没有时流水线会渲染失败。

## 三、启动

```bash
ops/development/dev.sh up            # 首次，或改过 Rust 之后（会 cargo build）
ops/development/dev.sh up --fast     # 跳过构建，改前端时用
ops/development/dev.sh status        # 端口与健康状况
ops/development/dev.sh logs          # 跟日志
ops/development/dev.sh down          # 停
```

`dev.sh` 要求 `frontend/web/runtime-config.local.js` 存在且填了 `xApiKey`——它从那里
读 key，再 export 成 `RUST_API_KEYS` 给后端。没有这个文件 `up` 会直接报错退出。

```bash
cp frontend/web/runtime-config.local.example.js frontend/web/runtime-config.local.js
# 然后把 xApiKey 改成后端要用的值
```

`up` 会先 `down`（端口被占着起不来，而报错常常指向别处），并把两个进程 nohup +
disown，关掉终端不会带走它们。

key 还是默认的 `dev-local-key` 时，后端拒绝在非本机地址上监听，`dev.sh up` 会自动让后端只绑
`127.0.0.1`（并提示一句）；这时只能从本机访问，要从别的机器或 Windows 侧访问就把 key 换成别的值。
也可以用 `up --host <地址>` 指定。

运行数据默认落在 `$HOME/Code/retain-pdf/data`；在别的 checkout 里开发时用
`RETAINPDF_DATA_ROOT` 指过去，避免每个 checkout 各跑一遍 OCR 和翻译。

## 四、WSL2 下浏览器「无法连接后端」

**现象**：后端已启动，在 WSL 内 `curl http://127.0.0.1:41000/health` 正常，但 Windows
浏览器里前端一直报「当前前端无法连接后端」。

**根因**：WSL2 的 localhost 转发可能按端口失效——出现「前端端口（40001）能转发、
后端端口（41000）不能」的不对称情况。此时 Windows 侧 `127.0.0.1:41000` 到不了 WSL
里的服务，而浏览器默认就按配置里的 `:41000` 直连后端。

**解决**：让前端与后端**同源**，浏览器只访问 40001：

```bash
ops/development/dev.sh up --same-origin
```

静态服务换成 `serve_same_origin.py`，由它在 WSL 内把 `/api` 转发到
`127.0.0.1:41000`，绕开 localhost 转发。

注意这**不是**把后端收窄到只监听本机：转发是在服务端做的，浏览器只需要够得着
40001 一个端口；`dev.sh` 起的两个服务仍然都绑 `0.0.0.0`（key 是默认值时后端例外，见上）（这是既定做法，
`ops/development/tests/test_dev_sh.py` 里有门禁守着）。也就是说，少的是浏览器
要访问的端口数，不是监听面——要限制来源得靠防火墙或鉴权。

**这是特定环境的绕行，不是默认路径**：平时用 `up` 即可，同源多一跳代理。只有真的
遇到端口转发不对称（或不想让浏览器直连后端、处理 CORS）时才加 `--same-origin`。

如果 40001 本身也转发不了，用 WSL 的 IP 访问：`http://<WSL-IP>:40001`。

### 用局域网 IP、公网 IP 或域名访问

2026-10-22 起后端只给"本机页面"和"同主机的页面"回 CORS 头，监听回环地址时还校验 `Host`
（规则见 [API 总入口 1.1](api/index.md#11-单机模式的来源和主机)）。各种访问方式要配什么：

| 访问方式 | 要配什么 |
| --- | --- |
| 本机 `http://127.0.0.1:40001` / `http://localhost:40001` | 不用配 |
| 局域网 / 公网 IP 分两个端口：页面 `http://<IP>:40001`、API `http://<IP>:41000` | 不用配：页面和 API 同主机只是端口不同。后端要监听非回环地址，所以 key 不能是默认值 |
| 域名分两个端口：`http://box.example.com:40001` → `:41000` | 不用配（同上） |
| `--same-origin`（`serve_same_origin.py`） | 不用配：浏览器看来同源，后端收到的 `Host` 是 `127.0.0.1:41000` |
| 页面和 API 在不同主机（例如页面 `https://pdf.example.com`、API `http://10.0.0.2:41000`） | `RUST_API_ALLOWED_ORIGINS=https://pdf.example.com` |
| 后端只监听 `127.0.0.1`，前面的反向代理把域名放进 `Host` | `RUST_API_ALLOWED_HOSTS=pdf.example.com`，否则所有请求 `403 request host is not allowed` |
| Docker（web 容器同源代理，后端监听 `0.0.0.0`） | 不用配；想防 DNS rebinding 再写 `RUST_API_ALLOWED_HOSTS`，见 `ops/deployment/docker/delivery/docker/app.env` |

## 五、鉴权与凭据

- **后端 key**：来自 `frontend/web/runtime-config.local.js` 的 `xApiKey`，由 `dev.sh`
  读出来 export 成 `RUST_API_KEYS`。
- **同源模式下浏览器不需要持有 key**：`serve_same_origin.py` 转发时补上 `X-API-Key`；
  请求里已经带了 key 的（例如在「设置 → 凭据」里配过）会原样透传，不会被覆盖。
- **模型 / OCR 凭据**：填在「设置 → 凭据」。

## 六、常见问题

| 现象 | 处理 |
| --- | --- |
| `找不到 …runtime-config.local.js` | 见上面第三步；文件不存在或 `xApiKey` 为空时 `up` 会拒绝启动 |
| `lsof: command not found` | `down` / `status` 依赖它；`apt install lsof` |
| `required backend artifacts are missing` | 先让 `dev_stack.py` 跑完一次完整构建（不要用 `--fast`） |
| 渲染阶段报找不到 typst | 把 typst 放进 `PATH`，或设 `TYPST_BIN` 指向可执行文件 |
| 端口被占用 | `dev.sh` 的端口是固定的（40001 / 41000 / 41002 / 42000）；先 `down` |
| 前端改动没生效 | `dist/` 是提交产物，改源码后要重建 bundle（`npm run verify` 会带上） |
| 后端起来了但页面报错 | `dev.sh status` 看 `/health`；同源模式下再确认 `serve_same_origin.py` 在跑 |
