# resources

这个目录用于放仓库级资源，避免把 logo、动画、示例文件和本地运行时继续散落到 `backend/`、`frontend/`、`desktop/` 等源码目录里。

## 分类

- `brand/`：logo、二维码、品牌图、发布展示图。
- `animations/`：动效素材、演示动画、加载动画源文件。
- `samples/`：示例 PDF、测试输入文件、可公开的小样本。
- `runtime/`：本地运行时或平台二进制的归档入口。正式迁移前不要直接移动 `backend/python`、`backend/typst-win32` 这类路径，必须同步更新打包脚本。
- `misc/`：暂时无法归类的资源。定期清理，避免长期堆积。

## 不建议放这里

- 源码：继续放在 `backend/`、`frontend/`、`desktop/`。
- 任务数据：继续放在 `data/jobs`、`data/uploads`、`data/downloads`。
- 密钥文件：不要放入仓库。
- 大体积构建产物：优先忽略或放到发布制品，不要提交。

## backend 整理建议

`backend/` 里真正可疑的不是源码，而是本地运行时和构建产物：

- `backend/rust_api/target/` 是 Rust 构建产物，可以删除后重新编译。
- `backend/python/` 是 Windows 桌面端 Python runtime，当前被打包脚本引用，迁移前要改 `desktop/scripts/prepare-app.mjs`。
- `backend/typst-win32/` 是 Windows Typst runtime，迁移前也要同步桌面端打包逻辑。

因此短期只新增 `resources/` 入口，不直接搬 `backend/scripts` 或 `backend/rust_api`。
