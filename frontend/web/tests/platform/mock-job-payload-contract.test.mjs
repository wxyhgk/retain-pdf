// mock 里那几张字段表必须和 Rust 的 CreateJobInput 一模一样。
//
// 真后端五个段全部带 #[serde(deny_unknown_fields)]:多一个键、拼错一个键 => 400。
// mock 以前对 payload 是 `void payload`,于是前端测试跑在一个比真后端宽松得多的
// 世界里,字段名写错要等到真提一次任务才暴露。
//
// 现在 mock 会模拟 deny_unknown_fields,但那张表是手抄的 —— 手抄就会漂,
// 所以这里直接读 Rust 源码比对。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  JOB_PAYLOAD_SECTION_FIELDS,
  JOB_PAYLOAD_TOP_LEVEL_FIELDS,
  assertKnownJobPayloadFields,
  assertKnownStageOverrides,
} from "../../src/platform/api/mocks/job-payload-contract.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const INPUT_DIR = resolve(REPO_ROOT, "backend/packages/retain-core/src/models/input");

const SECTION_STRUCTS = {
  source: ["source.rs", "JobSourceInput"],
  ocr: ["ocr.rs", "OcrInput"],
  translation: ["translation.rs", "TranslationInput"],
  render: ["render.rs", "RenderInput"],
  runtime: ["runtime.rs", "RuntimeInput"],
};

/** 从 .rs 里抠出某个结构体的 `pub <field>:` 名字。 */
function rustStructFields(file, structName) {
  const text = readFileSync(resolve(INPUT_DIR, file), "utf8");
  const head = `pub struct ${structName} {`;
  const start = text.indexOf(head);
  assert.ok(start >= 0, `${file} 里找不到 ${structName} —— 结构体改名了，这条测试已经失效`);
  const body = text.slice(start, text.indexOf("\n}", start));
  const fields = [...body.matchAll(/^\s*pub (\w+):/gm)].map((m) => m[1]).sort();
  assert.ok(fields.length > 0, `${structName} 解析出来是空的 —— 解析写法已失效`);
  return fields;
}

test("mock 的字段表和 Rust 的 CreateJobInput 逐段一致", () => {
  for (const [section, [file, structName]] of Object.entries(SECTION_STRUCTS)) {
    assert.deepEqual(
      [...JOB_PAYLOAD_SECTION_FIELDS[section]].sort(),
      rustStructFields(file, structName),
      `${section} 段的字段表和 ${structName} 对不上`,
    );
  }
});

test("mock 的顶层字段表和 CreateJobInput 一致", () => {
  const text = readFileSync(resolve(INPUT_DIR, "request.rs"), "utf8");
  const start = text.indexOf("pub struct CreateJobInput {");
  assert.ok(start >= 0, "request.rs 里找不到 CreateJobInput");
  const body = text.slice(start, text.indexOf("\n}", start));
  const fields = [...body.matchAll(/^\s*pub (\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual([...JOB_PAYLOAD_TOP_LEVEL_FIELDS].sort(), fields);
});

test("五个段在 Rust 侧都还带着 deny_unknown_fields", () => {
  // 哪天后端把某个段改宽松了,mock 就不该再替它报错。
  for (const [section, [file, structName]] of Object.entries(SECTION_STRUCTS)) {
    const text = readFileSync(resolve(INPUT_DIR, file), "utf8");
    const start = text.indexOf(`pub struct ${structName} {`);
    const head = text.slice(Math.max(0, start - 200), start);
    assert.ok(
      head.includes("deny_unknown_fields"),
      `${structName} 不再带 deny_unknown_fields，mock 不该继续替它拒绝未知字段（${section}）`,
    );
  }
});

test("拼错的字段名会被拒绝，正确的照常通过", () => {
  const good = {
    workflow: "book",
    translation: { model: "m", base_url: "b", api_key: "k", workers: 4 },
  };
  assert.doesNotThrow(() => assertKnownJobPayloadFields(good));

  assert.throws(
    () => assertKnownJobPayloadFields({ translation: { batchSize: 8 } }),
    /batchSize/,
    "camelCase 拼错应当被拒绝",
  );
  assert.throws(
    () => assertKnownJobPayloadFields({ translation: { api_key_configured: true } }),
    /api_key_configured/,
    "把响应 DTO 回灌成请求应当被拒绝",
  );
  assert.throws(
    () => assertKnownJobPayloadFields({ nonsense: 1 }),
    /nonsense/,
    "未知顶层字段应当被拒绝",
  );
});

test("阶段重试的 overrides 走同一份契约", () => {
  assert.doesNotThrow(() =>
    assertKnownStageOverrides({ translation: { model: "m" } }));
  assert.throws(
    () => assertKnownStageOverrides({ translation: { glossaryId: "g" } }),
    /glossaryId/,
  );
});
