# 仓库目录职责

仓库按职责分区，模块内部继续按功能组织。目录迁移不改变包名、公共 API、
任务协议、桌面安装包内部布局或用户数据位置。

| 目录 | 责任 |
| --- | --- |
| `frontend/web`、`frontend/desktop` | 网页与桌面入口 |
| `frontend/packages` | 前端共享 UI、Reader、客户端及展示模型 |
| `backend/api`、`backend/jobs` | HTTP 边界与任务进程调度 |
| `backend/ai`、`backend/pipeline` | AI 服务与独立可执行的文档流水线 |
| `backend/packages` | 后端内部共享 Rust 库 |
| `database/retain-db` | 数据访问实现、迁移及其测试，不包含真实数据库文件 |
| `contracts` | 跨端 JSON Schema 与生成 DTO 的唯一上游 |
| `backend/contracts` | 支持后端源码包的字节级协议镜像，不独立演化 |
| `tests` | 项目级集成、端到端、性能测试与固定样本 |
| `ops/development`、`ops/release`、`ops/deployment` | 本地环境、交付工具与部署配置 |
| `security` | 安全规范、检查与测试导航 |
| `resources` | 跨模块共享的字体等静态资源 |
| `docs` | 架构、开发、参考资料与运维记录 |
| `experiments` | 不被生产代码依赖的实验 |

## 依赖与归属规则

- 专用资源、单元测试、开发工具跟随模块；只把跨模块测试放在根 `tests`。
- 应用依赖自己的共享库，前端不引用后端实现，后端不引用前端实现。
- 跨端协议不能依赖业务实现；修改上游后同步镜像并运行 parity 检查。
- 流水线不依赖 HTTP 请求上下文或界面，必须可由离线命令独立调用。
- 数据层不依赖 API 路由、任务调度或模型调用。安全校验仍由业务入口执行。
- 工作区清单、锁文件和 `.github` 保留工具要求的位置；不使用永久旧目录
  副本或符号链接兼容源码路径。

## 数据与验证

本地 API 鉴权配置默认位于 `backend/api/auth.local.json`，不加入 Git，文件权限
应限制为仅当前用户可读写。显式 `RUST_API_ROOT` 仍决定自定义配置位置；桌面
使用其原有用户目录。默认新布局不再回退读取 `services/api/auth.local.json`。
配置文件中的有效密钥优先于 `RUST_API_KEYS`，无有效文件密钥时才使用环境变量；
文件损坏时明确报错，不静默绕过。迁移配置不要改变实际密钥、并发或端口值。

本轮只迁移源码：现有 `data/`、`tmp/`、凭据及任务产物路径保持原样。
`var/` 是未来运行产物归一化的候选，不是本轮的新运行根。测试 fixture 是
版本化输入，测试输出不能写回 fixture 或提交到仓库。

协议检查：`python3 backend/contracts/check_parity.py --require-upstream`。
前端、后端、翻译、源码归档和桌面验证应分别报告，静态路径检查不代表
真实发布、Windows 安装或付费模型调用已通过。
