# 两套 HTTP 客户端的差异比对

批次 5C 的 C2 提交（收口 5 处绕开 API 网关的直连）的执行依据。
产出于 2026-09-08，基于当时的源码实测 + 真实浏览器抓包。

## 结论：C2 的风险比原计划估计的低得多

5 个绕开网关的文件用到 **18 个网络函数**，在 `platform/api/index.ts` 里
**100% 已有 `mockable()` 条目，全新的 0 个**。

也就是说这些函数的 canonical 实现**早已在真实模式下被别的调用方跑着**。
C2 不引入任何新的 legacy→canonical 实现替换，只是把最后 5 个文件拉齐。

逐函数比对：`searchLibrary` 的 legacy 版本本就转调 canonical（字面同一份代码）；
`askLibraryAi`、`patchDocument`、`createFavorite`、conversations 全套 7 个、
`resumeJob`/`rerunJob` 的请求形状、错误文案、副作用**逐字一致**。

原计划把 C2 列为「整个批次 5 唯一的行为变更，需逐 endpoint 比对 + 连真实后端手测」。
应下调为「低风险对齐」，但前置条件见下。

## 但 canonical 层有三处系统性问题，现网就在漏

这三条对**所有已经走网关的调用方**同样生效，是既成事实，不是 C2 引入的。
但 C2 之前应当先修，否则那 5 个文件切过来会带上同样的毛病。

### S1. 所有 GET/DELETE 被硬塞 `Content-Type: application/json`

    // packages/api/src/internal/runtime.ts
    const out = { "Content-Type": "application/json", ...headers };   // 无条件

对照 legacy（`web/src/js/config/runtime.ts`）：`{ ...extraHeaders }`，不加。

**实测**：真实浏览器加载一次主页，**30 条 GET 全部带着这个头**，包括
`library/books/*/thumbnail` 这种拉二进制图片的请求。

后果：`Content-Type: application/json` 不在 CORS 安全列表里 → 每个 GET 从
simple request 降级为 preflighted request，多一轮 `OPTIONS`。当前后端是
`CorsLayer::permissive()` 所以不会挂，但阅读器开一本书要打 favorites +
documents + events + manifest 好几条，全都白多一次往返；将来前面加严格
反代/WAF（不允许 OPTIONS 或不 allow `content-type`）会全线失败。

**修法**：canonical 的 `buildApiHeaders` 改成只在 `headers` 显式带 CT 时才加。
各 POST/PATCH 本来就都显式传了。一处改动覆盖 13+ 个 GET/DELETE。

### S2. `unwrapEnvelope` 丢了 `code !== 0` 的防线

| | legacy（`packages/domain/src/job/core.ts`） | canonical（`packages/api/src/internal/runtime.ts`） |
|---|---|---|
| 解包条件 | `"data" in payload && "code" in payload` | 只看 `"data" in envelope` |
| `code !== 0` | **抛** `Error(envelope.message ?? ...)` | 不检查，静默返回 `data` |
| 返回 | `envelope.data ?? null` | `envelope.data` |

后端若返回 HTTP 200 + `{code: 40001, message: "...", data: null}`，legacy 把
后端原文弹给用户，canonical 静默返回 `null`，上层当「查到 0 条」渲染成空态。

今天 Rust 侧 `ApiResponse::ok` 恒 `code: 0`、错误一律走非 2xx，**不会触发**。
但这道防线已经没了，任何把业务错误降级成 200 的后端改动都会变成「静默空数据」。

另外 canonical 只判 `"data" in envelope`，对**未包 envelope 但含顶层 data 字段**
的 2xx JSON 会误解包一层。AI FastAPI `/v1/ask` 的非流式返回目前无 `data` 键，暂不触发。

### S3. canonical 不读环境变量

