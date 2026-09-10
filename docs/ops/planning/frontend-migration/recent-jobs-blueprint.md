# recent-jobs + job-runtime 子域 React 迁移施工蓝图(Phase 3 核心)

> Phase 3 实施 agent 的直接输入。源码级勘察产出,配合总计划
> ~/.claude/plans/wondrous-baking-donut.md 使用。

## 0. 现状数据流(施工前必读)

三条链路、两套定时器、三个 store:

- **链路 A(当前任务轮询 1s)**:jobRuntimeFeature.startPolling → setInterval 1000ms → fetchJob/fetchJobPayload → render-context 写 currentJobStore → ui/presentation.js renderJob → job-status-card.renderSnapshot;同时 notifyLibraryJobUpdated(document CustomEvent)+ requestLibraryRefresh(4s 节流)+ secondaryResourceScheduler(events/manifest/stageActions 三资源限频 → secondaryResourceStore → renderJobSecondaryPatch)。
- **链路 B(图书馆列表)**:refreshScheduler.initialize → loader.load → pagination 聚合 → commit → recentJobsStatePort.batch → store-renderer → viewPort.renderList → view.js → <recent-job-card> 网格。
- **链路 C(活跃卡补丁 2.5s)**:active-refresh 拉最多 6 个非当前活跃 job → runtimePatches.update → statePort.replaceItem(卡片级补丁)→ 随后全量静默重拉。
- **事件桥(bindings.js)**:library* 三个 document CustomEvent → 命令总线 → command-handlers(缓存失效 + 补丁 + 300/600/1200ms 分级刷新);openTranslationWorkflow 挂起刷新 / close 恢复。

**关键事实**:
- recentJobsStatePort / currentJobStore / secondaryResourceStore 已是唯一真值(storeDrivenRendering: true)——**轮询/补丁/节流引擎一行不动**,React 只换 viewPort 与自定义元素。
- 状态卡 VM 全在 src/js/job-status/(纯逻辑,门禁允许)。
- card-presenter.js / image-loader.js 是 features/recent-jobs/ 下的转口 facade(re-export 自 components/recent-jobs/),**从 facade import 合法**。
- store getSnapshot() 每次深冻结新克隆 → notify 后所有 item 引用全变,**卡片订阅不能靠引用相等**(见 §3)。
- smoke DOM 契约必须逐一镜像:.recent-job-item[data-job-id]、#job-status-card、#status-ring-label/-value、#status-progress-ring、#job-progress-text、.status-stage-step[data-stage-key][aria-selected]、#status-section.hidden、#recent-jobs-list、#recent-jobs-empty。
- recoverActiveJob(actions.js:84)无生产调用方,保持不接线。

## 1. 逐文件判决

### features/recent-jobs/(45 文件)
- **保留原样(引擎)**:state、pagination、runtime-item、runtime-patches、runtime-value-helpers、loader、commit、runtime、controller、actions、active-refresh、refresh-scheduler、refresh-environment、commands、command-handlers、bindings、library-books-resource、library-refresh-port、navigation-port、job-runtime-port、reader-port、active-job-recovery、created-job-hydration、summary-view-model、loading-state-contract、image-refresh、event-target——composition.js 直接 import 并 mount。
- **保留(facade)**:card-presenter.js、image-loader.js。
- **保留但停用**:store-renderer.js(React viewPort 下无害,Phase 4 删)。
- **保留**:workflow-open-port.js(composition 注入 isWorkflowOpen 读 workflow store)。
- **死(cutover 删)**:view.js、view-port.js、host.js、host-actions.js、render-target.js、view-state-target.js、view-state.js、list-rendering.js、list-events.js、image-hydration.js、card-markup.js、card-template.js、formatting.js、dom-contract.js。⚠️ controller/runtime/loader/commit/bindings 5 处默认参数 `viewPort = createRecentJobsViewPort()` 同 commit 改必传(测试均已注入,影响面零)。

