# `composition/external` 解散映射表

批次 5B 的 B8 提交的执行依据。产出于 2026-09-08，基于当时的源码实测。

**前置条件**：本表的 `@/platform/*` 目标路径要求 5A 的 A1/A3/A4 已完成
（`js/{config,contracts,utils,runtime,generated}` → `platform/`、
`js/{mock,api}` → `platform/`、`js/app-framework` → `platform/store`）。
原因见下方「门禁反噬」——在搬迁完成前，5 个 `pages/` 下的文件无合法路径可走。

规模：features 侧 14 文件 / 16 条 import；pages 侧 17 文件 / 25 条 import。

## 必须人工盯的三条

### ① 隐式副作用：reader AI 适配器注册（typecheck 抓不到）

`src/features/reader/domain/host/ai.ts:18,25` 在**模块顶层**调用
`setReaderAiConfigAdapters(...)` 与 `setAnswerEnhanceAdapters(...)`。
`packages/reader/src/shared/ai/config.ts` 的默认实现全是空的：

    let _credentialsPort: CredentialsPort | null = null;
    let _loadBrowserStoredConfig = () => null;
    let _defaultModelBaseUrl = () => "";

⇒ `hasModelApiKey`、`resolveReaderAiConfig`、`readSettingsModelApiKey`，以及走
`setAnswerEnhanceAdapters` 的 `injectCitationMarkers` / `renderCitationFooter`
**必须**经 `@/features/reader/domain.js` 导入。直连 `@retainpdf/reader/runtime/ai`
会跳过注册 → AI 问答永远认为「没配 Key」，且 typecheck 全绿。

例外（纯常量 / 纯函数，直连包路径安全）：
`CREDENTIALS_CHANGED_EVENT`、`MISSING_MODEL_API_KEY_MESSAGE`、`sanitizeAssistantAnswer`。

### ② `as` 别名：`currentJobIdFor`

`external/features.ts:39` 写的是 `export { currentJobId as currentJobIdFor }`。
调用点 `composition/create-runtime-features.ts:33` 用的是 `currentJobIdFor`，
真名是 `currentJobId`。重写必须写成：

    import { currentJobId as currentJobIdFor } from "@/features/jobs/index.js";

脚本只替换路径会得到 `undefined`。这是全表唯一可能复现「批次 4 吞 as 别名」的点。

`fetchGlossariesApi` 等 8 个带 `Api` 后缀的名字，改名发生在
`platform/api/index.ts` **内部**，调用点名字不变，只换路径——安全。

### ③ 门禁反噬：决定了执行顺序

`tests/architecture/architecture-boundaries.test.mjs` 的
`FORBIDDEN_IMPORT_PATTERNS` 有一条禁止 `/js/app-framework/store`，作用域
`src/pages` + `src/shared` + `src/features`，豁免只有 `isExternalGate()`
（含 `/composition/external`、`external.ts` 结尾、`/src/features/*/domain/`）。

| 文件 | 改成 `@/js/app-framework/store.js` |
|---|---|
| `features/ingest/domain/{upload-store,workflow-view-store}.ts` | ✅ 合法（domain 豁免） |
| `pages/home/state/{dialog,text,artifact-download-busy}-store.ts` | ❌ 门禁 fail |
| `pages/home/composition/create-library-domain.ts` | ❌ 门禁 fail |
| `pages/home/composition/types-split/common.ts` | ❌ 门禁 fail |

同理 `:754` 的 home features 门禁：`MockModeBanner.tsx` 改成
`@/js/config/runtime.js` 会命中，改成 `@/platform/config/runtime.js` 才不会。

⇒ **A4（app-framework → platform/store）与 A1（config → platform/config）
必须先于 B8。**

### 已排除的一条

`isDesktopMode` 在 `js/state/desktop-state.ts:16`（有参 `(target)`）与
`js/config/desktop-persistence.ts:19`（无参）各有一个同名函数，external 转的是
前者。实测注入错误来源后 typecheck **报错**
（`TS2554: Expected 0 arguments, but got 1`），不是静默陷阱，无需额外人工盯。

## 汇总去向表

### `@/platform/config/api-constants.js`
`API_PREFIX` —— 10 处调用点

### `@/platform/config/runtime.js`
`apiBase`、`defaultModelApiKey`、`defaultModelBaseUrl`、`defaultModelName`、
`defaultOcrProvider`、`defaultPaddleApiUrl`、`defaultPaddleToken`、
`isMockMode`、`mockScenario`

### `@/platform/config/upload-constants.js`
`DEFAULT_FILE_LABEL`、`FRONT_MAX_BYTES`、`FRONT_MAX_PAGE_COUNT`

### `@/platform/config/persisted-config.js`
`loadBrowserStoredConfig`、`loadDeveloperStoredConfig`、`saveBrowserStoredConfig`、
`savePersistedBrowserStoredConfig`、`savePersistedDeveloperStoredConfig`

### `@/platform/config/desktop-persistence.js`
`openDesktopOutputDirectory`、`savePersistedDesktopConfig`

### `@/platform/config/model-constants.js`
`DEFAULT_MODEL_VERSION` —— ⚠️ 与 `workflow-config.ts` 里另外 18 个
`DEFAULT_*` **不同源**，它们来自 `workflow-defaults.js`。脚本一把梭会改错这一个。

