# Phase 3 对话框群施工蓝图(StatusDetail / Credentials / Glossaries / ReaderDialog / AppUpdate / developer / artifact-downloads)

> 配合总计划 ~/.claude/plans/wondrous-baking-donut.md、docs/ops/planning/frontend-migration/recent-jobs-blueprint.md、
> docs/ops/planning/frontend-migration/legacy-audit.md 使用。不重复 recent-jobs 蓝图范围。

## 0. 全局发现(七域共享,施工前必读)

1. dom-contract 常量(STATUS_DETAIL_DIALOG/CREDENTIAL_DOM_IDS/GLOSSARY_DOM_IDS/READER_DIALOG_IDS/APP_UPDATE_IDS)原样保留,直接用作 JSX id——视觉基线按 id 精确点击,门禁按常量断言,**不得改名/不得改 CSS Modules**。
2. **原生 `<dialog>` 语义必须保留**(showModal()/close())。`app-shell/view.js:bindDialogBackdropClose` 对固定 id 做一次性 getElementById——若对话框"打开时才挂载"会永久失效。**对策:5 个对话框常驻挂载(entry 起就存在),useEffect 依 open 驱动 showModal/close,自带 backdrop-close onClick,不依赖旧 bindDialogBackdropClose。**
3. 开合状态跨子树:新增 `src/pages/home/state/dialog-store.js` 通用工厂 `createDialogStore()`(open(payload)/close()/subscribe/getState),每个对话框一个实例,参照 reader 的 drawer-store.js 模式。
4. **`AppSettingsDialog` 是三个 tab 的壳**(API 设置/词表/更新),内部按钮开启 Credentials/Glossaries/AppUpdate。归属建议:并入 CredentialsDialog 承建方,命名 `SettingsHubDialog.jsx`。
5. **artifact-downloads 风险**:document 级委托点击 + `setLinkBusy` 直改 DOM,按钮宿主分布在 recent-jobs 的 ResultActions.jsx 与本蓝图 StatusDetailDialog。若父组件因 store 变化重渲染会覆盖"下载中..."文案。**建议方案二**:新增 `artifact-download-busy-store.js`,按钮各自订阅自己 actionId 分片(见 §7.5)。
6. APP_EVENTS:openBrowserCredentials(Credentials)、refreshGlossaries(Glossaries)、openReaderRequested(ReaderDialog,由已有 library-search React 岛 dispatch)。全部经 useAppEvent(name, handler) 消费,事件名不改。

## 1. StatusDetailDialog(1,511 行/18 文件)

- **数据源独立**:与 recent-jobs 蓝图的 statusCardStore 并行、不合并——status-detail 自己 fetch(events/diagnostics/resumePlan),StatusCard 不需要这些字段。两者共享同一个 renderJob 回调注入点。
- 打开触发:ResultActions.jsx 的 `#status-detail-btn` onClick 直调 `openStatusDetailDialog("overview")`(非事件,直接函数调用)。
- **判决要点**:controller.js/overview-coordinator/translation-tab-coordinator/translation-data-port/resume-actions/formatters(纯格式化部分)/status-detail/{snapshot,utils,history,events}(纯函数部分)全部**保留**;translation-renderer.js/navigation-view-port.js/dialog-view-port.js/translation-view-port.js/resume-view-port.js/view.js **死**;components/dialogs/status-detail-dialog*.js 6 文件死(仅 STATUS_DETAIL_DIALOG 常量保留)。
- **markup→JSX 是本域最大改写量**(history.js/events.js/translation-renderer.js 三处 HTML 字符串拼接 → 结构化 JSX),逐段跑视觉基线,不能一把梭。
- 新 store:`status-detail-store.js`(overview 段 + translation 段)+ `status-detail-dialog-store.js`(open/activeTab)。
- 组件:StatusDetailDialog.jsx(4 tab 常驻渲染用 hidden 属性,不卸载)、StageHistoryList/EventsList(新写结构化 JSX)、TranslationDebugTab 家族、useRerunAction。
- 验收:status-dialog-failed / status-dialog-translation 两条视觉基线(cutover 门槛)。

## 2. CredentialsDialog(1,673 行/22 文件,全项目最大单特性)

- **`default-state-port.js` 的单例必须原样复用**(不重建)——它的 mirrorToDom 副作用同步 4 个隐藏 input(ocr_provider/mineru_token/paddle_token/api_key),这些 input 被 3a 的上传表单读取。**风险最高点:composition 若各域各建一份隐藏 input 会导致"设置里填了 token,上传时读不到"的静默失败。**
- 判决:state.js/default-state-port.js/hidden-input-dom-port.js/selectors-port.js/validation.js/deepseek-flow.js/ocr-readiness-flow.js/persistence.js/dialog-values.js **保留**;browser-view-port.js/deepseek-view-port.js/view.js/dialog-sync.js/dialog-elements-port.js/setup-mode-port.js **死**。
- `updateCredentialGate`(上传按钮锁定态)建议**整体移交 3a**,本域只 expose 只读订阅。
- `developer-auth-dialog.js` **判定为死代码(孤儿组件)**:除自身注册与 APP_DIALOG_BACKDROP_IDS 列表引用外,全码库无任何打开/校验逻辑接线。**建议 Phase 4 删除前找用户/产品确认一次**,不要悄悄丢弃(可能是预留需求)。
- 建议顺带实现 §0.4 的 SettingsHubDialog.jsx 与 §0.3 的 dialog-store 工厂(其他域复用)。

## 3. GlossariesDialog(533 行)

