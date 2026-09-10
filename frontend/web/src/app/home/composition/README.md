# home/composition

主页装配层。**只接线，不写业务。**

双 features 对照（`js/features` vs `pages/home/features`）见 **`src/FEATURES.md`**。

## 规则（后期维护必读）

1. **不再有集中网关**  
   - `composition/external.ts` 与 `external/` 子桶已在批次 5B 的 B8 解散
     （蓝图 §5.2：不允许用一个新的全局 barrel 取代它，那只是把同一个问题换个位置）。  
   - 9 个 `create-*.ts` 工厂各自直连真正的来源：`@/platform/{config,contracts,store,utils,api}`、
     `@retainpdf/domain/{job,job-status}`、以及各功能的 `index.js`。  
   - `architecture-boundaries.test.mjs` 有一条断言该网关不得复活。  

2. **工厂返回 bag，不写可变 `ctx`**  
   `createXxx(...)` 返回自己的产物；`create-home-composition.ts` 显式赋值到 `features` / `domains`。

3. **`features` 是唯一可变注册表**  
   晚绑定（A 装配时 B 尚未创建）通过 `features.xxx` 读，装配完成后再调用。

4. **runtime 一次挂齐**  
   `job-runtime` / `recent-jobs` / `artifact-downloads` 在 composition 阶段创建，不放进 `initialize` 的 `if (!feature)` 懒挂载。

5. **事件注册顺序有契约**  
   `workflowDialog.bindEvents()` 必须先于 `mountRecentJobsFeature`  
  （`closeTranslationWorkflow` 时要先写 DOM `data-open`，recent-jobs 才能 `scheduleRefresh`）。

## 文件

| 文件 | 职责 |
|------|------|
| `../create-home-composition.ts` | 顺序接线入口（原 `composition.ts`，避免与 `composition/` 目录同名） |
| `external.js` | 外部依赖 barrel |
| `create-bridge.js` | 3b 回调桥 |
| `create-workflow-upload.js` | workflow + upload |
| `create-credentials.js` | 凭据 |
| `create-glossaries-app-update.js` | 术语表 + 更新 |
| `create-status-domain.js` | statusCard / detail / reader |
| `create-library-domain.js` | library / recent-jobs ports / collections |
| `create-app-actions.js` | 提交任务 |
| `create-runtime-features.js` | job-runtime / recent-jobs / artifacts |
| `create-lifecycle.js` | initialize / dispose |
| `build-home-services.js` | 对外 HomeServices bag |
