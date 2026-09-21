// mock 层的「后端契约」镜像。
//
// 真后端的 CreateJobInput 及其五个段全部带 #[serde(deny_unknown_fields)]:
// 多一个键、拼错一个键 => 400 invalid job payload。mock 以前对 payload 是
// `void payload`,什么都不看,于是前端测试在一个比真后端宽松得多的世界里跑,
// 字段名写错要等到真提一次任务才暴露。
//
// 这几张表由 tests/platform/mock-job-payload-contract.test.mjs 直接读
// backend/packages/retain-core/src/models/input/*.rs 钉住,漂了就红。
export const JOB_PAYLOAD_TOP_LEVEL_FIELDS = [
    "workflow", "source", "ocr", "translation", "render", "runtime"
];

export const JOB_PAYLOAD_SECTION_FIELDS = {
  source: [
    "artifact_job_id", "source_url", "upload_id"
  ],
  ocr: [
    "cache_tolerance", "credential_ref", "data_id", "disable_formula", "disable_table",
    "extra_formats", "is_ocr", "language", "mineru_token", "model_version", "no_cache",
    "options", "paddle_api_url", "paddle_model", "paddle_token", "page_ranges",
    "poll_interval", "poll_timeout", "provider"
  ],
  translation: [
    "accepted_ambiguous_request_risk", "api_key", "base_url", "batch_size",
    "classify_batch_size", "context_mode", "credential_ref", "custom_rules_text", "end_page",
    "execution_connection", "glossary_entries", "glossary_id", "glossary_inline_entry_count",
    "glossary_mode", "glossary_name", "glossary_overridden_entry_count",
    "glossary_resource_entry_count", "math_mode", "memory_mode", "mode", "model",
    "page_ranges", "rule_profile_name", "skip_title_translation", "start_page", "workers"
  ],
  render: [
    "body_font_size_factor", "body_leading_factor", "compile_workers", "font_unify_mode",
    "inner_bbox_dense_shrink_x", "inner_bbox_dense_shrink_y", "inner_bbox_shrink_x",
    "inner_bbox_shrink_y", "pdf_compress_dpi", "render_mode", "source_cleanup_strategy",
    "translated_pdf_name", "typst_font_family"
  ],
  runtime: [
    "job_id", "no_output_timeout_seconds", "render_after_translation", "timeout_seconds"
  ],
};

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
