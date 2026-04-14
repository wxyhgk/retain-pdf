# 前端优化说明

这份说明只聚焦当前 `frontend/` 的真实技术债，目的是让前端同学快速判断：

- 哪些问题是必须先修的
- 哪些问题会直接拖慢后续开发
- 哪些问题只是体验层优化

## 当前结构概览

前端现在是一个非常轻量的原生 JS + Tailwind 页面，没有框架，也没有 bundler/runtime state 管理层。

量化情况：

- 核心交互入口：[main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js) 约 `1291` 行
- UI 渲染层：[ui.js](/home/wxyhgk/tmp/Code/frontend/src/js/ui.js) 约 `624` 行
- 任务数据整形层：[job.js](/home/wxyhgk/tmp/Code/frontend/src/js/job.js) 约 `424` 行
- 样式主文件：[components.css](/home/wxyhgk/tmp/Code/frontend/src/styles/components.css) 约 `1747` 行
- 前端源码总量约 `224K`
- `frontend/node_modules` 已落仓，约 `16M`

结论：这不是“功能太多”，而是“没有形成稳定分层”，所以复杂度集中在少数大文件里。

## P0：应该先处理的问题

### 1. 主入口过大，业务、事件绑定、轮询、表单组装全耦合在一起

文件：

- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)

问题：

- `main.js` 同时负责：
  - token 校验
  - 表单收集
  - 提交任务
  - 轮询任务
  - 最近任务列表
  - 开发者设置
  - 浏览器凭证弹窗
  - 页面事件总绑定
- 这会导致任何一个小改动都容易碰到别的流程。

建议：

- 至少拆成 4 个模块：
  - `job-submit.js`
  - `job-polling.js`
  - `recent-jobs.js`
  - `settings-dialog.js`
- `main.js` 只保留：
  - 页面初始化
  - 模块装配
  - 顶层错误兜底

### 2. 全局可变状态过于原始，没有更新边界

文件：

- [state.js](/home/wxyhgk/tmp/Code/frontend/src/js/state.js)
- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)
- [ui.js](/home/wxyhgk/tmp/Code/frontend/src/js/ui.js)

问题：

- `state` 是一个裸对象，多个文件直接写：
  - `state.currentJobId = ...`
  - `state.recentJobsItems = ...`
  - `state.timer = ...`
- 没有 mutation 边界，也没有订阅机制。
- 现在还能撑住，是因为页面单一；一旦前端继续加功能，会越来越难查状态来源。

建议：

- 不一定非要上 React/Vue。
- 先做一个轻量 store：
  - `getState()`
  - `patchState(partial)`
  - `subscribe(key, fn)` 或简单 `subscribe(fn)`
- 至少把这几块独立出来：
  - `jobState`
  - `uploadState`
  - `recentJobsState`
  - `developerState`

### 3. 大量 `innerHTML` 拼接，渲染和事件绑定都比较脆

文件：

- [ui.js](/home/wxyhgk/tmp/Code/frontend/src/js/ui.js)
- [templates.js](/home/wxyhgk/tmp/Code/frontend/src/js/templates.js)
- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)

问题：

- 多处直接整段重写：
  - `document.body.innerHTML = ...`
  - `list.innerHTML = ...`
- 最近任务列表还会用：
  - `list.innerHTML = reset ? markup : \`\${list.innerHTML}\${markup}\``
- 这类写法的问题：
  - 事件绑定容易丢
  - 局部刷新不可控
  - 性能和状态一致性都一般

建议：

- 不必重构成组件框架。
- 先把高频列表改成 DOM 节点渲染：
  - `document.createElement`
  - `replaceChildren`
  - `append`
- 优先处理：
  - 事件流列表
  - stage history
  - 最近任务列表

### 4. 前端里有硬编码开发者密码，属于明显安全问题

文件：

- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)

问题：

- 存在：
  - `const DEVELOPER_PASSWORD = "Gk265157!";`
- 这相当于前端公开密码，没有真正安全性。

建议：

- 如果只是“隐藏高级配置”，直接改成：
  - 本地开关
  - `runtime-config`
  - 桌面端设置页入口
- 如果真的需要鉴权，必须移到后端或桌面宿主层。

## P1：会明显影响维护效率的问题

### 5. Job 数据整形层太厚，前端承担了过多后端兼容逻辑

文件：

- [job.js](/home/wxyhgk/tmp/Code/frontend/src/js/job.js)

