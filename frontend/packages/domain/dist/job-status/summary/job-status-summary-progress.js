import { looksLikeProviderPercentProgress, } from "./job-status-summary-helpers.js";
import { stageKeyOf, stageSubtypeOf, userStageFor } from "./job-status-summary-stage.js";
import { publicProgressOf, } from "../progress/job-stage-progress-adapter.js";
export function summarizeStageProgressText(payload) {
    const progress = publicProgressOf(payload);
    const stage = userStageFor(payload);
    return progressTextForStageProgress({
        stageKey: stageKeyOf(payload),
        substageKey: stageSubtypeOf(payload),
        stage,
        progress,
    });
}
export function progressTextForStageProgress({ stageKey = "", substageKey = "", stage = null, progress = {}, } = {}) {
    const current = progress.current;
    const total = progress.total;
    if (current === null || total === null || total <= 0) {
        return "";
    }
    const subtype = substageKey;
    const stageInfo = stage || { key: stageKey };
    const progressUnit = progress.unit || "";
    if (progressUnit === "percent") {
        return current > 0 ? `进度 ${current}%` : "处理中";
    }
    if (stageInfo.key === "render" && subtype === "render_compile") {
        return current >= total ? "渲染完成" : "正在编译 PDF";
    }
    if (stageInfo.key === "render" && subtype === "render_prewarm") {
        return `预热 ${current}/${total}`;
    }
    if (stageInfo.key === "render" && subtype === "render_prepare") {
        return `准备 ${current}/${total}`;
    }
    if (progressUnit === "page") {
        if (stageInfo.key === "ocr" && current <= 0) {
            return `OCR 处理中，共 ${total} 页`;
        }
        if (stageInfo.key === "render" && current <= 0) {
            return `正在渲染，共 ${total} 页`;
        }
        if (stageInfo.key === "render" && current >= total) {
            return `渲染完成，共 ${total} 页`;
        }
        return `第 ${current}/${total} 页`;
    }
    if (progressUnit === "batch") {
        return `第 ${current}/${total} 批`;
    }
    if (progressUnit === "step") {
        if (stageInfo.key === "render") {
            return `准备 ${current}/${total}`;
        }
        return `进度 ${current}/${total}`;
    }
    if (subtype === "continuation_review" || subtype === "page_policies") {
        return `第 ${current}/${total} 页`;
    }
    if (subtype === "domain_inference" || subtype === "translation_prepare") {
        return `进度 ${current}/${total}`;
    }
    if (stageInfo.key === "translate") {
        return `第 ${current}/${total} 批`;
    }
    if (stageInfo.key === "ocr") {
        if (looksLikeProviderPercentProgress(current, total)) {
            return current > 0 ? `OCR ${current}%` : "OCR 处理中";
        }
        return `第 ${current}/${total} 页`;
    }
    if (stageInfo.key === "render") {
        return `第 ${current}/${total} 页`;
    }
    return `进度 ${current}/${total}`;
}