- controller.js 业务函数(reload/select/save/delete/export/applyImport)保留,state 从可变对象改走 glossaries-store.js。
- entries 表格从命令式 DOM 行操作改结构化数组 + map——**level==="preserve" 时 target 留空回填 source 的旧语义必须原样保留**。
- `refreshWorkflowGlossaries({force, selectedId})` 是对 3a workflow 域的回调依赖(反向调用),composition 组装需等 workflow 域就绪;默认参数保持可选调用(no-op 兜底)。

## 4. ReaderDialog iframe 宿主(919 行,风险等级高)

- **postMessage 契约必须逐字节核对**:type `"retainpdf-reader-progress"`,字段 `{type,percent,text,stage}`,`stage==="ready" && percent>=100` → 180ms 后隐藏;来源校验 `isTrustedWindowMessage(event, frameWindow)` 不改。已与 Phase2b 的 src/pages/reader/entry.jsx 发送端核对一致。
- `reader-embedded` body class 已由 Phase2b reader 侧自行处理,宿主侧无需动作,只需继续用真实 `<iframe>`。
- **下载按钮死代码判定需运行时复核**:READER_DIALOG_BUTTON_IDS 对应的宿主侧下载按钮在当前模板里不存在(已被 Phase2b 的 ReaderDownloadMenu.jsx 完全取代),controller.js 的 handleSourceDownload 等四函数疑似死代码——**建议实现 agent 先跑一次 mock 场景真实打开 reader-dialog 确认,再决定是否裁剪**。
- **iframe src 切换必须用 ref 命令式处理**(setAttribute/removeAttribute),不要走 JSX 声明式 src 属性(React diff 边界情况风险)。
- 建议单独一个 agent,紧跟 Credentials/StatusDetail 之后,不与其他域并行(联调窗口易冲突)。

## 5. AppUpdateBanner(491 行)

- 完全自包含,localStorage 24h TTL 缓存 + 后台自动检查。
- **两处 DOM 分属两个宿主**(按钮在 SettingsHubDialog"更新"tab,详情 dialog 现在 app-shell-header.js 里)——React 化建议合并到同一 AppUpdateBanner.jsx,放进 SettingsHubDialog"更新"tab 下,需与 3a 确认 AppShellHeader 不再残留 update-dialog 模板(否则重复 id 违反门禁)。

## 6. developer 面板(133 行,几乎不能独立施工)

- **强依赖 3a workflow 域**:表单字段(模型/工作流/并发参数)读写全部来自 workflowPorts,developer 域自身只有彩蛋触发(键盘序列"bbpp")+ tab 切换 + 打开对话框。
- 彩蛋逻辑(排除表单元素目标 + 4 字符滑动窗口匹配)需原样迁移为 useDeveloperEasterEgg() hook,注意 StrictMode 下 effect 幂等/cleanup(唯一全局 document keydown 监听)。
- **建议不单独立项,并入 workflow 承建方或作为 workflow 完成后的收尾小任务**。

## 7. artifact-downloads(264 行)

- 无独立可视组件,是挂载在 composition 根部的行为 hook:useArtifactDownloadsBinding()。
- 7 个固定 id(#download-btn/#markdown-bundle-btn/#status-markdown-bundle-btn/#source-pdf-btn/#pdf-btn/#markdown-btn/#markdown-raw-btn)分布在 recent-jobs 的 ResultActions.jsx 与 StatusDetailDialog。
- **方案二(推荐)**:setLinkBusy 改写 artifact-download-busy-store.js,按钮各自订阅自己 actionId 分片。需与 recent-jobs 蓝图承建方协商接口——若对方不愿改,退回方案一(ResultActions 按钮包 React.memo,props 只含 enabled/url,不含高频字段)。

## 8. 依赖矩阵与 agent 拆分建议

| 域 | 依赖(读) | 被依赖(写/耦合) |
|---|---|---|
| StatusDetailDialog | job-runtime 保留引擎 state(非 statusCardStore) | ResultActions 需调其 openStatusDetailDialog |
| CredentialsDialog | 无 | 3a HeroUpload 读隐藏 input + 去设置按钮需其 open() |
| GlossariesDialog | 无 | 3a workflow 的 refreshWorkflowGlossaries 回调(反向);developer 术语表下拉 |
| ReaderDialog | Phase2b postMessage 发送端(只读契约) | recent-jobs 卡片"对照阅读"按钮;library-search 岛事件 |
| AppUpdateBanner | 无 | 3a AppShellHeader 需移除旧模板片段 |
| developer | 强依赖 3a workflow | 无 |
| artifact-downloads | 无 | recent-jobs 与本蓝图下载按钮需挂正确 id(+方案二订阅) |

**建议 4 个实施 agent**:
1. CredentialsDialog(+SettingsHubDialog 壳 +dialog-store 基座)—— 最大最自洽,优先。
2. GlossariesDialog + AppUpdateBanner 合并(体量小,共享 SettingsHubDialog 宿主)。
3. StatusDetailDialog(+artifact-downloads 方案一兜底,视 recent-jobs 承建方是否接受方案二而定)。
4. ReaderDialog 单独(体量小但风险高,紧跟 1/3 之后,不与其他域并行)。
developer 面板归 workflow 收尾,不单独立项。

**关键前置条件:本蓝图 4 个域与 3a(app-shell/upload/workflow)强耦合**(隐藏 input 共享、去设置按钮触发点、AppShellHeader 模板位置、refreshWorkflowGlossaries 回调)——**必须等 3a 落地后再派工**,否则接口对不齐要返工。

## 关键文件
- src/js/components/dialogs/status-detail-dialog-dom-contract.js
- src/js/features/status-detail/controller.js
- src/js/features/credentials/default-state-port.js
- src/js/features/reader-dialog/controller.js
- src/pages/reader/entry.jsx(postMessage 发送端核对基准)
- src/pages/reader/state/drawer-store.js(dialog-store 模式参照)
- src/shared/react/use-store.js
