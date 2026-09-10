# 内嵌后端 Package

RetainPDF 只维护一个正式产品仓库。Rust API、AI service、Python pipeline、契约、运行资源和 app Dockerfile 共同组成根目录 `services/` 下的自包含后端 package，不依赖另一个 GitHub 仓库、跨仓库 Token 或 MCP。

根目录的 `backend-package.json` 声明 package 位置：

```json
{
  "schema_version": 1,
  "source_path": "services"
}
```

Git commit 本身锁定前端、后端和契约的同一版本。后端不再维护第二套 repository/revision/source-tree 锁。

## 统一解析入口

本地脚本和 CI 应通过 `.github/scripts/resolve_backend_source.py` 获取后端路径，不要在执行命令里重复硬编码 `services/`。解析器会确认：

- package 位于当前产品 Git 仓库内部；
- 必需的 Rust、Python、配置和 Docker 文件完整；
- CI 或发布命令使用的 package 没有未提交改动；
- 输出当前产品 revision 和后端 subtree tree，供缓存与产物命名使用。

查看当前 package：

```bash
python3 .github/scripts/resolve_backend_source.py --json
```

本地开发需要测试尚未提交的后端修改时，使用无 shell 展开的包装器：

```bash
python3 .github/scripts/run_with_backend_source.py -- \
  cargo test --locked --workspace --manifest-path {backend}/api/Cargo.toml
```

包装器允许当前 `services/` 有开发中改动，但仍执行 package 路径和布局校验。CI 的 `.github/actions/prepare-backend-source` 不允许 dirty package。

## 代码与发布边界

- 后端组件的 Python packaging、Rust workspace、源码归档和 Docker 构建保持独立可验证。
- 产品与后端 contract schema 必须在同一个 PR 中通过 parity 检查。
- Docker、桌面端和本地运行都消费当前产品 commit 内的同一份 `services/`。
- CI 只 checkout 当前产品 commit，然后就地校验并消费 `services/`。
- 产品仓库之外的本地后端副本可以用于自包含验证，但不是产品构建输入或第二个发布源。

新增后端能力时，应直接修改 `services/`，同步更新测试、契约和文档。不要手工把本地验证副本中的改动复制到产品产物目录；需要保留的修改必须进入产品 Git 历史。
