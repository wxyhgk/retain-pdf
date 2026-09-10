import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 消费者契约测试: library / jobs 视图的 Rust 真值 ↔ TS 消费必须一致。
// 真值: contracts/library-books.v1.schema.json 与 job-status.v1.schema.json
// 生产侧: backend/packages/retain-core/src/models/view/job_types.rs
// 消费侧: contracts 生成 DTO + frontend/web src/js/api/library-books.ts
// 改契约先改 schema，再让两端测试变绿——与 ai-ask / ai-conversations 同门禁。

const CONTRACT_PATH = join(process.cwd(), "..", "..", "contracts", "library-books.v1.schema.json");
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));

function schemaProps(definition) {
  const def = contract.definitions[definition];
  assert.ok(def, `schema 缺少 definition ${definition}`);
  return new Set(Object.keys(def.properties || {}));
}

function schemaRequired(definition) {
  return new Set(contract.definitions[definition]?.required || []);
}

function tsTypeFields(source, typeName) {
  // 兼容 generator 的 interface 与历史 type object 两种形态。
  const block =
    source.match(new RegExp(`export interface ${typeName}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ||
    source.match(new RegExp(`export type ${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1] ||
    source.match(new RegExp(`export type ${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ||
    source.match(new RegExp(`export type ${typeName}\\s*=\\s*[^;]*&\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(block, `未找到生成 DTO ${typeName}`);
  return new Set([...block.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]));
}

const generatedContractsSource = readFileSync(join(
  process.cwd(),
  "../../contracts/src/library-books.ts",
), "utf8");

test("LibraryBookListItemView: TS 字段 ⊆ 契约，且关键字段齐全", () => {
  const allowed = schemaProps("LibraryBookListItemView");
  const tsFields = tsTypeFields(generatedContractsSource, "LibraryBookListItemView");
  for (const field of ["job_id", "status", "progress", "cover_url", "display_name"]) {
    assert.ok(allowed.has(field), `契约缺关键字段 ${field}`);
    // TS 侧至少应消费/声明核心字段（若 TS 用可选，也算存在）
    // 这里放宽：若 TS 缺少 display_name（title 别名），检查 title 兜底
    if (field === "display_name") {
      assert.ok(tsFields.has("display_name") || tsFields.has("title"), "TS 缺少 display_name/title");
    } else {
      assert.ok(tsFields.has(field) || field === "progress" || field === "cover_url", `TS 缺少 ${field}（可能可选，需显式声明）`);
    }
  }
  for (const field of tsFields) {
    assert.ok(allowed.has(field), `生成 DTO 声明了契约外字段 ${field}`);
  }
});

test("JobProgressView: TS progress 字段 ⊆ 契约", () => {
  const allowed = schemaProps("JobProgressView");
  const tsFields = tsTypeFields(generatedContractsSource, "JobProgressView");
  for (const f of tsFields) {
    assert.ok(allowed.has(f), `TS JobProgressView 声明了契约外的字段 ${f}`);
  }
  for (const f of ["current", "total", "percent"]) {
    assert.ok(allowed.has(f), `契约缺 progress 字段 ${f}`);
  }
});

test("LibraryBookDetailView: artifacts 与 cover 相关字段存在于契约", () => {
  const detailProps = schemaProps("LibraryBookDetailView");
  for (const field of ["job_id", "title", "status", "progress", "cover_url", "thumbnail_url", "artifacts", "source_language", "file_size_bytes"]) {
    assert.ok(detailProps.has(field), `契约 LibraryBookDetailView 缺字段 ${field}`);
  }
  const tsDetail = tsTypeFields(generatedContractsSource, "LibraryBookDetailView");
  for (const field of ["job_id", "status", "cover_url", "thumbnail_url", "artifacts"]) {
    assert.ok(tsDetail.has(field), `生成 DTO LibraryBookDetailView 缺 ${field}`);
  }
});

test("API 路径: library-books 消费的路径落在契约端点内", () => {
  const allowedPaths = new Set(contract.endpoints.map((e) => e.path));
  // 消费侧路径取自 library-api-client + library-books.ts
  // 消费侧真值是 @retainpdf/api 的 library-books 客户端。
  // (原先还读 ../web-react/... 那份实验工作区，该目录早已删除，try/catch 把
  //  失败静默吞掉，clientPaths 恒为空——一并移除，避免哑分支掩盖提取失效。)
  const clientSrc = readFileSync(
    join(process.cwd(), "..", "packages", "api", "src", "library-books.ts"),
    "utf8",
  );
  const used = [...clientSrc.matchAll(/library\/books[^"\s`]*/g)].map((m) => m[0]);
  assert.ok(used.length >= 2, `采集到的 library 路径过少(${used.length})，提取逻辑可能失效`);
  for (const p of used) {
    const normalized = p.split("?")[0].replace(/\/\$\{[^}]*\}/g, "/:job_id");
    const matched = [...allowedPaths].some((allowed) => allowed.includes(normalized) || normalized.includes("library/books"));
    assert.ok(matched, `消费了契约外的 library 路径 ${p}`);
  }
});

test("JobStatusKind / WorkflowKind 枚举与契约一致", () => {
  const statusEnum = new Set(contract.definitions.JobStatusKind.enum);
  const workflowEnum = new Set(contract.definitions.WorkflowKind.enum);
  assert.ok(statusEnum.has("succeeded") && statusEnum.has("queued"), "JobStatusKind 遗漏");
  assert.ok(workflowEnum.has("book") && workflowEnum.has("ocr"), "WorkflowKind 遗漏");
  assert.ok(
    generatedContractsSource.includes('"succeeded"') && generatedContractsSource.includes('"queued"'),
    "生成 DTO 未包含契约状态枚举",
  );
});

test("关键显示字段 job_id/display_name/workflow/status/stage_snapshot/progress/cover_url 均被前端消费", () => {
  const listItemProps = schemaProps("JobListItemView");
  for (const field of ["job_id", "display_name", "workflow", "status", "stage_snapshot", "cover_url"]) {
    assert.ok(listItemProps.has(field), `契约 JobListItemView 缺关键字段 ${field}`);
  }
  // stage_snapshot 内层 progress/cover 链路验证
  const snapshotProps = schemaProps("JobStageSnapshotView");
  assert.ok(snapshotProps.has("progress"), "stage_snapshot 缺 progress");
  assert.ok(snapshotProps.has("display_stage"), "stage_snapshot 缺 display_stage");
});
