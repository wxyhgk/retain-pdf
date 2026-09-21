// mock 模拟的 deny_unknown_fields 必须和后端认的字段集合一模一样。
//
// 真后端五个段全部带 #[serde(deny_unknown_fields)]:多一个键、拼错一个键 => 400。
// mock 以前对 payload 是 `void payload`,于是前端测试跑在一个比真后端宽松得多的
// 世界里,字段名写错要等到真提一次任务才暴露。
//
// 这里守的是**最后一环**:mock 暴露的字段表,必须逐字等于
// contracts/create-job.v1.schema.json 里那几个 definition 的 properties。
// 它读的是 schema 原文,不读生成物,所以生成物哪天被手改、或者有人又把一张表抄回
// mock 里,这条都会红。
//
// 整条链的分工(改了这里请一起改 mock 文件顶部那段注释):
//
//   1. Rust(serde) <=> schema:字段集合双向一致
//      backend/packages/retain-core/src/models/input/request.rs
//      :: contract_tests::create_job_input_field_sets_match_the_published_schema
//      => 后端加/删字段而 schema 没跟上 => cargo test -p retain-core 红
//
//   2. schema => contracts/src/create-job-fields.ts:生成物不许落后
//      contracts 的 `npm run generate:check`(npm test 的第一步)
//
//   3. 生成物 => mock:本文件
//
//   反向自保(后端把某段改宽松了,mock 不该继续替它拒绝未知字段)由
//   request.rs :: contract_tests::every_pinned_definition_still_rejects_unknown_fields
//   守:它真的拿一个带未知键的 JSON 去反序列化,拿不到错误就红。
//   那条测试比"在 .rs 源码里 grep deny_unknown_fields"结实:它测的是行为,
//   改成 `#[serde(flatten)]`、换自定义 Deserialize 之类也照样能挡住。
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
const SCHEMA_PATH = resolve(REPO_ROOT, "contracts/create-job.v1.schema.json");
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

/** 从 schema 里抠出某个 definition 的 properties 键。解析不出来就直接红。 */
function schemaFields(definitionName) {
  const definition = SCHEMA.definitions?.[definitionName];
  assert.ok(
    definition,
    `schema 里没有 definitions.${definitionName} —— 契约结构变了，这条测试已经失效`,
  );
  const fields = Object.keys(definition.properties ?? {}).sort();
  assert.ok(
    fields.length > 0,
    `definitions.${definitionName}.properties 解析出来是空的 —— 解析写法已失效`,
  );
  return fields;
}

/** 段名 -> definition 名,同样从 schema 读,不另抄一张映射表。 */
function schemaSections() {
  const rootProperties = SCHEMA.definitions.CreateJobInput.properties;
  const sections = Object.entries(rootProperties)
    .map(([field, node]) => [field, `${node?.$ref ?? ""}`.replace("#/definitions/", "")])
    .filter(([, name]) => typeof SCHEMA.definitions?.[name]?.properties === "object");
  assert.ok(sections.length > 0, "CreateJobInput 没解析出任何段 —— 解析写法已失效");
  return sections;
}

test("mock 的顶层字段表逐字等于 schema 的 CreateJobInput.properties", () => {
  assert.deepEqual(
    [...JOB_PAYLOAD_TOP_LEVEL_FIELDS].sort(),
    schemaFields("CreateJobInput"),
  );
});

test("mock 的分段字段表逐字等于 schema 对应 definition 的 properties", () => {
  const sections = schemaSections();
  // 段的集合本身也要一致:schema 多一个段而 mock 没有,那一段就会被完全放行。
  assert.deepEqual(
    Object.keys(JOB_PAYLOAD_SECTION_FIELDS).sort(),
    sections.map(([field]) => field).sort(),
    "mock 覆盖的段与 schema 的段对不上",
  );
  for (const [section, definitionName] of sections) {
    assert.deepEqual(
      [...JOB_PAYLOAD_SECTION_FIELDS[section]].sort(),
      schemaFields(definitionName),
      `${section} 段的字段表和 ${definitionName} 对不上`,
    );
  }
});

test("mock 拒绝未知字段,是因为 schema 把这些 definition 关死了", () => {
  // schema 一旦把某个 definition 放开成默认允许额外字段,mock 就不该继续替它拒绝。
  // (schema 与 Rust 的这一条对齐由 request.rs 的 contract_tests 守。)
  for (const definitionName of ["CreateJobInput", ...schemaSections().map(([, name]) => name)]) {
    assert.equal(
      SCHEMA.definitions[definitionName].additionalProperties,
      false,
      `definitions.${definitionName} 不再是 additionalProperties: false —— `
        + "mock 不该继续替它拒绝未知字段",
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
