# 运维与交付

- `development/`：本地环境准备与进程启动。`python3 ops/development/dev_stack.py --help` 查看入口；运行数据路径和环境变量保持兼容。
  - `development/route_usage_report.py`：旧地址用量报表，删旧地址之前先量有没有人调；清零前要先停应用。用法见 [旧地址用量报表](../docs/ops/planning/api-reorg/20261017-旧地址用量报表.md)。

## 本地开发的两条命令

```
ops/development/dev.sh up --fast     起栈（约 2 秒；改过 Rust 就去掉 --fast）
npm run verify                       改完之后跑这个（约 75 秒）
```

### `dev.sh` —— 起停本地栈

`dev_stack.py` 只起后端，静态服务要另起一条，两边一共七个环境变量（API key 还要
从 `frontend/web/runtime-config.local.js` 里抠）。`dev.sh` 把这些收口，并且用
**nohup**：进程不跟终端会话走，不会关个窗口就全没了、再开要等一分钟 cargo。

`up` 会先 `down`：端口被占着起不来，而「起不来」的报错常常指向别处（有过一次
另一个 checkout 的 jobsd 残留在 41002，表现是 502/503 风暴）。

支持 `up` / `up --fast` / `up --same-origin` / `down` / `status` / `logs`。

后端默认绑 `0.0.0.0`。`runtime-config.local.js` 里的 key 还是默认的 `dev-local-key` 时，
`dev_stack.py` 不许在非本机地址上监听，`up` 就自动退回 `127.0.0.1` 并提示一句；
要指定地址用 `up --host <地址>`。静态服务照旧绑 `0.0.0.0`。

`up --same-origin` 把静态服务换成 `frontend/web/scripts/serve_same_origin.py`：
它照旧托管前端，但把 `/api` 也转发出去，于是浏览器只需要够得着 40001 一个端口。
WSL2 的 localhost 转发会按端口失效（40001 通、41000 不通），这种情况下用它；
平时不需要，多一跳代理。同源时 `apiBase` 被钉成当前 origin（配置文件里的值会被
覆盖），key 仍由 `dev.sh` 从 `runtime-config.local.js` 读、由代理转发时注入。

### `npm run verify` —— 改完跑这个

**没有任何单独的命令覆盖全部**，这是踩过的坑：

| 命令 | 包的 tsc | web 的 tsc | 单元测试 | 重建 bundle |
|---|---|---|---|---|
| `npm test`（在 frontend/web） | ✅ | ❌ | ✅ | ❌ |
| `npm run typecheck` | ✅ | ✅ | ❌ | ❌ |
| `npm run build` | ✅ | ❌ | ❌ | ✅ |
| **`npm run verify`** | ✅ | ✅ | ✅ | ✅ |

两次真实事故：

- 只跑 `npx tsc -p tsconfig.json`（只覆盖 `web/src`），包里两个 `as never` 造成的
  类型错就漏了过去，提交之后才发现。
- 只跑 `npm test`（不重建 bundle），改完在浏览器里验证，看到的还是旧产物，
  差点得出「已修复」的结论。

根目录的 `npm run verify` 还会带上 `cargo check --workspace`（以前还有 `backend/ai` 的
pytest，AI 服务 2026-11-03 删了）—— 一个功能平均要改 12 个文件、跨 2.6 种语言，分开跑必然漏。

**不含 `cargo test`**：本机有 5 条 PDF 相关的用例是红的（HEAD 上就红，缺外部工具
链），放进来会让这条命令永远失败，那还不如没有。要跑完整 Rust 测试用
`npm run test:api`。
- `release/`：源码归档与离仓验证。归档只包含提交的 HEAD，不包含凭据或本地运行数据。
- `deployment/`：Docker、Nginx 和 Typst 部署资产。本轮仅迁移路径，不改变镜像内安装布局。

在仓库根运行 `python3 ops/release/build_source_archive.py` 生成带校验和的源码包，默认输出在 `backend/dist/`。包内保留根 Cargo 工作区、`backend/`、`database/`、共享协议、字体、部署与发布工具及测试样本的相对路径。

`python3 ops/release/check_standalone.py --compile-rust` 从已提交源码构造临时工作区，验证布局、字体、协议、Python 安装及 Rust 编译。此命令需要可用的依赖源，但不会调用模型服务。

工具测试：`python3 -m pytest ops/development/tests ops/release/tests`。单个服务专用开发工具继续跟随所属服务。
