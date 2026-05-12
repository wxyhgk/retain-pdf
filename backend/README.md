# backend 目录说明

`backend/` 现在同时放了后端源码、打包资源和本地运行时产物。整理时不要把它当成一个纯源码目录直接移动。

## 应保留在 backend 的内容

- `rust_api/`：Rust API 服务源码。Docker、桌面端和系统服务都会通过 `RUST_API_ROOT` 或固定路径找到它。
- `scripts/`：Python OCR、翻译、渲染流水线源码。GitHub Actions、Docker、桌面端打包和本地测试都直接引用这个路径。
- `fonts/`：打包和 Docker 会复制的中文字体资源，目前是正式发布资源，不是缓存。

## 本地或平台运行时产物

- `rust_api/target/`：Rust 构建产物，体积很大，已被 `.gitignore` 忽略，可以安全删除后重新编译。
- `python/`：Windows 桌面端打包用的 Python runtime，已被 `.gitignore` 忽略。后续如果重构，建议迁移到根目录的 `local-runtime/windows/python/` 或桌面端专用 runtime 目录，并同步更新 `desktop/scripts/prepare-app.mjs`。
- `typst-win32/bin/`：Windows Typst 可执行文件目录，已被 `.gitignore` 忽略。`typst-win32/.crates.toml` 和 `.crates2.json` 当前仍是可见文件，后续建议跟随 Typst runtime 一起归档。
- `workspace/`：历史/本地临时工作区，不应作为源码入口继续扩展。
- `.ipynb_checkpoints/`、`.pytest_cache/`、`__pycache__/`：编辑器和 Python 缓存，可以删除。
- `scripts/.env/*.env`、`rust_api/auth.local.json`：本地密钥配置，不能提交。

## 推荐整理方向

不要先移动 `scripts/` 或 `rust_api/`。更稳的方式是新增根目录级运行时归档入口，例如 `local-runtime/`，专门收纳本地二进制、平台 runtime 和大体积可再生成文件。

目标结构可以是：

```text
backend/
  rust_api/        # Rust API 源码
  scripts/         # Python pipeline 源码
  fonts/           # 发布字体资源

local-runtime/
  windows/python/  # Windows Python runtime
  windows/typst/   # Windows Typst runtime
  README.md
```

真正迁移前必须同步更新：

- `desktop/scripts/prepare-app.mjs`
- `.github/workflows/release-desktop.yml`
- `docker/Dockerfile.app`
- 相关 README 和测试里的固定路径

## 当前拆分边界

后端解耦进度以仓库根目录的 `task_decoupling_master.csv` 为准。当前稳定边界是：

- Rust API 负责任务状态、stage spec、事件、artifact 引用和进程编排。
- Python `backend/scripts/runtime/pipeline/` 只做阶段编排，不直接消费 OCR provider 原始结构。
- Python 翻译入口走 `services.translation.workflow` facade。
- Python 渲染源 PDF 预处理走 `services.rendering.source_pdf`，不要把 hidden-text strip / compression 细节写回 runtime pipeline。
- OCR provider 原始产物必须先进入 `document.v1.json`，翻译和渲染只消费 normalized document 与 translation artifacts。

新增跨层依赖前，先跑：

```bash
python3 backend/scripts/devtools/check_pipeline_architecture.py
python3 backend/scripts/devtools/check_stage_specs_contract.py data/jobs
```

## 立即可做的安全清理

如果只是想释放空间，可以删除这些 ignored 目录，不会影响 Git 历史：

```bash
rm -rf backend/rust_api/target
find backend -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.ipynb_checkpoints' \) -prune -exec rm -rf {} +
```

删除后需要重新编译 Rust API。
