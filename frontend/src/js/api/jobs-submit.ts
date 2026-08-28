import { buildJobsEndpoint, submitJson } from "./http.js";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function assertGroupedJobPayload(payload) {
  if (!isObject(payload)) {
    throw new Error("Gửi thất bại: /api/v1/jobs yêu cầu JSON object request body.");
  }
  if (!payload.workflow || !isObject(payload.source)) {
    throw new Error("Gửi thất bại: /api/v1/jobs phải sử dụng grouped JSON, ít nhất chứa workflow và source.");
  }
  const legacyTopLevelFields = [
    "upload_id",
    "artifact_job_id",
    "mode",
    "model",
    "base_url",
    "api_key",
    "mineru_token",
    "paddle_token",
    "model_version",
    "language",
    "render_mode",
    "skip_title_translation",
    "batch_size",
    "workers",
    "classify_batch_size",
    "compile_workers",
    "rule_profile_name",
    "custom_rules_text",
    "timeout_seconds",
  ];
  const leakedLegacyFields = legacyTopLevelFields.filter((field) => field in payload);
  if (leakedLegacyFields.length > 0) {
    throw new Error(
      `Gửi thất bại: /api/v1/jobs không còn chấp nhận các trường phẳng cũ, phát hiện ${leakedLegacyFields.join(", ")}. Vui lòng đổi sang cấu trúc nhóm source/ocr/translation/render/runtime.`,
    );
  }
}

export async function submitJobRequest(apiPrefix, payload) {
  assertGroupedJobPayload(payload);
  return submitJson(buildJobsEndpoint(apiPrefix, "jobs"), payload);
}
