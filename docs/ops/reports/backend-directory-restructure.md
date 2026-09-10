# 后端目录迁移记录

> 状态：已完成。本文记录历史迁移，不再把旧 `backend/` 路径当作可执行说明。
> 当前后端源码根目录是 `services/`，仓库根 `backend-package.json` 也以
> `"source_path": "services"` 声明这一边界。

## 当前目录

```text
services/
  api/          # Rust HTTP API、SQLite 权威状态、jobsd 与 worker 装配
  ai/           # Python AI 问答与 Agent runtime
  pipeline/     # OCR、翻译、排版和 checkpoint 生产者
  contracts/    # 可抽离后端包使用的 schema 镜像
  config/       # 后端共享运行时配置
  fonts/        # 渲染字体
  docker/       # 容器构建与启动装配
  scripts/      # 后端开发/运维入口
  testdata/     # 可随独立后端包分发的 golden job fixture
```

根目录 `backend/` 目前不是后端源码根；其中残留内容只可视为历史兼容资料或旧测试
入口。新代码、命令和文档不得继续以它作为当前实现位置。

## 历史路径映射

| 历史路径 | 当前路径 |
|---|---|
| `backend/rust_api/` | `backend/api/` |
| `backend/ai_service/` | `backend/ai/` |
| `backend/pipeline/` | `backend/pipeline/` |
| `backend/contracts/` | `backend/contracts/` |
| `backend/config/` | `backend/config/` |
| `backend/fonts/` | `resources/fonts/` |

部分 Rust、桌面或容器装配代码仍可能识别旧路径，以便读取老安装或打包产物。这些
fallback 是兼容层，不改变 `services/` 作为当前真值的事实，也不应复制到新调用方。

## 当前边界

- `backend/api/` 是文档、作业、凭据、pipeline attempt/unit、操作候选与提交状态的
  权威所有者。
- `backend/ai/` 负责会话编排和 runtime 适配，通过 Rust API 持久化状态；它不应
  建立第二套文档或操作真值。
- `backend/pipeline/` 生成 OCR/翻译/渲染产物和 checkpoint；只有 durable commit 的
  状态可供恢复或实时展示。
- `contracts/*.schema.json` 是 monorepo schema 上游真值；
  `backend/contracts/*.schema.json` 是可抽离后端包的逐字节镜像。

## 验收命令

从仓库根目录运行：

```bash
python3 backend/api/scripts/check_architecture.py
cargo test --locked --workspace --manifest-path backend/api/Cargo.toml
PYTHONPATH=backend/pipeline uv run --project backend \
  python backend/pipeline/devtools/check_pipeline_architecture.py
uv run --project backend python -m pytest backend/ai/tests \
  backend/pipeline/devtools/tests -q
python3 backend/contracts/check_parity.py --require-upstream
npm --prefix contracts test
```

测试数量会随代码变化；验收以命令退出状态和失败明细为准，不以历史固定计数为准。