### features/job-runtime/(17 文件)
**全部保留**。变的只是 mountJobRuntimeFeature payload 的回调实现(renderJob/renderJobSecondaryPatch/setText/setWorkflowSections… 由 composition 提供 React 实现)。runtime-reset 消费 app-shell 子域先行迁移的注入回调。

### components/status/(17 文件)+ job-status/(VM)
job-status/ 全目录纯 VM 保留,React 直接 import。components/status 判决:
- job-status-card.js / -template.js / connected-.js / -rendering.js / -progress-renderer.js / -selection.js / -stage-flow.js / -substages.js / -retry.js / -snapshot.js / -presets.js / -visuals.js / -dom-contract.js / task-toolbar.js → **死**,由 StatusCard.jsx 家族替代;其中:
  - rendering.js 的 buildProgressRenderModel(45-164 纯函数)**拷贝**至 src/pages/home/features/status/progress-model.js(禁区无法 import)。
  - -progress-animation.js → hook useStagedProgressAnimation(内核从 job-status/status-card-progress-view-model.js import;timers/displayedProgressByStage 用 useRef)。
  - -animation.js(lottie 194 行)→ 命令式孤岛 hook useLottieStageAnimation(desiredKey 竞态防护 + speedForProgressDelta 曲线整体拷贝;resolveLottieVendorUrl 合法 import)。
  - -presets.js 的 STAGE_ANIMATIONS 表拷贝进 hook;-visuals.js 的 resolveVisualStageKeyForSnapshot(8 行)拷贝。
  - 隐藏区 #job-id/#job-status/#job-stage-detail/#query-job-duration/#job-finished-at 及 legacy 链接**照样渲染**(job-summary 文本与 parallel smoke 依赖)。

### components/recent-jobs/(3 文件)
recent-job-card.js 死 → RecentJobCard.jsx;presenter 与 image-loader **保留**(经 facade;模块级 objectURL 缓存必须共享,React 内不得另建)。

### ui/ 状态呈现链
presentation.js、status-surfaces-presenter.js、job-status-card-renderer.js、status-card-view-port.js、job-status-summary-presenter.js、elapsed-presenter.js、presentation-view.js、status-ring-fallback-presenter.js → 死于 cutover。纯逻辑本就在 job-status/ 与 job/。⚠️ 不要从 pages import ui/status-surfaces-presenter.js(拖进旧 DOM 写入链)。

## 2. React 组件表(src/pages/home/)

### features/library/
- **RecentJobsLibrary.jsx**:useStoreSnapshot(recentJobsStore) 全快照 + useStoreSnapshot(libraryViewStore);loadMore → runtime.loadRecentJobs({reset:false});summary 用 buildRecentJobsSummaryViewModel。
- **RecentJobCard.jsx**:memo(Card, areCardPropsEqual),props = item + onSelect/onDelete/onReader(稳定引用);删除确认 popover 提升为 Library 级 confirmingDeleteJobId useState。
- **useRecentJobCover.js**:loadFirstRecentJobImage + recentJobRawImageUrls(facade);imageCacheVersionOf 拷贝(recent-job-card.js:12-29);token 防竞态;**卸载不 revoke**。
- **useLibraryAutoLoad.js**:滚动 passive listener + rAF,260px/0.35 阈值几何重写(~10 行)。
- **library-view-store.js**(新):{mode: loading|list|empty|error, message, hasMore, loadMoreLoading};文案拷贝 RECENT_JOBS_VIEW_TEXT 主视图变体。
- **react-view-port.js**(新):实现旧 viewPort 10 方法 → 写 libraryViewStore;renderList 忽略 items(React 直读 recentJobsStore);replaceCard 恒 true;bindEvents 捕获 handlers 到 handlersRef;hasView 恒 true。
- recent-jobs-dialog 元素形态在主视图不启用,死。

