import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// 端点表的 client_name（前端生成的函数名）和 transport（返回方式）。
// 格式、取值、不重名由 scripts/lint-schemas.mjs 查；这里钉住第 0 期（library-documents.v1）和第 1a 期的名单。
const read = (name) => JSON.parse(readFileSync(resolve(name), "utf8"));

test("library-documents.v1 endpoints all carry the phase-0 client names over the json transport", () => {
  const contract = read("library-documents.v1.schema.json");
  // 第 0 期的 17 条在最前面、顺序不动；第 1b 期加在后面的 3 条由下面单独的 test 钉。
  const table = contract.endpoints.slice(0, 17).map(({ method, path, client_name, transport }) => [method, path, client_name, transport]);
  assert.deepEqual(table, [
    ["GET", "/api/v1/documents", "listDocuments", "json"],
    ["GET", "/api/v1/documents/:document_id", "getDocument", "json"],
    ["PATCH", "/api/v1/documents/:document_id", "patchDocument", "json"],
    ["DELETE", "/api/v1/documents/:document_id", "deleteDocument", "json"],
    ["GET", "/api/v1/documents/:document_id/reading", "getDocumentReading", "json"],
    ["GET", "/api/v1/documents/:document_id/translation-coverage", "getTranslationCoverage", "json"],
    ["GET", "/api/v1/documents/:document_id/files", "listDocumentFiles", "json"],
    ["GET", "/api/v1/documents/:document_id/metadata-suggestions", "listMetadataSuggestions", "json"],
    ["POST", "/api/v1/documents/:document_id/metadata-suggestions", "createMetadataSuggestion", "json"],
    ["POST", "/api/v1/documents/:document_id/metadata-suggestions/:suggestion_id/apply", "applyMetadataSuggestion", "json"],
    ["GET", "/api/v1/search", "searchLibrary", "json"],
    ["GET", "/api/v1/collections", "listCollections", "json"],
    ["POST", "/api/v1/collections", "createCollection", "json"],
    ["PATCH", "/api/v1/collections/:collection_id", "patchCollection", "json"],
    ["DELETE", "/api/v1/collections/:collection_id", "deleteCollection", "json"],
    ["POST", "/api/v1/collections/:collection_id/documents", "addCollectionDocuments", "json"],
    ["DELETE", "/api/v1/collections/:collection_id/documents/:document_id", "removeCollectionDocument", "json"],
  ]);
});

// 第 1a 期补名字的 7 份契约。之后几期在别的契约里起的名字各有自己的 test。
const PHASE_1A_CONTRACTS = new Set([
  "create-job.v1.schema.json",
  "job-data.v1.schema.json",
  "job-events.v2.schema.json",
  "job-status.v1.schema.json",
  "library-books.v1.schema.json",
  "reader-data.v1.schema.json",
  "token-usage.v1.schema.json",
]);

// 第 1a 期以后加进这几份契约的端点，名字由各自的 test 钉（编辑部事件：job-events-v2.test.mjs）。
// 2026-11-14 删掉的三个：getJobUsage（reports/usage，2026-11-20 加回）、listQualityItems（reports/quality/items）、
// getReaderRegion（reader/regions/:item_id），下面的完整清单和 reader-data-contract.test.mjs 钉着后两个不再出现。
// 2026-11-25 删掉 listJobDatasets（GET /jobs/:job_id/data，数据集目录），下面的完整清单钉着它不再出现。
const LATER_NAMES = new Set(["listEditorialEvents"]);

