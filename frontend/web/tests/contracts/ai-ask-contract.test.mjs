import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 消费者契约测试:frontend 对 /v1/ask 的消费必须与
// contracts/ai-ask.v1.schema.json(三方单一真值)一致。
// 生产侧锁在 backend/ai/tests/test_contract_schema.py。
// 改契约先改 schema,再让两端测试变绿——这是后端"服务化契约"的第一块门禁。

const CONTRACT_PATH = join(
  process.cwd(),
  "..",
  "..",
  "contracts",
  "ai-ask.v1.schema.json",
);
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));

test("SSE 事件类型:前端处理的类型 ⊆ 契约枚举,且关键事件全覆盖", () => {
  const declared = new Set(contract.definitions.SseEventType.enum);
  const source = readFileSync(join(process.cwd(), "src/platform/api/legacy/ai.ts"), "utf8");
  const handled = new Set(
    [...source.matchAll(/event\.type === "([a-z_]+)"/g)].map((m) => m[1]),
  );
  for (const type of handled) {
    assert.ok(declared.has(type), `前端处理了契约外的事件类型 ${type}`);
  }
  // 关键事件必须被处理(compress 允许忽略)
  for (const type of ["tool", "answer_delta", "done", "error"]) {
    assert.ok(handled.has(type), `前端未处理关键事件 ${type}`);
  }
});

test("done payload:normalizeDonePayload 消费的字段 ⊆ 契约", () => {
  const properties = new Set(Object.keys(contract.definitions.DonePayload.properties));
  // conversationId 是前端归一化别名,contract 侧对应 conversation_id
  const source = readFileSync(join(process.cwd(), "src/platform/api/legacy/ai.ts"), "utf8");
  const normalized = source.match(/function normalizeDonePayload[\s\S]*?\n\}/)?.[0] || "";
  const consumed = new Set(
    [...normalized.matchAll(/payload\?\.([a-zA-Z_]+)/g)].map((m) => m[1]),
  );
  consumed.delete("conversationId"); // 兼容旧字段别名,不属契约
  for (const field of consumed) {
    assert.ok(properties.has(field), `前端消费了契约外的 done 字段 ${field}`);
  }
  // 契约 required 中前端依赖的核心字段必须被消费
  for (const field of ["answer", "citations", "persisted"]) {
    assert.ok(consumed.has(field), `前端未消费契约字段 ${field}`);
  }
});

test("Citation:前端跳转依赖的字段存在于契约", () => {
  const properties = new Set(Object.keys(contract.definitions.Citation.properties));
  for (const field of ["ref", "block_id", "page_idx", "snippet", "job_id", "document_id"]) {
    assert.ok(properties.has(field), `契约缺少前端依赖的 Citation 字段 ${field}`);
  }
  // page_idx 语义锁:0 基(minimum 0);前端 resolveCitationPageIdx 依赖此语义
  assert.equal(contract.definitions.Citation.properties.page_idx.minimum, 0);
});

test("AskInput:前端发送的字段 ⊆ 契约", () => {
  const properties = new Set(Object.keys(contract.definitions.AskInput.properties));
  const source = readFileSync(join(process.cwd(), "src/platform/api/legacy/ai.ts"), "utf8");
  // askLibraryAi 组装请求体的两种写法:初始化字面量 + payload.xxx = 条件赋值
  const sent = new Set([
    ...[...source.matchAll(/payload\.([a-z_]+)\s*=/g)].map((m) => m[1]),
    "question",
    "stream",
  ]);
  for (const field of sent) {
    assert.ok(properties.has(field), `前端发送了契约外的请求字段 ${field}`);
  }
  assert.ok(sent.size >= 6, `采集到的发送字段过少(${sent.size}),提取逻辑可能失效`);
});
