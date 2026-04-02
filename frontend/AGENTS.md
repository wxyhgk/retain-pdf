# Repository Guidelines

## 项目结构与模块组织
本仓库是一个可同时运行在浏览器静态页和 Tauri 桌面壳中的轻量前端。核心交互逻辑集中在 `app.js`，页面骨架位于 `index.html`。Tailwind 源样式放在 `src/input.css`，编译产物输出到 `styles.css`。运行时配置通过 `runtime-config.js` 注入。补充说明文档主要包括 `README.md`、`HowTo.md` 和 `FRONTEND_CHANGE_SUGGESTIONS.md`。

## 构建、测试与开发命令
- `npm install`：安装 Tailwind 构建依赖。
- `npm run build:css`：将 `src/input.css` 编译为 `styles.css`。
- `npm run watch:css`：开发样式时持续监听并重建 CSS。
- `python -m http.server 8080`：在当前目录启动本地静态服务。

浏览器模式调试时，还需单独启动 Rust API，然后访问 `http://127.0.0.1:8080`。

## 代码风格与命名约定
保持现有风格：ES Modules、分号、2 空格缩进。优先使用 `const`/`let`、小型辅助函数，以及通过本地 `$()` 方法按 DOM ID 取元素。DOM ID 使用小写下划线命名，例如 `mineru_token`；共享设计变量应优先维护在 `tailwind.config.js` 和 `src/input.css` 中。

## 测试指南
当前目录没有自动化测试。提交前至少执行 `npm run build:css`，并通过本地静态服务手动验证核心流程：健康检查、PDF 上传、任务轮询、历史查询和结果下载。如果后续新增测试，建议放入 `tests/` 目录，文件名按功能命名，例如 `upload-flow.test.js`。

## 提交与合并请求规范
最近提交同时存在发布式和 conventional 风格，例如 `v3.9.3: stabilize font fit...`、`Fix rendering formula wrappers...`、`chore: automate docker image release`。沿用这一模式即可：首词标明范围或类型，后半句简洁说明用户可见变更。PR 应包含变更摘要、关联任务或 Issue、手动验证说明，以及涉及界面调整时的截图。

## 安全与配置提示
不要提交真实 API Key、Token 或桌面端注入的敏感配置。`runtime-config.js` 应视为环境相关文件，提交前请用占位值替换敏感信息。
