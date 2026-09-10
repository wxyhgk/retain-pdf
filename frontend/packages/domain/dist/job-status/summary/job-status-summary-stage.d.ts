import { USER_STAGE_FLOW, USER_STAGE_TOTAL } from "./job-status-summary-stage-constants.js";
declare function publicStageKeyOf(payload: any): string;
declare function stageKeyOf(payload: any): string;
declare function stageSubtypeOf(payload: any): any;
declare function stageFlowForKey(stageKey: any): {
    key: string;
    label: string;
    detail: string;
    matches: string[];
};
declare function normalizedStageText(payload: any): string;
declare function detailForPayload(payload: any, fallback: any): any;
declare function successDetailForWorkflow(payload: any): "OCR/文档解析已完成" | "翻译 PDF 已生成";
declare function userStageFor(payload: any): {
    key: string;
    label: string;
    detail: string;
    step: number;
    total: number;
} | {
    key: string;
    label: string;
    detail: any;
    step: any;
    total: number;
} | {
    key: string;
    label: string;
    matches: string[];
    detail: any;
    step: number;
    total: number;
};
declare function userStageLabel(payload: any): string;
export { USER_STAGE_FLOW, USER_STAGE_TOTAL, detailForPayload, normalizedStageText, publicStageKeyOf, stageFlowForKey, stageKeyOf, stageSubtypeOf, successDetailForWorkflow, userStageFor, userStageLabel, };
