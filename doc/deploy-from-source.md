# 本地源码部署指南（无 Docker / WSL2 场景）

本文记录在**没有 Docker** 的环境下，从源码把 RetainPDF 后端 + 前端跑起来的完整步骤，以及两个在 **WSL2** 下特别容易踩、但文档里没有明说的坑和对应解法。

## 一、本地源码部署的架构形态

不用 Docker 时，等价于手动跑起 `app` 和 `web` 两个服务：

- **后端**：`backend/rust_api`（Rust API 网关 / 任务调度）+ `backend/scripts`（Python 流水线：OCR 标准化 / 翻译 / Typst 渲染）+ Typst 可执行文件 + 中文字体
- **前端**：`frontend/`（React + TypeScript，构建产物已提交在 `dist/` 与 `vendor/`，无需打包）
- **前端反向代理**：`proxy.py`（托管前端静态资源 + 把 `/api/` 转发到 Rust API 并注入鉴权头）

## 二、前置依赖

| 依赖 | 版本建议 | 用途 |
| --- | --- | --- |
| Rust 工具链 | 1.70+ | 编译 `rust_api` 二进制 |
| Typst | 0.14.x | PDF 重排渲染引擎（外部二进制） |
| Python | **3.11**（`pyproject.toml` 要求 `>=3.11,<3.12`） | 运行翻译/渲染流水线 |
| Node.js + npm | 20+ | 仅当需要重新构建前端时才用到 |

> 后端流水线只用少量 Python 三方库（Pillow / PyMuPDF / pikepdf / requests / urllib3），已整理在 `docker/requirements-app.txt`。

## 三、部署步骤

### 1. 编译 Rust API

```bash
# 安装 rustup（首次）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh
sh /tmp/rustup-init.sh -y --profile minimal

cd backend/rust_api
cargo build --release --locked          # 产出 target/release/rust_api
```

### 2. 安装 Typst

```bash
curl -fsSL https://github.com/typst/typst/releases/download/v0.14.2/typst-x86_64-unknown-linux-musl.tar.xz \
  -o /tmp/typst.tar.xz
mkdir -p /tmp/typst && tar -xJf /tmp/typst.tar.xz -C /tmp/typst --strip-components=1
install -m 0755 /tmp/typst/typst ~/.local/bin/typst
```

> Typst 渲染用到的 `cmarker` / `mitex` 包会在首次渲染时由 Typst 自动从官方 registry 下载，无需手工预装。

### 3. 准备 Python 3.11 环境

```bash
conda create -n retainpdf python=3.11 -y    # 或 python3.11 -m venv .venv
pip install -r docker/requirements-app.txt
```

### 4. 前端（已预构建，通常无需构建）

仓库里 `frontend/dist/` 与 `frontend/vendor/` 已提交构建产物，可直接静态托管。仅当修改了前端源码时才需要：

```bash
cd frontend
npm ci && npm run build
```

### 5. 配置鉴权与运行参数

- `backend/rust_api/auth.local.json`：后端访问白名单（`X-API-Key`），参见 `auth.local.example.json`
- `run.env`：本地运行配置（key / OCR token / 模型 / Python & Typst 路径），参见 `run.env.example`
- 环境变量：`RUST_API_DATA_ROOT`、`RUST_API_SCRIPTS_DIR`、`PYTHON_BIN`、`TYPST_BIN`、`RETAIN_PDF_FONT_PATH` 等（后端启动时读取，并透传给 Python 子进程）

## 四、两个关键问题与解决方案

### 问题 1：WSL2 下浏览器「无法连接后端」（`127.0.0.1:41000` 不通）

**现象**：后端明明已启动、`curl http://127.0.0.1:41000/health` 在 WSL 内返回正常，但 Windows 浏览器里前端一直报「当前前端无法连接后端」。

**根因**：WSL2 的 localhost 转发并不可靠——可能出现**前端端口（如 40001）能转发、后端端口（41000）转发失效**的不对称情况。此时 Windows 侧 `127.0.0.1:41000` 实际上到不了 WSL 里的服务。

**解决方案**：用 `proxy.py` 让前端与后端**同源**，浏览器只访问 `40001`，由代理在 WSL 内转发到后端，从而彻底绕开 localhost 转发问题。详见「五、一键启动脚本」。

### 问题 2：下载 PDF / Markdown / ZIP 报 `401 missing or invalid X-API-Key`

**现象**：页面能正常展示任务，但点击「下载 Markdown ZIP」等按钮时，浏览器直接显示 `{"code":40100,"message":"missing or invalid X-API-Key"}`。

**根因**：后端除 `/health` 外所有接口（含下载）都要求请求头 `X-API-Key`。前端在拿不到鉴权 key 时，下载会退化成浏览器原生 `<a>` 导航——**原生导航无法携带自定义请求头**，于是后端返回 401。

**解决方案**：让 `proxy.py` 在转发 `/api/` 时**自动注入 `X-API-Key`**。这样无论前端是 `fetch` 还是原生导航，请求到达后端时都带上了鉴权头，下载不再 401。

## 五、一键启动脚本

仓库根目录提供了 `run.sh` + `proxy.py` + `run.env.example`，把上面的坑都固化进脚本：

1. **自动检测 WSL IP**（`ip -4 addr show eth0`），仅用于展示访问地址；
2. 从 `run.env` 读取配置，生成 `frontend/runtime-config.local.js`（`apiBase` 设为同源）与 `backend/rust_api/auth.local.json`；
3. **幂等启动**后端（41000/42000）与前端代理 `proxy.py`（40001），日志落到 `data/*.log`。

`proxy.py` 的职责：

- 托管 `frontend/` 静态资源（含 `dist/`、`vendor/` 构建产物）；
- 把 `/health` 与 `/api/*` 反向代理到 `127.0.0.1:41000`，并**自动注入 `X-API-Key`**。

用法：

```bash
cp run.env.example run.env    # 填入自己的 key / token / Python 路径
./run.sh
```

`run.env` 含密钥，已被 `.gitignore` 忽略，请勿提交。

## 六、启动后访问

- 前端：`http://127.0.0.1:40001`（或 `http://<WSL-IP>:40001`）
- 完整 API：`http://127.0.0.1:40001/api/v1/...`（经代理，已注入鉴权）
- 同步翻译接口：`http://<WSL-IP>:42000`（`/api/v1/translate/bundle`）

浏览器只需访问 40001 一个端口，无需再关心后端 41000 与鉴权头。
