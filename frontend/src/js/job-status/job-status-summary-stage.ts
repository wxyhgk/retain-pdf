import {
  canonicalStageOf,
  hasCanonicalEventContract,
} from "./job-stage-presentation-utils.js";
import {
  substageDetail,
  substageLabel,
} from "./job-stage-substage-contract.js";
import {
  stageSubtypeOfPayload,
} from "./job-stage-substage-adapter.js";
import { firstNonEmpty } from "./job-status-summary-helpers.js";
import {
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
} from "./job-status-summary-stage-constants.js";
import { isJobTerminal } from "../job/core.js";

function publicStageKeyOf(payload) {
  const canonicalStage = canonicalStageOf(payload);
  if (canonicalStage) {
    return canonicalStage;
  }
  return "";
}

function stageKeyOf(payload) {
  const publicStageKey = publicStageKeyOf(payload);
  if (publicStageKey) {
    return publicStageKey;
  }
  if (hasCanonicalEventContract(payload)) {
    return "";
  }
  return "";
}

function stageSubtypeOf(payload) {
  return stageSubtypeOfPayload(payload);
}

function stageFlowForKey(stageKey) {
  return USER_STAGE_FLOW.find((stage) => stage.key === stageKey) || null;
}

function normalizedStageText(payload) {
  const stageKey = stageKeyOf(payload);
  const substage = firstNonEmpty(payload.substage, payload.payload?.substage);
  return `${stageKey} ${substage}`.toLowerCase();
}

function detailForPayload(payload, fallback) {
  const subtype = stageSubtypeOf(payload);
  const detail = subtype ? substageDetail(subtype) : "";
  if (detail) {
    return detail;
  }
  return fallback;
}

function userStageFor(payload) {
  const stageKey = stageKeyOf(payload);
  if (payload.status === "succeeded" && isJobTerminal(payload)) {
    return {
      key: "done",
      label: "Hoàn thành",
      detail: "PDF dịch đã tạo",
      step: USER_STAGE_TOTAL,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "failed") {
    return {
      key: "failed",
      label: "Thất bại",
      detail: "Nhiệm vụ thất bại, vui lòng xem chi tiết",
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "canceled") {
    return {
      key: "canceled",
      label: "Đã hủy",
      detail: "Nhiệm vụ đã hủy",
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  if (
    (payload.status === "queued"
      || stageKey === "queued")
    && !["ocr", "translate", "render"].includes(stageKey)
  ) {
    return {
      key: "queued",
      label: "Đang chờ",
      detail: detailForPayload(payload, "Đang chờ slot thực thi"),
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  const directStage = stageFlowForKey(stageKey);
  if (directStage) {
    const matchIndex = USER_STAGE_FLOW.findIndex((stage) => stage.key === directStage.key);
    return {
      ...directStage,
      detail: detailForPayload(payload, directStage.detail),
      step: matchIndex + 1,
      total: USER_STAGE_TOTAL,
    };
  }
  if (payload.status === "running") {
    return {
      key: "running",
      label: "Đang xử lý",
      detail: detailForPayload(payload, "Đang xử lý nhiệm vụ"),
      step: null,
      total: USER_STAGE_TOTAL,
    };
  }
  return {
    key: "idle",
    label: "Đang chờ",
    detail: "Đang chờ nhiệm vụ bắt đầu",
    step: null,
    total: USER_STAGE_TOTAL,
  };
}

function userStageLabel(payload) {
  const stage = userStageFor(payload);
  if (stage.step && stage.total && !isJobTerminal(payload)) {
    const subtype = stageSubtypeOf(payload);
    const subtypeLabel = substageLabel(subtype) || stage.label;
    return `Bước ${stage.step}/${stage.total} · ${subtypeLabel}`;
  }
  return stage.label;
}

export {
  USER_STAGE_FLOW,
  USER_STAGE_TOTAL,
  detailForPayload,
  normalizedStageText,
  publicStageKeyOf,
  stageFlowForKey,
  stageKeyOf,
  stageSubtypeOf,
  userStageFor,
  userStageLabel,
};