`RETAIN_PDF_FRONTEND_API_BASE` / `RETAIN_FRONTEND_API_BASE` /
`RETAIN_PDF_FRONTEND_X_API_KEY` / `RETAIN_FRONTEND_X_API_KEY` 在 canonical 的
`apiBase()` / `frontendApiKey()` 里完全不读，只有 live
`window.__FRONT_RUNTIME_CONFIG__` → 同 host 回退。

浏览器场景无影响（`scripts/serve_static.py` 已把 env 注入 window）。
差异只在 **Node 侧**：设了 env 而没设 window 的测试会 fallback 到
`http://127.0.0.1:41000`。需确认 `tests/shared/config-resolution.test.mjs`
覆盖的是哪一侧。

## 逐函数差异：C 类（有实质差异）

### C3/C4. `fetchJobEvents` 与 `fetchJobArtifactsManifest` 的 404 回退

canonical 在 404 时会**再发一次** `<prefix>/ocr/jobs/<id>/events`（或
`/artifacts-manifest`），ok 则返回其内容；legacy 直接返回空。

- 对 OCR-only job：从「事件流永远空」变成「能显示事件」——**是功能修复**
- 对真正不存在的 job：请求数翻倍
- `fetchJobArtifactsManifest` 这条**已在别处生效**（已有 4 个文件走网关），风险已被现网验证
- 需确认后端确有 `/ocr/jobs/<id>/events` 路由，否则只是白打一次 404

### C6. `fetchProtected` 用于二进制下载时也带 JSON Content-Type

`data-port.ts` 的 `fetchProtectedResource` 用于拉产物（PDF / 图片 / zip）。
S1 的一个具象化子项。

## B 类（有差异但不影响行为）

- `submitJson` 错误对象新增 `status` / `url`：纯增量字段，文案不变
- `AiAskError` class 身份变化：reader 侧无 `instanceof` 检查；且
  `platform/api` 导出的本就是 canonical 类，切换后 reader 与 home 页统一，
  属**修复**不一致
- `buildJobDetailEndpoint` 增加 `encodeURIComponent`：现有 job id 不含需转义字符
- 返回值 TS 类型名 `MockDocumentListResult` → `DocumentListView`：字段同形
- **mock 模式零变化**：网关 `mockable()` 在 mock 下回落到同一个 legacy 函数，
  `fetchProtected` 的 `mock://` 分流逻辑也逐字相同

## 附：`mock://` 封面 404 的完整链路（既有缺陷，与 C2 无关）

1. `js/mock/documents.ts:192` 定义 `MOCK_DOCUMENT_COVER_URL = "mock://document-cover.png"`
2. `js/mock/index.ts:48` 合进 `getMockJobList()` 返回的 job item
3. `recent-job-card-presenter.ts:127` 原样返回该 URL（`dedupe` 不判协议）
4. `packages/api/src/job-images.ts` 的 `normalizeJobImageUrl` 走**分支 3**
   （既非 http/https、也非 `/api/v1/` 开头）→ 拼成
   `http://127.0.0.1:41000/mock://document-cover.png`
5. `job-images.ts:64` 用的是**裸 `fetch`**，不是 mock-aware 的 `fetchProtected`，
   不会被 `fetchMockProtected` 截住 → 404 → 书架封面空白

**两处都要改**：`normalizeJobImageUrl` 在分支 1 之前加
`if (/^mock:\/\//i.test(raw)) return raw;`；且 `fetchJobImageBlob` 改用
mock-aware 的 fetch。只改前者不足以修复。

单独修，不要混进 C2。

## 建议的执行顺序

1. 修 canonical 的 `buildApiHeaders`（消除 S1/C6，一处改动覆盖 13+ 个 GET/DELETE）
2. 给 canonical `unwrapEnvelope` 补 `code` 校验（消除 S2）
3. 确认 `tests/shared/config-resolution.test.mjs` 覆盖哪一侧（S3）
4. 确认后端 `/ocr/jobs/<id>/{events,artifacts-manifest}` 路由存在（C3/C4）
5. 再做 C2 的 5 个文件切换
6. `job-images` 的 `mock://` 缺陷单独修
