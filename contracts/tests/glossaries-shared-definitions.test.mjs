import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// glossaries.v1 里抄来的定义（设置类第 2 批，2026-10-29）。$ref 不能跨文件，前端生成器也只读同一份契约的
// definitions，所以词条 GlossaryEntryInput 从 create-job.v1 原样抄了一份（建任务时 translation.glossary_entries
// 用的也是它）；这里锁住它和源头一致。要改先改 create-job.v1，再照抄过来。
const read = (name) => JSON.parse(readFileSync(resolve(name), "utf8"));

test("glossaries.v1 copy of GlossaryEntryInput is identical to create-job.v1", () => {
  const upstream = read("create-job.v1.schema.json").definitions;
  const glossaries = read("glossaries.v1.schema.json").definitions;
  assert.deepEqual(glossaries.GlossaryEntryInput, upstream.GlossaryEntryInput);
  // 抄的这一个不引用别的定义，不会漏抄一层。
  assert.doesNotMatch(JSON.stringify(upstream.GlossaryEntryInput), /\$ref/);
});