test("phase-1a endpoints carry the client names from the frontend list over the json transport", () => {
  const named = [];
  for (const fileName of readdirSync(resolve(".")).filter((name) => PHASE_1A_CONTRACTS.has(name))) {
    for (const { method, path, client_name, transport } of read(fileName).endpoints || []) {
      if (client_name !== undefined && !LATER_NAMES.has(client_name)) named.push([fileName, method, path, client_name, transport]);
    }
  }
  named.sort((left, right) => left[3].localeCompare(right[3]));
  assert.deepEqual(named, [
    ["create-job.v1.schema.json", "POST", "/api/v1/jobs", "createJob", "json"],
    ["library-books.v1.schema.json", "DELETE", "/api/v1/jobs/:job_id", "deleteJob", "json"],
    // 估价（2026-11-19）
    ["token-usage.v1.schema.json", "GET", "/api/v1/documents/:document_id/usage/estimate", "estimateDocumentUsage", "json"],
    ["token-usage.v1.schema.json", "GET", "/api/v1/usage/estimate", "estimateLibraryUsage", "json"],
    ["token-usage.v1.schema.json", "GET", "/api/v1/documents/:document_id/usage", "getDocumentUsage", "json"],
    ["job-status.v1.schema.json", "GET", "/api/v1/jobs/:job_id", "getJob", "json"],
    ["job-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/data/:dataset", "getJobDataset", "json"],
    // 2026-11-14 删掉、2026-11-20 加回：进度页看这一次花了多少
    ["token-usage.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reports/usage", "getJobUsage", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/progress/layout", "getLiveLayout", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/progress/pages/:page", "getLivePage", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/markdown", "getReaderMarkdown", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/metadata", "getReaderMetadata", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/regions", "getReaderRegions", "json"],
    ["token-usage.v1.schema.json", "GET", "/api/v1/usage", "getUsageSummary", "json"],
    ["job-events.v2.schema.json", "GET", "/api/v1/jobs/:job_id/progress/events", "listJobEvents", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/files", "listJobFiles", "json"],
    ["job-status.v1.schema.json", "GET", "/api/v1/jobs", "listJobs", "json"],
    ["token-usage.v1.schema.json", "POST", "/api/v1/usage/prices", "lookupModelPrices", "json"],
  ]);
  // GET /api/v1/jobs 只登记在 job-status.v1；library-books.v1 重复的那条 2026-10-23 删了。
  const duplicate = read("library-books.v1.schema.json").endpoints.find((endpoint) => endpoint.method === "GET" && endpoint.path === "/api/v1/jobs");
  assert.equal(duplicate, undefined);
});

test("phase-1b translation items and document jobs endpoints carry the client names from the frontend list", () => {
  const revisions = read("translation-revisions.v1.schema.json");
  const named = revisions.endpoints
    .filter((endpoint) => endpoint.client_name !== undefined)
    .map(({ method, path, client_name, transport, input }) => [method, path, client_name, transport, input]);
  assert.deepEqual(named, [
    ["GET", "/api/v1/jobs/:job_id/translations", "listTranslationItems", "json", undefined],
    ["GET", "/api/v1/jobs/:job_id/translations/:item_id", "getTranslationItem", "json", undefined],
    // 单条写回（2026-11-12 前端做「手动改一段译文」时要的）。
    ["PATCH", "/api/v1/jobs/:job_id/translations/:item_id", "updateTranslationItem", "json", "ReviseTranslationItemRequest"],
    // 重放一条不带请求体。
    ["POST", "/api/v1/jobs/:job_id/translations/:item_id/replay", "replayTranslationItem", "json", undefined],
  ]);
  // 修订历史没人调（前端改用 data/revisions），不起名。
  const unnamed = revisions.endpoints.filter((endpoint) => endpoint.client_name === undefined).map(({ method, path }) => [method, path]);
  assert.deepEqual(unnamed, [
    ["GET", "/api/v1/jobs/:job_id/translations/:item_id/revisions"],
  ]);

  const documents = read("library-documents.v1.schema.json");
  const added = documents.endpoints.slice(17, 20).map(({ method, path, client_name, transport, query, input, output }) => [method, path, client_name, transport, query, input, output]);
  assert.deepEqual(added, [
    ["GET", "/api/v1/documents/:document_id/jobs", "listDocumentJobs", "json", "ListDocumentJobsQuery", undefined, "DocumentJobListView"],
    ["POST", "/api/v1/documents/:document_id/translate", "translateDocument", "json", undefined, "CreateJobInput", "JobSubmissionView"],
    ["POST", "/api/v1/documents/:document_id/ocr", "ocrDocument", "json", undefined, "CreateJobInput", "JobSubmissionView"],
  ]);
  for (const endpoint of documents.endpoints.slice(18, 20)) {
    assert.match(endpoint.note, /402/, `${endpoint.path} note 要写 402 页数额度`);
    assert.match(endpoint.note, /PAGE_QUOTA_EXCEEDED/, `${endpoint.path} note 要写错误码`);
  }
});

test("the old response_body key is merged into transport", () => {
  for (const fileName of readdirSync(resolve(".")).filter((name) => name.endsWith(".schema.json"))) {
    for (const endpoint of read(fileName).endpoints || []) {
      assert.equal(Object.hasOwn(endpoint, "response_body"), false, `${fileName} ${endpoint.path} still has response_body`);
    }
  }
});

// 第 1b 期：任务操作（job-actions.v1）和任务报告（job-reports.v1）两份新契约，每条端点都有名字。
test("phase-1b job actions and reports endpoints carry the client names from the frontend list", () => {
  const table = (fileName) => read(fileName).endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table("job-actions.v1.schema.json"), [
    ["GET", "/api/v1/jobs/:job_id/actions", "listJobActions", "json", undefined, undefined, "StageActionsView"],
    // 取消不读请求体。
    ["POST", "/api/v1/jobs/:job_id/actions/cancel", "cancelJob", "json", undefined, undefined, "JobSubmissionView"],
    ["POST", "/api/v1/jobs/:job_id/actions/resolve-ocr-ambiguity", "resolveOcrAmbiguity", "json", "OcrAmbiguityResolutionRequest", undefined, "OcrAmbiguityResolutionView"],
    ["GET", "/api/v1/jobs/:job_id/actions/resume", "getResumePlan", "json", undefined, undefined, "JobResumePlanView"],
    ["POST", "/api/v1/jobs/:job_id/actions/resume", "resumeJob", "json", "ResumeJobInput", undefined, "JobSubmissionView"],
    ["POST", "/api/v1/jobs/:job_id/actions/retry-stage", "retryJobStage", "json", "RetryStageRequest", undefined, "RetryStageSubmissionView"],
  ]);
  assert.deepEqual(table("job-reports.v1.schema.json"), [
    ["GET", "/api/v1/jobs/:job_id/reports/failure", "getFailureReport", "json", undefined, undefined, "JobDiagnosticsView"],
    ["GET", "/api/v1/jobs/:job_id/reports/quality", "getQualityReport", "json", undefined, undefined, "QualitySummaryView"],
    ["GET", "/api/v1/jobs/:job_id/reports/translation", "getTranslationReport", "json", undefined, undefined, "TranslationDiagnosticsView"],
  ]);
});

// 设置类第 2 批第 1 组：术语表（glossaries.v1，2026-10-29），前端排的第一组。导出 CSV 直接是文件（binary）。
test("settings batch 2 glossaries endpoints carry the client names from the frontend list", () => {
  const table = read("glossaries.v1.schema.json").endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table, [
    ["GET", "/api/v1/glossaries", "listGlossaries", "json", undefined, "ListGlossariesQuery", "GlossaryListView"],
    ["POST", "/api/v1/glossaries", "createGlossary", "json", "GlossaryUpsertInput", undefined, "GlossaryDetailView"],
    ["GET", "/api/v1/glossaries/:glossary_id", "getGlossary", "json", undefined, undefined, "GlossaryDetailView"],
    ["PUT", "/api/v1/glossaries/:glossary_id", "updateGlossary", "json", "GlossaryUpsertInput", undefined, "GlossaryDetailView"],
    ["DELETE", "/api/v1/glossaries/:glossary_id", "deleteGlossary", "json", undefined, undefined, "GlossaryDetailView"],
    ["GET", "/api/v1/glossaries/:glossary_id/export.csv", "exportGlossaryCsv", "binary", undefined, undefined, undefined],
    ["POST", "/api/v1/glossaries/parse-csv", "parseGlossaryCsv", "json", "GlossaryCsvParseInput", undefined, "GlossaryCsvParseView"],
  ]);
});

