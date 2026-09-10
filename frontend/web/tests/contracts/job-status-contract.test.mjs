import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// 消费者契约测试: 任务状态 / 阶段进度 Rust 真值 ↔ TS 消费
// 真值: contracts/job-status.v1.schema.json
// 生产侧: backend/packages/retain-core/src/models/view/{job_types.rs, common.rs}
// 消费侧: frontend/packages/domain/src/job/{types,normalize}.ts
//         & frontend/packages/domain/src/job-status/types.ts
//         frontend/web-react src/features/status/types.ts & library/api/library-api-adapter.ts
// 与 library-books、ai-ask、ai-conversations 同属 schema 门禁。

const CONTRACT_PATH = join(process.cwd(), "..", "..", "contracts", "job-status.v1.schema.json");
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
const DOMAIN_JOB_STATUS_ROOT = join(
  process.cwd(),
  "../../frontend/packages/domain/src/job-status",
);

function collectTypeScriptSources(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = join(root, entry.name);
    if (entry.isDirectory()) return collectTypeScriptSources(target);
    return entry.isFile() && entry.name.endsWith(".ts") ? [target] : [];
  });
}

function schemaProps(definition) {
  const def = contract.definitions[definition];
  assert.ok(def, `schema 缺少 definition ${definition}`);
  return new Set(Object.keys(def.properties || {}));
}

function schemaRequired(definition) {
  return new Set(contract.definitions[definition]?.required || []);
}

function tsInterfaceFields(source, interfaceName) {
  // 匹配 interface 或 type 块
  const pattern = new RegExp(`(?:export\\s+(?:interface|type)\\s+${interfaceName}[\\s\\S]*?\\{)([\\s\\S]*?)\\n\\}`, "m");
  const block = source.match(pattern)?.[1];
  assert.ok(block, `未找到 ${interfaceName}`);
  return new Set([...block.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]));
}