问题：

- `normalizeJobPayload()` 在做大量“兜底式兼容”：
  - 多字段 fallback
  - 绝对 URL 补全
  - actions / artifacts 双来源兼容
  - runtime / failure / legacy 风格字段融合
- 这说明后端响应契约虽然稳定了，但前端还在按“宽松兼容”写。

建议：

- 前端同学可以要求后端给一个更稳定的 view contract。
- `normalizeJobPayload()` 目标应收敛成两类工作：
  - envelope unwrap
  - 轻量格式化
- 不要继续让它承担“接口兼容层”。

### 6. 轮询逻辑和详情请求耦合过深

文件：

- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)

问题：

- `fetchJob(jobId)` 一次请求串行拉：
  - job detail
  - job events
  - artifacts manifest
- 轮询频率固定 `3000ms`
- 没有根据状态做自适应。

建议：

- 拆成：
  - `pollJobSnapshot`
  - `refreshEvents`
  - `refreshArtifactsManifest`
- 策略：
  - `queued/running` 时高频轮询 detail
  - events / manifest 低频刷新
  - `succeeded/failed/canceled` 立即停表

### 7. 配置来源分散，浏览器版和桌面版逻辑掺在一起

文件：

- [config.js](/home/wxyhgk/tmp/Code/frontend/src/js/config.js)
- [desktop.js](/home/wxyhgk/tmp/Code/frontend/src/js/desktop.js)
- [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js)

问题：

- 当前有三套来源混在一起：
  - runtime config
  - localStorage browser config
  - desktop bridge config
- 页面逻辑里到处判断 `desktopMode`

建议：

- 前端同学可以抽一层 `appEnv`：
  - `mode: browser | desktop`
  - `capabilities`
  - `credentialSource`
- UI 层只读能力，不直接读宿主差异。

### 8. 样式量集中在单文件，组件边界不清楚

文件：

- [components.css](/home/wxyhgk/tmp/Code/frontend/src/styles/components.css)

问题：

- 单文件约 `1747` 行
- dialog、topbar、hero、developer 面板、状态区、事件列表都混在一起

建议：

- 至少按区域拆：
  - `layout.css`
  - `dialogs.css`
  - `job-status.css`
  - `developer-panel.css`
  - `recent-jobs.css`

## P2：体验和工程规范层建议

### 9. `node_modules` 不应进入仓库

文件：

- `frontend/node_modules`

问题：

- 当前仓里有整份依赖目录，约 `16M`

建议：

- 前端同学清掉并确认 `.gitignore` 生效。
- 只保留：
  - `package.json`
  - `package-lock.json`

### 10. 当前没有前端测试和基本 lint

文件：

- [package.json](/home/wxyhgk/tmp/Code/frontend/package.json)

问题：

- 只有：
  - `build:css`
  - `watch:css`
- 没有：
  - `lint`
  - `test`
  - `format`

建议：

- 最小补齐：
  - ESLint
  - Prettier
  - 1~2 个最基本的纯函数测试，先覆盖 [job.js](/home/wxyhgk/tmp/Code/frontend/src/js/job.js) 的 normalize/summarize 系列

## 建议的优化顺序

### 第一阶段：低风险收口

- 删除前端硬编码开发者密码
- 清掉 `node_modules`
- 把最近任务列表 / 事件流 / stage history 从 `innerHTML` 拼接改成 DOM 渲染
- 拆 `main.js`，至少拆出提交、轮询、最近任务三个模块

### 第二阶段：结构治理

- 增加轻量 store，收口 `state`
- 拆配置来源，隔离 browser/desktop 宿主差异
- 缩小 [job.js](/home/wxyhgk/tmp/Code/frontend/src/js/job.js) 的“兼容层”职责

### 第三阶段：工程化补齐

- 拆样式文件
- 增加 lint / format / 最小测试
- 再决定要不要上框架

## 给前端同学的结论

当前前端不是“性能差”，而是“结构松散”。

最该先做的不是换框架，而是：

1. 把 [main.js](/home/wxyhgk/tmp/Code/frontend/src/js/main.js) 拆掉
2. 把裸 `state` 收口
3. 把高频区域从 `innerHTML` 改成稳定 DOM 渲染
4. 把前端里的伪鉴权和宿主差异清掉

做到这一步，后面不管继续写原生 JS，还是迁 React/Vue，成本都会低很多。
