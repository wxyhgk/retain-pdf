# 职责目录迁移验收（2026-09-06）

分支：`refactor/responsibility-layout`。迁移前完整基线：`19495d02`。
纯移动提交：`8dbe7d3e`；工作区与路径适配：`0063bc31`。
目录职责见 [repository-layout](../../core/repository-layout.md)。

## 已完成验证

| 验证 | 结果 |
| --- | --- |
| 根 npm 原版本锁文件安装 | `npm ci --ignore-scripts --offline` 成功 |
| 新 Python 工作区安装 | `uv sync --project backend --extra test --locked` 成功 |
| 网页全量 | 1026 passed、1 skipped |
| 桌面 lint 与单元测试 | 34 passed |
| 桌面 frontend-sync | 构建、首次运行资源 smoke、bundle check 通过 |
| Reader 类型检查、domain/API 包验证 | 通过 |
| Rust 全工作区及 doc-tests | 647 passed、1 ignored、0 failed |
| 数据库 crate | 53 passed（包含于 Rust 全集） |
| 翻译离线正序与逆序 | 各 1266 passed |
| 翻译架构检查 | 通过 |
| AI | 174 passed |
| 性能工具离线测试 | 173 passed |
| Agent E2E 工具离线测试 | 23 passed |
| 运维工具 | 20 passed |
| CI 脚本与目录契约 | 74 passed；11 份 workflow/action YAML 可解析 |
| 上游协议 | 8 passed、类型检查通过 |
| 固定 schema/字体内容 | 20 个文件与基线 blob hash 相同 |

Rust 验收显式将包含 `retainpdf-pipeline` 的环境加入 PATH；本地复用旧
`services/api/target` 编译缓存，未将旧缓存当成新源码位置。

## 离仓与启动证据

从 `0063bc31` 生成真实源码归档，解压后独立执行锁定 Python 安装、
AI/流水线导入及字体路径断言、流水线 CLI、Cargo metadata 和全 Rust 测试编译，
均通过。归档包含根工作区、后端、数据库、协议及所需字体和部署工具。

离仓源码与独立 Python 环境使用临时数据、随机端口启动：API `/ready` 与
AI `/readyz` 均返回 200，随后关闭整个进程组。未调用模型。
未运行远程 Windows、GUI 人工验收、Docker 镜像构建或发布。

## 保留的既有失败

- `job-status.v1.schema.json` 上游与后端镜像在基线已不一致：镜像含额外
  ModelConnection、execution_connection 与恢复状态。两份文件各自内容未变；
  parity 仍失败，因此完整 standalone 入口不能宣称全绿。
- Rust 架构检查仍报告基线已有 `routes/model_requests.rs` 对 model executor
  的越界依赖；未放宽规则或借迁移改业务。
- 同解释器、同顺序、各自空 OUTPUT_ROOT 的流水线 devtools 全集对照：
  基线 13 failed / 1734 passed / 1 skipped；迁移后 13 failed / 1736 passed /
  1 skipped。失败 ID 和排版断言数值相同，新增通过为两项路径回归。
  失败涉及 macOS 路径规范化、Linux 字体假设、排版断言及 hotfix 版本比较。

## 数据和回退边界

### 后续协议修复（2026-09-06）

`16f27449` 根据现有 Rust 输出补齐上游 ModelConnection、可选
execution_connection 和 blocked/running/paused 恢复状态，并重新生成 DTO。
后端运行行为与镜像内容未改。9 份镜像 parity 已通过，协议测试 11 项通过，
API/domain/Reader 类型检查通过。该提交的完整
`ops/release/check_standalone.py --compile-rust` 已退出 0：包含独立安装、入口
检查和 Rust 全工作区测试编译（不是执行全部 Rust 测试）。上文协议阻塞已解除；
Rust 架构违规和 13 项 devtools 基线失败不在本次修复范围。

没有搬迁现有 data、tmp、凭据或用户任务。旧 `services/` 可以继续包含本地
虚拟环境、缓存和凭据，但已无跟踪源码。旧本地授权文件有兼容读取路径。
桌面安装包内部布局和环境变量名称保持不变。

所有更改仅本地提交，未 push、dispatch CI 或调用付费模型。
回退应在干净工作区切换到基线，重新安装对应工作区依赖；不要回滚或删除
真实数据，也不要用强制重置覆盖后来产生的用户改动。
