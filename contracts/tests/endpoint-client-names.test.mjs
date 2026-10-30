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
    ["token-usage.v1.schema.json", "GET", "/api/v1/documents/:document_id/usage", "getDocumentUsage", "json"],
    ["job-status.v1.schema.json", "GET", "/api/v1/jobs/:job_id", "getJob", "json"],
    ["job-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/data/:dataset", "getJobDataset", "json"],
    ["token-usage.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reports/usage", "getJobUsage", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/progress/layout", "getLiveLayout", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/progress/pages/:page", "getLivePage", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/markdown", "getReaderMarkdown", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/metadata", "getReaderMetadata", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/reader/regions", "getReaderRegions", "json"],
    ["token-usage.v1.schema.json", "GET", "/api/v1/usage", "getUsageSummary", "json"],
    ["job-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/data", "listJobDatasets", "json"],
    ["job-events.v2.schema.json", "GET", "/api/v1/jobs/:job_id/progress/events", "listJobEvents", "json"],
    ["reader-data.v1.schema.json", "GET", "/api/v1/jobs/:job_id/files", "listJobFiles", "json"],
    ["job-status.v1.schema.json", "GET", "/api/v1/jobs", "listJobs", "json"],
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
    // 重放一条不带请求体。
    ["POST", "/api/v1/jobs/:job_id/translations/:item_id/replay", "replayTranslationItem", "json", undefined],
  ]);
  // 同一份契约里的写回（PATCH）和修订历史前端清单没给名字，不起名。
  const unnamed = revisions.endpoints.filter((endpoint) => endpoint.client_name === undefined).map(({ method, path }) => [method, path]);
  assert.deepEqual(unnamed, [
    ["PATCH", "/api/v1/jobs/:job_id/translations/:item_id"],
    ["GET", "/api/v1/jobs/:job_id/translations/:item_id/revisions"],
  ]);

  const documents = read("library-documents.v1.schema.json");
  const added = documents.endpoints.slice(17).map(({ method, path, client_name, transport, query, input, output }) => [method, path, client_name, transport, query, input, output]);
  assert.deepEqual(added, [
    ["GET", "/api/v1/documents/:document_id/jobs", "listDocumentJobs", "json", "ListDocumentJobsQuery", undefined, "DocumentJobListView"],
    ["POST", "/api/v1/documents/:document_id/translate", "translateDocument", "json", undefined, "CreateJobInput", "JobSubmissionView"],
    ["POST", "/api/v1/documents/:document_id/ocr", "ocrDocument", "json", undefined, "CreateJobInput", "JobSubmissionView"],
  ]);
  for (const endpoint of documents.endpoints.slice(18)) {
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
  const artifact = read("agent-calculation.v1.schema.json").endpoints.find((endpoint) => endpoint.path.endsWith("/artifacts/:artifact_id"));
  assert.equal(artifact.transport, "binary");
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
    ["GET", "/api/v1/jobs/:job_id/reports/quality/items", "listQualityItems", "json", undefined, "QualityItemsQuery", "QualityItemsView"],
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
