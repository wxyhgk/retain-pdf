// mock 层的「后端契约」镜像。
//
// 真后端的 CreateJobInput 及其五个段全部带 #[serde(deny_unknown_fields)]:
// 多一个键、拼错一个键 => 400 invalid job payload。mock 以前对 payload 是
// `void payload`,什么都不看,于是前端测试在一个比真后端宽松得多的世界里跑,
// 字段名写错要等到真提一次任务才暴露。
//
// 字段名**不在这里维护**。它们从 create-job.v1.schema.json 生成
// (contracts/scripts/generate-types.mjs => contracts/src/create-job-fields.ts),
// 和 payload.ts 用的 TS 类型出自同一份 schema。这条链上每一环都有人钉着:
//
//   Rust(serde)  <=>  create-job.v1.schema.json  =>  create-job-fields.ts  =>  这里
//        ^ request.rs 的 contract_tests          ^ contracts 的 generate:check
//
// 另外 tests/platform/mock-job-payload-contract.test.mjs 直接读 schema 原文,
// 再比一次本文件对外暴露的那两张表 —— 确认生成物真的派生自 schema,
// 而不是哪天又被手抄回来。
import {
  CREATE_JOB_SECTION_FIELDS,
  CREATE_JOB_TOP_LEVEL_FIELDS,
} from "@retainpdf/contracts/create-job-fields";

export const JOB_PAYLOAD_TOP_LEVEL_FIELDS = CREATE_JOB_TOP_LEVEL_FIELDS;

export const JOB_PAYLOAD_SECTION_FIELDS = CREATE_JOB_SECTION_FIELDS;

/** 模拟后端的 deny_unknown_fields:多一个键就抛,和真后端的 400 对齐。 */
export function assertKnownJobPayloadFields(payload, { label = "/api/v1/jobs" } = {}) {
  if (!payload || typeof payload !== "object") return;
  const unknownTop = Object.keys(payload).filter(
    (key) => !JOB_PAYLOAD_TOP_LEVEL_FIELDS.includes(key),
  );
  if (unknownTop.length > 0) {
    throw new Error(
      `提交失败: ${label} 不认识顶层字段 ${unknownTop.join(", ")}。`
        + `真后端 CreateJobInput 带 deny_unknown_fields,会直接 400。`,
    );
  }
  for (const [section, allowed] of Object.entries(JOB_PAYLOAD_SECTION_FIELDS)) {
    const value = payload[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      throw new Error(
        `提交失败: ${label} 的 ${section} 段不认识字段 ${unknown.join(", ")}。`
          + `真后端该段带 deny_unknown_fields,会直接 400。`,
      );
    }
  }
}

/** 阶段重试的 overrides 走同一份契约:后端对它做 serde_json::from_value。 */
export function assertKnownStageOverrides(overrides, { label = "retry-stage" } = {}) {
  if (!overrides || typeof overrides !== "object") return;
  for (const [section, allowed] of Object.entries(JOB_PAYLOAD_SECTION_FIELDS)) {
    const value = overrides[section];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      throw new Error(
        `重试失败: ${label} 的 overrides.${section} 不认识字段 ${unknown.join(", ")}。`
          + `后端会以 invalid ${section} overrides 返回 400。`,
      );
    }
  }
}
