import { canonicalStageOf, hasCanonicalEventContract, } from "../presentation/job-stage-presentation-utils.js";
import { substageDetail, substageLabel, } from "../contract/job-stage-substage-contract.js";
import { stageSubtypeOfPayload, } from "../contract/job-stage-substage-adapter.js";
import { firstNonEmpty } from "./job-status-summary-helpers.js";
import { USER_STAGE_FLOW, USER_STAGE_TOTAL, } from "./job-status-summary-stage-constants.js";
import { isJobTerminal } from "../../job/core.js";
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
function successDetailForWorkflow(payload) {
    const workflow = `${payload?.workflow || ""}`.trim().toLowerCase();
    return workflow === "ocr"
        ? "OCR/文档解析已完成"
        : "翻译 PDF 已生成";
}
function userStageFor(payload) {
    const stageKey = stageKeyOf(payload);
    if (payload.status === "succeeded" && isJobTerminal(payload)) {
        return {
            key: "done",
            label: "完成",
            detail: successDetailForWorkflow(payload),
            step: USER_STAGE_TOTAL,
            total: USER_STAGE_TOTAL,
        };
    }
    if (payload.status === "failed") {
        return {
            key: "failed",
            label: "失败",
            detail: "任务失败，请查看详情",
            step: null,
            total: USER_STAGE_TOTAL,
        };
    }
    if (payload.status === "canceled") {
        return {
            key: "canceled",
            label: "已取消",
            detail: "任务已取消",
            step: null,
            total: USER_STAGE_TOTAL,
        };
    }
    if ((payload.status === "queued"
        || stageKey === "queued")
        && !["ocr", "translate", "render"].includes(stageKey)) {
        return {
            key: "queued",
            label: "排队中",
            detail: detailForPayload(payload, "等待可用执行槽位"),
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
            label: "处理中",
            detail: detailForPayload(payload, "正在处理任务"),
            step: null,
            total: USER_STAGE_TOTAL,
        };
    }
    return {
        key: "idle",
        label: "等待中",
        detail: "等待任务开始",
        step: null,
        total: USER_STAGE_TOTAL,
    };
}
function userStageLabel(payload) {
    const stage = userStageFor(payload);
    if (stage.step && stage.total && !isJobTerminal(payload)) {
        const subtype = stageSubtypeOf(payload);
        const subtypeLabel = substageLabel(subtype) || stage.label;
        return `第 ${stage.step}/${stage.total} 步 · ${subtypeLabel}`;
    }
    return stage.label;
}
export { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, normalizedStageText, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, userStageFor, userStageLabel, };