### features/status/
- **StatusCard.jsx**(id="job-status-card",渲进 #status-section):useStoreSnapshot(statusCardStore) 整快照;取消 → services.jobRuntime.cancelCurrentJob()。
- **StageFlow.jsx / SubstageFlow.jsx / ProgressBlock.jsx / ResultActions.jsx / StageRetry.jsx**:全部由 job-status/ 纯 VM 驱动;StageRetry dispatch APP_EVENTS.retryStage。
- **useElapsedTicker.js**:1s tick + buildElapsedViewModel(job/elapsed-view-model.js),终态即停;elapsed 不进 store(避免快照恒变)。
- **useStageSelection.js**:selectedStageKey/manual useState;换 job 复位、阶段推进清 manual(selection.js:45-64 语义)。
- **status-card-store.js**(新)+ statusCardPresenter(~80 行):renderMain = buildRuntimeStatusCardViewModel + buildJobStatusSummaryViewModel → setSnapshot;renderPatch 三 source 统一"重算 VM 写 store"(语义收敛点,S9 对照验证);finishedAtFallback 用 currentJobStore。

## 3. 订阅设计(1s 轮询不重渲整格)

1. 网格单点订阅:Library 组件无 selector 全快照(重渲 grid 函数本体便宜)。
2. **卡片 memo + 签名比较**:cardSignatureOf(item) 生成 primitive 串(imageCacheVersionOf 字段集 ∪ title/display_name/page_count/cover_url/thumbnail_url/stage_detail/runtime_status.detail);只有活跃卡签名变才重渲。**不做 per-card store 订阅**(收益零)。
3. 回调稳定:onSelect 等直接引用 composition 单例 actions,不包内联箭头。
4. selector 必须模块顶层定义(use-store 的 getSnapshot useCallback 依赖它)。
5. StatusCard 整快照;elapsed 由 ticker 局部驱动。

store 频率:recentJobsStore ~1-3 次/s、currentJobStore 1 次/s、secondaryResourceStore 3-5s 级、statusCardStore 1 次/s、libraryViewStore 稀疏。

## 4. 生命周期(bootstrap → composition)

**所有定时器留在 React 之外**(已活在保留引擎里);composition 模块级单例,entry.jsx 先建后 render,与 StrictMode 解耦。

createHomeComposition() 要点:
- statusCardStore + statusCardPresenter;
- mountJobRuntimeFeature({state, api 端口原样, renderJob→presenter.renderMain, renderJobSecondaryPatch→presenter.renderPatch, setText/setWorkflowSections/…由先行迁移的 app-shell/upload/workflow/status-detail React 特性提供, shellViewPort, libraryEventPort, resetStatePort});
- createRecentJobsReactViewPort + mountRecentJobsFeature(fetch* 原样, startPolling/currentJobId 接 jobRuntimeFeature, readerPort/stageAdapterPort 平移 bootstrap 对应文件实现, statePort);
- document 监听:openReaderRequested(平移 payloads.js:55-68)、retryStage → jobRuntimeFeature.retryStage;
- startup 路由:URL ?job_id= 启动轮询(平移 startup-route.js:49-59)。

溶解的 bootstrap 文件 ~20 个(startup-route*、job-*-port、mount-job-features 半边、main-shell-event-bindings 两行等),cutover 删。

顺序保证:composition 先 mount(首次 load 同步发)→ React render;useSyncExternalStore 首读拿现值。

## 5. 事件契约

- library* 三个 document CustomEvent、命令总线、open/close-translation-workflow、status-area-visibility-changed:**全部原样保留**,React 组件不直接消费(全走 store),composition 里的 bindings.js 继续跑。
- **前置契约**:workflow React 特性必须继续 dispatch open/close 事件,否则库刷新永久挂起(风险 5)。
- StageRetry 继续 dispatch retryStage;event-name-contracts 已扫 .jsx。
- 本步落地 src/shared/react/use-app-event.js(供 status-detail/workflow 消费)+ 单测。

## 6. 测试映射

- **零改动保活**:recent-jobs.test.mjs 的 state/pagination/commit/loader/refresh-scheduler/active-refresh/actions/runtime-patches/commands/command-handlers 段;job-runtime.test.mjs 的 controller/polling/secondary/render-context 段;status-card.test.mjs 中 import 自 job-status/ 的 VM 段(约七成);library-* 与 use-store-hook。
- **随视图死**:recent-jobs.test.mjs 的 view/list-rendering/list-events/host/render-target/view-state/store-renderer 段;status-card.test.mjs 的 components/status 壳段(buildProgressRenderModel、progress-animation 用例**迁移**指向新 pages 文件,断言不变);job-runtime.test.mjs 依赖 ui/ 的段。
- **新增 Top10**:①库网格渲染+smoke 契约;②卡片交互(select/delete popover/reader/键盘);③**卡片渲染隔离**(replaceItem 单卡,其余 23 卡渲染计数不变——memo 回归锚);④viewPort×store 状态机;⑤StatusCard 契约(stage flow/substage/retry/result actions/data-status/ring ids);⑥阶段选择语义;⑦staged 动画(fake timer 120ms);⑧statusCardPresenter 三 source;⑨composition 集成(首屏 load、job-updated 补丁、workflow 挂起);⑩useRecentJobCover(缓存/竞态/不 revoke)。

## 7. 施工顺序(每步 npm test 全绿;cutover 前 12 基线天然不动)

S1 store+viewPort+composition 雏形 → S2 RecentJobCard+cover hook → S3 Library+autoload+搜索 → S4 statusCardStore+presenter+接 jobRuntime → S5 StatusCard 静态结构 → S6 动画孤岛(lottie+staged) → S7 交互闭环(选择/elapsed/cancel/retry) → S8 事件桥全量 → S9 双轨手验(watch:js + 真实后端 + mock=parallel)→ cutover(换入口、删死文件+5 处默认参数、删测试段、4 基线+全套 smoke)。

## 8. 风险与缓解

1. **staged 动画时序(最高)**:displayedProgressByStage 必须 useRef;新快照按 shouldAnimateRenderPageProgress 决定续跑/跳变;换 job reset。误用 useState 会每 tick 重渲+闭包旧值。
2. **lottie 竞态**:desiredKey 三重检查原样保留;status-section 用 CSS hidden 而非卸载(动画实例存活语义)。
3. **objectURL**:模块级缓存从不 revoke,React 卸载**不得** revoke;invalidate 只走 invalidateRecentJobImages。
4. **刷新节流语义**:lastRefreshAt 写入时机是故意行为,禁止重排;测试段保活即锚。
5. **workflow 挂起死锁**:isWorkflowOpen 由 composition 注入读 workflow store;集成测覆盖 开→关→300ms 刷新。
6. **首帧 placeholder**:presenter 必须在 startPolling 同步链内写 store(否则闪空卡,status-dialog 基线抓)。
7. **DOM 契约**:含 --status-ring-percent、--status-substage-count CSS 变量、aria-selected、data-stage-key;dom-ids 常量 + 契约测试逐 id 断言。
8. **深克隆地板**:现状已担同等成本;不得 per-card selector 里 items.find。
9. **默认参数断链**:cutover 同 commit 改 5 处必传。
10. **renderPatch 收敛**:React 整卡 diff 理论等价;S9 以 mock=parallel + 失败任务双路径对照。

## 关键文件
- features/recent-jobs/controller.js(viewPort 注入点)
- features/job-runtime/controller.js(轮询引擎 payload 契约)
- job-status/status-card-runtime-source.js(状态卡唯一 VM 源)
- components/status/job-status-card.js(StatusCard.jsx 行为镜像基准)
- src/shared/react/use-store.js(订阅基座)
