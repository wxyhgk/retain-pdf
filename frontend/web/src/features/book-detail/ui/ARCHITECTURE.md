# 书籍详情组件边界

本目录负责一个 `document_id` 对应的文档详情。它不是单个翻译任务的详情页；
OCR、翻译、Agent 操作和文件产物都应挂在文档下面，并保持各自独立的运行状态。

## 当前结构

```text
BookDetailDialog                  数据与动作组合层
├─ BookDetailShell               Dialog、关闭行为、左右槽位
├─ CoverActionsPanel             封面、文档身份、阅读状态与当前可用阅读动作
└─ BookDetailRightTabs           三个主 Tab；导航固定、面板独立滚动
   ├─ BookDetailOverviewTab      标题、元数据、阅读状态、合集和文档管理
   ├─ BookDetailProcessingTab    OCR 与翻译两个独立处理能力
   ├─ BookDetailArtifactsTab     源 PDF 与任务产物
```

`BookDetailDialog` 可以组合 hook 和把回调交给子组件，但不应直接发送 OCR、翻译、
产物下载或 Agent 操作请求。请求编排应放在独立 hook 或 library domain controller。

## 状态不变量

1. `document_id` 是详情页身份；`job_id` 只是某次处理任务身份。
2. OCR 与翻译不能共用一个 `pending/error/status`。
3. `active_job_id` 不能被解释为文档唯一任务；`useDocumentJobs` 分别选择最新 OCR 和翻译任务。
4. 切换 Tab 不得取消共享 runtime 订阅，也不得丢失处理表单状态。
5. 任务成功后只更新当前文档对应的书架卡，禁止插入重复文档。
6. 文件产物统一进入 `BookDetailArtifactsTab`，不散落在“更多”或状态卡中。
7. 删除文档仍由管理 Tab 发起，并保留收藏引用与运行任务保护。
8. 空闲、完成和失败态使用紧凑摘要；只有运行中任务展开阶段进度，失败摘要直接进入诊断 Tab。
9. 右栏仅保留“概览 / 处理 / 文件”三个主 Tab；低频管理能力归入概览，不新增顶级 Tab。
10. Tab 导航固定，活动面板独立滚动；窄屏不得因完整封面导致右栏不可达。

当前前端处理状态遵循以下结构：

```ts
type BookDetailProcessingState = {
  ocr: {
    job: JobSummary | null;
    status: "idle" | "queued" | "running" | "succeeded" | "failed";
    pending: boolean;
    error: string;
  };
  translation: {
    job: JobSummary | null;
    status: "idle" | "queued" | "running" | "succeeded" | "failed";
    pending: boolean;
    error: string;
  };
};
```

## 已接入：文档 OCR

前端不会下载源 PDF 后重新上传，也不读取后端内部 `upload_id`。当前使用：

```http
POST /api/v1/documents/:document_id/ocr
GET  /api/v1/documents/:document_id/jobs
```

第一个接口由后端把文档已保存的 upload 绑定到新 OCR 任务；第二个接口返回该文档
全部任务并明确 `workflow`。当前组件边界：

- `useBookDetailOcr`：只管理 OCR 页码、提交状态和错误。
- `useDocumentJobs`：首次读取文档任务历史，打开期间每 2 秒对账 document-scoped 列表，
  并订阅共享 `currentJobStore` 获取当前任务的即时状态。
- `OcrActionCard`：与翻译能力并列挂到 `BookDetailProcessingTab`。
- `ProcessingJobSummary`：消费单个归一化任务摘要，不发送请求。

OCR/翻译提交响应必须立即 `upsert` 到 optimistic map，避免首次文档任务查询尚未看到
新任务时丢失状态；服务端列表出现同一 `job_id` 后立即删除临时项。最新任务严格按
`created_at` 选择，不能让旧失败任务覆盖刚提交的新任务。共享 runtime 进入终态后，hook
立即额外对账一次列表；成功修订同时刷新文档详情并令产物清单失效重拉。同一个 `job_id`
的 workflow 身份不可变，runtime/list 刷新只能推进它的状态。

已有翻译任务的重新处理不再走 `POST /documents/:id/translate` 猜测能力，而是读取
`GET /jobs/:job_id/stage-actions`：翻译可重试时展示“重新翻译”，译文产物可用时展示
“重新渲染”。点击后统一调用 `POST /jobs/:job_id/retry-stage`，新 job 立即写入
`useDocumentJobs` 并交给共享 runtime。若后端标记 `danger=true`，前端必须二次确认后才可
提交 `ambiguous_request_policy=accept_duplicate_risk`。

下一步是把取消动作和 artifact manifest 映射继续接入这两个处理卡；动作仍应通过
library controller 注入，展示组件不得直接 import API。

## 文件与产物中心

`BookDetailArtifactsTab` 是文档级编排壳，只有用户切到“文件”Tab 后才逐个读取已结束
任务的 `artifacts-manifest`。运行中任务不会抢跑 manifest；任务状态或 `updated_at`
改变后会重新读取。下载继续使用 `fetchProtected` 和共享保存流程，因而不会把本机
API Key 拼进 URL。

```text
BookDetailArtifactsTab
├─ useBookDetailArtifactCenter   manifest 懒加载、认证下载、局部错误/忙碌态
├─ buildArtifactCenterSections  纯归一化；只接收后端 ready + resource URL 项
└─ ArtifactCenterView           分组列表与预览/下载动作
```

当前真实分组：

- 原始文件：`DocumentRecord.source_pdf_url`，支持源文档阅读和认证下载。
- OCR 与结构化：OCR job manifest 中的 Markdown、标准化文档等。
- 翻译与阅读：book/translate job manifest 中的译文 PDF、对照 PDF、Markdown、任务包。
- 诊断与报告：manifest 中真实注册的 report/summary/diagnostic 类文件。
- Agent 版本：归一化模型已支持候选/提交版本，但当前详情页不会伪造或猜测数据。

展示组件只消费 `ArtifactCenterSection[]`，不判断后端 URL 或任务类型。文件生成时间、
大小和 attempt 仅在后端字段存在时显示；缺字段不使用占位值。

### 后端缺口

1. `LibraryBookDetailView.artifacts` 仍是单个 library job 的展示数组，不是
   `document_id` 下所有 OCR/翻译任务的聚合视图；前端必须先读取 document jobs，
   再逐 job 读取 manifest。
2. manifest 有 `updated_at`、`size_bytes`，但当前 `JobArtifactItemView` 和
   `JobListItemView` 都没有 attempt 字段；前端仅保留前向兼容显示能力。
3. Agent operation 只能按 `conversation_id` 枚举，缺少 document-scoped list；
   `DocumentRecord.active_version_id` 也没有对应的版本历史/下载地址。因此文档详情
   暂不展示 Agent 候选或已提交版本，直到后端提供文档级安全投影。
4. 结构化 job diagnostics 是独立接口，不是可下载 artifact。当前只展示 registry
   中实际存在的诊断/报告文件，不把错误文案伪装成产物。

## 测试要求

- 组件测试固定三个 Tab 的 id 与归属。
- OCR、翻译状态必须分别测试，禁止一个任务覆盖另一个任务。
- 文件 Tab 测试只验证归一化后的产物列表和动作回调。
- 任务提交成功必须验证书架按 `document_id` 就地更新。
- 任何新增 API 都应先在 `frontend/packages/api` 建立类型和客户端，再由 composition 端口注入。