// 译文版本（2026-11-18）：一本书的几份译文，前端能切换。追加在书的端点末尾。
test("translation versions endpoints carry their client names", () => {
  const documents = read("library-documents.v1.schema.json");
  const table = documents.endpoints.slice(20, 23).map(({ method, path, client_name, transport, query, input, output }) => [method, path, client_name, transport, query, input, output]);
  assert.deepEqual(table, [
    ["GET", "/api/v1/documents/:document_id/translation-versions", "listTranslationVersions", "json", "TranslationVersionsQuery", undefined, "TranslationVersionsView"],
    ["PUT", "/api/v1/documents/:document_id/translation-version", "setCurrentTranslationVersion", "json", undefined, "SetCurrentTranslationVersionInput", "TranslationVersionsView"],
    ["PATCH", "/api/v1/documents/:document_id/translation-versions/:version_id", "patchTranslationVersion", "json", undefined, "PatchTranslationVersionInput", "TranslationVersionsView"],
  ]);
  const reading = documents.endpoints.find((endpoint) => endpoint.path === "/api/v1/documents/:document_id/reading");
  assert.equal(reading.query, "DocumentReadingQuery");
  assert.ok(documents.definitions.DocumentReadingView.required.includes("version_id"));
});

test("tag endpoints carry their client names", () => {
  const documents = read("library-documents.v1.schema.json");
  const table = documents.endpoints.slice(23, 28).map(({ method, path, client_name, transport, query, input, output }) => [method, path, client_name, transport, query, input, output]);
  assert.deepEqual(table, [
    ["GET", "/api/v1/tags", "listTags", "json", undefined, undefined, "TagListView"],
    ["POST", "/api/v1/tags", "createTag", "json", undefined, "CreateTagInput", "TagRecord"],
    ["PATCH", "/api/v1/tags/:tag_id", "patchTag", "json", undefined, "PatchTagInput", "TagRecord"],
    ["DELETE", "/api/v1/tags/:tag_id", "deleteTag", "json", undefined, undefined, "TagDeleteResultView"],
    ["PUT", "/api/v1/documents/:document_id/tags", "setDocumentTags", "json", undefined, "SetDocumentTagsInput", "DocumentRecord"],
  ]);
  assert.ok(documents.definitions.DocumentRecord.required.includes("tags"));
  // 2026-11-24 起端点表最后登记书的文件下载（binary，不生成函数）。
  assert.deepEqual(documents.endpoints.slice(28).map(({ method, path, client_name, transport, output }) => [method, path, client_name, transport, output]), [
    ["GET", "/api/v1/documents/:document_id/files/:name", undefined, "binary", undefined],
  ]);
  assert.equal(documents.definitions.ListDocumentsQuery.properties.tag_id.type, "string");
});

