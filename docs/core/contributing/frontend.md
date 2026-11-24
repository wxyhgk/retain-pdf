# 前端与桌面端贡献指南

## 目录边界

- `frontend/web/`：当前生产使用的静态前端源码，也是桌面端 bundle 的输入。
- `frontend/web-react/`：新 React 前端迁移区，当前不直接替代 `frontend/web/`。
- `frontend/desktop/`：Electron 桌面端打包。
- `frontend/desktop/app/frontend/**`：桌面端实际读取的前端 bundle，不应该作为主要编辑入口。

## 本地启动

先在仓库根目录安装统一锁定的 workspace 依赖：

```bash
npm ci
```

根目录的 `package-lock.json` 是 `frontend/*` 与 `packages/*` 的唯一正式 npm
锁文件。不要在 workspace 内提交独立的 `package-lock.json`。

```bash
cd frontend/web
python3 -m http.server 40001 --bind 0.0.0.0
```

React 迁移区如需单独启动：

```bash
npm run dev --workspace=frontend-react
```

默认端口：`40002`。该入口仍是迁移区，不直接替代生产 `frontend/web/`。

默认端口：

- Web 前端：`40001`
- Rust API：`41000`
- 第二个端口（只有 `/health`、`/ready`）：`42000`

前端 API base 规则见 [本地启动与配置](../api/local-dev.md)。

## 桌面端同步

修改 `frontend/web/src/**`、`frontend/web/*.html`、`frontend/web/src/styles/**` 或其他会进入桌面端 bundle 的前端资源后，必须同步桌面端：

```bash
npm run verify-frontend-sync --workspace=retain-pdf-desktop
```

这个命令会重新构建静态前端、同步到桌面端 bundle，并跑桌面端前端 smoke。

### 桌面端出错排查

桌面端主进程日志是 Electron 用户数据目录下的 `logs/desktop-main.log`（`frontend/desktop/src/main/desktop-logging.js`）。
目录名跟着应用名走，Windows 在 `%APPDATA%\` 下、Mac 在 `~/Library/Application Support/` 下找 `RetainPDF` 或
`retain-pdf-desktop`；启动时那行 `[desktop] app ready … userData=` 写着确切路径。页面里的错误都记成 `[desktop][renderer-issue]` 开头的行：

- `type=error` / `unhandledrejection`：window 上没被接住的错误（`frontend/desktop/preload.js`）。
- `type=react-caught` / `react-uncaught`：React 组件出错（被出错兜底接住、或整棵树卸掉），后面跟 `component-stack:` 和 `stack:` 两段。
  页面的 React 根都带 `web/src/platform/desktop/renderer-issue.ts` 的 `reactRootErrorOptions()`（首页、详情页走
  `app/shell-boot.ts`，阅读页走 `bootReader({ rootOptions })`），经桌面桥 `reportRendererIssue` 报给主进程。
- 生产包压缩过，但打包时保留了函数和类名（`web/scripts/build-js-bundle.mjs` 的 `keepNames`），组件栈里看得到组件名；
  只给一个数字的 React 报错（例如 #185「更新深度超限」）看组件栈就知道是哪个组件。

## 改动规则

- 不要只改 `frontend/desktop/app/frontend/**`，应改 `frontend/web/**` 源文件后同步。
- UI 逻辑优先放到现有 feature/controller/view 模块，不要把新流程塞回一个大入口文件。
- 新增下载、reader、状态卡、术语表能力时，确认桌面端 bundle 也能通过 `npm run verify-frontend-sync --workspace=retain-pdf-desktop`。
- 前端需要新增 API 字段时，先确认后端是否有稳定 view/projection，不要让前端从内部 payload、raw artifact 或数据库字段里猜。
- `frontend/web-react/` 的改动应明确是迁移区能力，除非 PR 目标就是切换生产入口。

## 常用检查

```bash
npm run build:web
npm run verify-frontend-sync --workspace=retain-pdf-desktop
```

改了样式、皮肤、页面结构（CSS、主题变量、组件的 DOM）时，再跑视觉回归：每个皮肤 × 8 个页面状态和 main 的构建产物
逐像素比，只有打算改的地方允许不一样（用法见 [frontend/web/tests/README.md](../../../frontend/web/tests/README.md)）：

```bash
npm --prefix frontend/web run build
npm --prefix frontend/web run visual:check -- --base main
```

前端端到端状态 smoke 会真实提交任务，通常需要本地 Rust API、OCR token、模型 key 和样本 PDF；具备这些条件时再跑：

```bash
cd frontend/web
npm run smoke:status -- --file ../../data/temPDF/test1.pdf
```