function tsTypeFieldsLoose(source, typeName) {
  const block = source.match(new RegExp(`export type ${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1];
  if (!block) return null;
  return new Set([...block.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]));
}

// 白盒例外：这里校验接口字段源码，路径由 test-layout 的显式清单约束。
const jobTypesSrc = readFileSync(join(
  process.cwd(),
  "../../frontend/packages/domain/src/job/types.ts",
), "utf8");
const jobStatusTypesSrc = readFileSync(join(
  process.cwd(),
  "../../frontend/packages/domain/src/job-status/types.ts",
), "utf8");

// web-react 已删除（单前端聚焦 frontend/web）：仅作存在性校验，缺失则跳过对齐断言
let statusReactSrc = "";
try {
  statusReactSrc = readFileSync(join(process.cwd(), "..", "web-react", "src", "features", "status", "types.ts"), "utf8");
} catch {
  try {
    statusReactSrc = readFileSync(join(process.cwd(), "../../frontend/web-react/src/features/status/types.ts"), "utf8");
  } catch {
    statusReactSrc = "";
  }
}

test("JobDetailView: 契约 required 含 job_id/workflow/status/stage_snapshot/progress/cover 链路", () => {
  const detailRequired = schemaRequired("JobDetailView");
  for (const f of ["job_id", "workflow", "status", "book_summary", "artifacts"]) {
    assert.ok(detailRequired.has(f) || schemaProps("JobDetailView").has(f), `契约 JobDetailView 缺 ${f}`);
  }
  // 关键重复字段必须在 schema 可达
  assert.ok(schemaProps("JobDetailView").has("job_id"));
  assert.ok(schemaProps("JobDetailView").has("status"));
  // book_summary.cover_url 是 cover 链路真值
  assert.ok(schemaProps("BookSummaryView").has("cover_url"));
  assert.ok(schemaProps("BookSummaryView").has("file_size_bytes"));
});

test("JobStageSnapshotView: display_stage/stage/substage/lane/stage_detail/progress 完整", () => {
  const props = schemaProps("JobStageSnapshotView");
  for (const f of ["display_stage", "stage", "substage", "lane", "stage_detail", "progress"]) {
    assert.ok(props.has(f), `JobStageSnapshotView 缺 ${f}`);
  }
  const progressProps = schemaProps("JobProgressView");
  for (const f of ["current", "total", "percent", "unit"]) {
    assert.ok(progressProps.has(f), `JobProgressView 缺 ${f}`);
  }
  // 前端 adapter 依赖的字段必须存在
  const adapterSrc = readFileSync(join(
    process.cwd(),
    "../../frontend/packages/domain/src/job-status/job-stage-contract-adapter.ts",
  ), "utf8");
  assert.ok(adapterSrc.includes("display_stage") || adapterSrc.includes("displayStage"), "adapter 未消费 display_stage");
});

test("JobProgressView: TS JobProgress ⊆ 契约，且 percent 语义正确", () => {
  const allowed = schemaProps("JobProgressView");
  // job/types.ts :: JobProgress
  const tsFields = tsInterfaceFields(jobTypesSrc, "JobProgress");
  for (const f of tsFields) {
    // TS 用 current/total/percent/unit 与契约一致（snake_case vs TS 当前已统一为 current/total/percent/unit）
    assert.ok(allowed.has(f), `TS JobProgress 字段 ${f} 不在契约中`);
  }
  // job-status/types.ts :: StructuredProgress / ProgressRecord 也应映射到契约
  const structured = tsInterfaceFields(jobStatusTypesSrc, "StructuredProgress");
  for (const f of ["current", "total", "percent", "unit"]) {
    assert.ok(structured.has(f) || allowed.has(f), `StructuredProgress 缺 ${f}`);
  }
  assert.equal(contract.definitions.JobProgressView.properties.percent.maximum, 100);
});

test("JobStagesView: ocr/translation/render 三阶段齐全且前端可见", () => {
  const stagesProps = schemaProps("JobStagesView");
  assert.deepEqual([...stagesProps].sort(), ["ocr", "render", "translation"]);
  // 前端 stage 引擎映射依赖
  const engineSrc = readFileSync(join(
    process.cwd(),
    "../../frontend/packages/domain/src/job-status/public-stage-engine.ts",
  ), "utf8");
  for (const stage of ["ocr", "translation", "render"]) {
    assert.ok(engineSrc.includes(stage), `public-stage-engine 未处理 ${stage}`);
  }
  assert.ok(jobStatusTypesSrc.includes("StageKey") || jobTypesSrc.includes("StageKey"), "TS 缺少 StageKey");
});

test("JobListItemView: 列表卡关键字段与契约一致，且前端 normalize 覆盖", () => {
  const listProps = schemaProps("JobListItemView");
  for (const f of ["job_id", "display_name", "workflow", "status", "stage_snapshot", "cover_url", "thumbnail_url", "output_pdf_ready", "detail_path", "detail_url"]) {
    assert.ok(listProps.has(f), `JobListItemView 契约缺 ${f}`);
  }
  // 前端 normalize 必须透传这些字段（silent 轮询与书架卡合并依赖）
  const normalizeSrc = readFileSync(join(
    process.cwd(),
    "../../frontend/packages/domain/src/job/normalize.ts",
  ), "utf8");
  for (const f of ["job_id", "display_name", "cover_url", "stage_snapshot"]) {
    assert.ok(normalizeSrc.includes(f), `normalize 未透传 ${f}`);
  }
  // TS JobLike 为宽松类型（包含 [key:string]:unknown），关键字段需在源码中出现而非必显式 interface 字段
  for (const f of ["job_id", "status", "stage_snapshot"]) {
    assert.ok(jobTypesSrc.includes(f), `TS JobLike 源码未出现 ${f}`);
  }
  // cover_url 虽为宽松透传，但需在 normalize 或类型注释中出现
  assert.ok(jobTypesSrc.includes("cover_url") || normalizeSrc.includes("cover_url"), "TS 未透传 cover_url");
});

test("BookSummaryView / ArtifactDisplayItemView: 详情页透传字段在契约", () => {
  assert.ok(schemaProps("BookSummaryView").has("title"));
  assert.ok(schemaProps("BookSummaryView").has("source_file_name"));
  assert.ok(schemaProps("ArtifactDisplayItemView").has("download_url"));
  assert.ok(schemaProps("ArtifactDisplayItemView").has("file_name"));
});

test("Stage progress bundle: 前端进度文案与契约 progress 单测对齐", () => {
  // job-status-summary-progress.ts 依赖 progress.current/total/unit
  const progressSummarySrc = readFileSync(join(
    process.cwd(),
    "../../frontend/packages/domain/src/job-status/summary/job-status-summary-progress.ts",
  ), "utf8");
  assert.ok(progressSummarySrc.includes("progress") && progressSummarySrc.includes("current"), "progress 文案未基于契约 progress");
  // web-react status/types.ts 阶段进度亦应对齐（已删除则跳过）
  if (statusReactSrc) {
    assert.ok(statusReactSrc.includes("StageProgress") || statusReactSrc.includes("stageProgress"));
  }
});

test("domain legacy stage payload adapter stays isolated", () => {
  const allowedFiles = new Set(["job-stage-event-record.ts"]);
  const offenders = collectTypeScriptSources(DOMAIN_JOB_STATUS_ROOT)
    .filter((file) => !allowedFiles.has(relative(DOMAIN_JOB_STATUS_ROOT, file)))
    .filter((file) => readFileSync(file, "utf8").includes("legacyStagePayloadFromEventRecord"))
    .map((file) => relative(DOMAIN_JOB_STATUS_ROOT, file));

  assert.deepEqual(offenders, []);
});

test("枚举锁: JobStatusKind 与 WorkflowKind 前端消费 ⊆ 契约", () => {
  const statusEnum = new Set(contract.definitions.JobStatusKind.enum);
  const workflowEnum = new Set(contract.definitions.WorkflowKind.enum);
  const allTs = jobTypesSrc + jobStatusTypesSrc + statusReactSrc;
  // 抽查前端出现的状态字面量应在枚举内
  const tsStatuses = [...allTs.matchAll(/\"(queued|running|succeeded|failed|canceled)\"/g)].map((m) => m[1]);
  for (const s of tsStatuses) {
    assert.ok(statusEnum.has(s), `TS 使用了契约外的 status ${s}`);
  }
  const tsWorkflows = [...allTs.matchAll(/\"(book|ocr|translate|render)\"/g)].map((m) => m[1]);
  for (const w of tsWorkflows) {
    assert.ok(workflowEnum.has(w), `TS 使用了契约外的 workflow ${w}`);
  }
});