// 设置类第 2 批第 2 组：凭据（credentials.v1，2026-11-24）。前端手写的 listCredentials、createCredential、updateCredential 同名；
// getCredential、deleteCredential 前端还没有调用方，名字照同一个规则起。
test("settings batch 2 credentials endpoints carry their client names", () => {
  const table = read("credentials.v1.schema.json").endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table, [
    ["GET", "/api/v1/credentials", "listCredentials", "json", undefined, undefined, "CredentialListView"],
    ["POST", "/api/v1/credentials", "createCredential", "json", "CreateCredentialInput", undefined, "CredentialMutationView"],
    ["GET", "/api/v1/credentials/:credential_ref", "getCredential", "json", undefined, undefined, "CredentialMutationView"],
    ["PUT", "/api/v1/credentials/:credential_ref", "updateCredential", "json", "UpdateCredentialInput", undefined, "CredentialMutationView"],
    ["DELETE", "/api/v1/credentials/:credential_ref", "deleteCredential", "json", undefined, "DeleteCredentialQuery", "CredentialDeleteView"],
  ]);
});

// 设置类第 2 批第 3 组：服务商校验（provider-probes.v1）和字体（platform-settings.v1 的 GET /fonts），2026-11-24。
// 名字和前端手写的（frontend/packages/api/src/providers.ts、fonts.ts）一样。
test("settings batch 2 provider probe endpoints carry their client names", () => {
  const table = read("provider-probes.v1.schema.json").endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table, [
    ["POST", "/api/v1/providers/mineru/validate-token", "validateMineruToken", "json", "MineruTokenValidationRequest", undefined, "ProviderProbeView"],
    ["POST", "/api/v1/providers/paddle/validate-token", "validatePaddleToken", "json", "PaddleTokenValidationRequest", undefined, "ProviderProbeView"],
    ["POST", "/api/v1/providers/deepseek/validate-token", "validateDeepSeekToken", "json", "DeepSeekTokenValidationRequest", undefined, "ProviderProbeView"],
    ["POST", "/api/v1/providers/deepseek/balance", "queryDeepSeekBalance", "json", "DeepSeekTokenValidationRequest", undefined, "DeepSeekBalanceView"],
  ]);
});