### `@/platform/config/workflow-defaults.js`
`DEFAULT_BATCH_SIZE`、`DEFAULT_BODY_FONT_SIZE_FACTOR`、`DEFAULT_BODY_LEADING_FACTOR`、
`DEFAULT_CLASSIFY_BATCH_SIZE`、`DEFAULT_COMPILE_WORKERS`、
`DEFAULT_INNER_BBOX_DENSE_SHRINK_X`、`DEFAULT_INNER_BBOX_DENSE_SHRINK_Y`、
`DEFAULT_INNER_BBOX_SHRINK_X`、`DEFAULT_INNER_BBOX_SHRINK_Y`、`DEFAULT_LANGUAGE`、
`DEFAULT_MODE`、`DEFAULT_PDF_COMPRESS_DPI`、`DEFAULT_RENDER_MODE`、
`DEFAULT_RULE_PROFILE`、`DEFAULT_TIMEOUT_SECONDS`、`DEFAULT_TRANSLATED_PDF_NAME`、
`DEFAULT_TYPST_FONT_FAMILY`、`DEFAULT_WORKERS`

### `@/platform/contracts/app-contract.js`
`APP_EVENTS` —— 5 处

### `@/platform/contracts/download-action-contract.js`
`PROTECTED_ARTIFACT_SELECTOR`

### `@/platform/store/store.js`
`createStore`、`type Store` —— 7 处

### `@/platform/utils/{clipboard,error-diagnostics,downloads}.js`
`copyText`（2 处，且在 features.ts 与 shared.ts 各转出一次——同源 binding，
今天不炸，但两个消费方都要改到同一新路径）、`messageForErrorBox`、
`fileNameFromDisposition`、`prepareDownloadTarget`、`saveResponseDownload`

### `@/platform/api/index.js`（已存在）
`listCollections`、`fetchDocumentList`、`type DocumentRecord`、`fetchDocument`、
7 个 agent-operation 函数、`askLibraryAi`、`AiAskError`、6 个 conversation 函数、
`type ConversationRecord`、`validateDeepSeekToken`、`queryDeepSeekBalance`、
`listCredentials`、`createCredential`、`updateCredential`、7 个 `*GlossaryApi`、
`submitUploadRequestHttp`

⚠️ 这些**必须**走网关而非直连 `@retainpdf/api/*`，否则 mock 模式静默走真网络。

### `@retainpdf/domain/job`
`buildJobWarningViewModel`、`normalizeJobPayload`、`summarizeStatus`、
`isJobTerminal`、`isTerminalStatus`、`resolveSourcePdfDownloadName`、
`resolveTranslatedPdfDownloadName`

### `@retainpdf/domain/job-status`
`adaptJobStageSnapshot` —— ⚠️ 全表唯一来自 job-status 的，其余同批的都是 job

### `@retainpdf/reader/ai`
`AiMarkdownAnswer`、`type AiCitationLike`

### `@retainpdf/reader/runtime/ai`
`CREDENTIALS_CHANGED_EVENT`（纯常量，安全）

### `@/features/reader/domain.js` —— 见陷阱 ①
`hasModelApiKey`、`resolveReaderAiConfig`、`sanitizeAssistantAnswer`

### `@/features/jobs/index.js`
`syncCurrentJobSnapshot`、`currentJobStoreFor`、`secondaryResourceStoreFor`、
`mountJobRuntimeFeature`、`readActiveJobId`、`currentJobId as currentJobIdFor`

⚠️ `readActiveJobId` 是 **jobs** 不是 library，容易归错。

### `@/features/library/index.js`
`createRecentJobsStatePort`、`createRecentJobActions`、`createRecentJobsRuntimePort`、
`createRecentJobsReaderPort`、`createRecentJobsNavigationPort`、
`createRecentJobsLibraryRefreshPort`、`createDocumentLibraryResource`、
`mountRecentJobsFeature`、`createDocumentAutoNaming`

### `../../domain/dialog/failure-recovery.js`（同功能相对路径）
`queueFullTitle`、`retryCountdownSeconds` —— 仅
`features/job-detail/ui/panels/FailurePanel.tsx`。

这是全表唯一「功能内部绕主页网关一圈回来」的：
`job-detail/ui/panels/` → `pages/home/composition/external` →
`features/job-detail/index.ts` → `features/job-detail/domain/dialog/failure-recovery.ts`。
必须改成同功能相对路径，**不能**改成 `@/features/job-detail/index.js`——
那会让 ui 依赖自己功能的 barrel，造成循环。

### 副作用 import
`pages/home/HomeApp.tsx:64` 的 `import "./composition/external/islands.js"`
→ `import "@/features/library/ui/island/index.js";`

⚠️ 必须保留且保持在 HomeApp 顶部的相对顺序。删掉后 `<library-search-island>`
变成惰性空标签、搜索静默失效——jsdom 不报错，只有真实浏览器能看出来。

### 直接删除
- `composition/create-credentials.ts:23-24`、`create-workflow-upload.ts:31-32`：空 import
- `external/islands.ts:8` 的 `LIBRARY_SEARCH_ISLAND_TAG`：就地定义、零消费方
- 8 个 external 文件本身

## 待定：映射表未覆盖的两处

| 现目录 | 符号 | 说明 |
|---|---|---|
| `js/state/{developer,desktop}-state.ts` | 8 个 | 由 5B 的 B10 决定去向（`platform/desktop/state.ts`） |
| `js/features/{home/state,app-shell/*}.ts` | 4 个 | 由 5B 的 B6/B7 拆分决定 |

在 B6/B7/B10 落地前，这 12 个符号先直连 `@/js/...` 原路径
（`features/{ingest,library}` 已有 4 处同写法先例）。

## 附：会一并消失的死转出

80+ 个从 external 转出但全仓库零调用点的符号，删网关时自然消失，不用找新家。
按子桶分布：`external/job.ts` 25 个、`external/features.ts` 45 个、
`external/shared.ts` 8 个、`external/config.ts` 8 个、`external/state.ts` 2 个。