// platform-settings.v1：字体（第 3 组）、同步（第 4 组）、备份（第 5 组）、健康检查。名字照前端手写的，
// fetchXxx 照术语表的先例改成 getXxx（fetchSyncStatus → getSyncStatus、fetchBackupStatus → getBackupStatus）。
// /health 不在 /api/v1 下，前端生成器不生成它，所以没有 client_name。
test("settings batch 2 platform endpoints carry their client names", () => {
  const table = read("platform-settings.v1.schema.json").endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table, PLATFORM_ENDPOINTS);
});

const PLATFORM_ENDPOINTS = [
  ["GET", "/api/v1/fonts", "listFonts", "json", undefined, undefined, "FontListView"],
  ["GET", "/api/v1/sync", "getSyncStatus", "json", undefined, undefined, "SyncStatusView"],
  ["PUT", "/api/v1/sync", "updateSyncSettings", "json", "SyncSettingsInput", undefined, "SyncStatusView"],
  ["POST", "/api/v1/sync/run", "runSyncNow", "json", undefined, undefined, "SyncStatusView"],
  ["POST", "/api/v1/sync/test", "testSyncTarget", "json", "SyncSettingsInput", undefined, "SyncTestView"],
  ["GET", "/api/v1/backups", "getBackupStatus", "json", undefined, undefined, "BackupStatusView"],
  ["POST", "/api/v1/backups", "createBackup", "json", undefined, undefined, "BackupItemView"],
  ["DELETE", "/api/v1/backups/:backup_id", "deleteBackup", "json", undefined, undefined, "BackupStatusView"],
  ["POST", "/api/v1/backups/:backup_id/restore", "restoreBackup", "json", undefined, undefined, "BackupRestoreView"],
  ["GET", "/health", undefined, "json", undefined, undefined, "HealthView"],
];

// 登录状态（auth-session.v1）、上传（uploads.v1），2026-11-24。fetchAuthSession 照术语表的先例叫 getAuthSession。
// 上传是 multipart，生成器只会发 JSON，所以没有 client_name（网页用 XHR 自己发，要上传进度）。
test("auth session and upload endpoints", () => {
  const table = (fileName) => read(fileName).endpoints.map(({ method, path, client_name, transport, input, query, output }) => [
    method, path, client_name, transport, input, query, output,
  ]);
  assert.deepEqual(table("auth-session.v1.schema.json"), [
    ["GET", "/api/v1/auth/session", "getAuthSession", "json", undefined, undefined, "SessionView"],
  ]);
  assert.deepEqual(table("uploads.v1.schema.json"), [
    ["POST", "/api/v1/uploads", undefined, "json", undefined, undefined, "UploadView"],
  ]);
});
