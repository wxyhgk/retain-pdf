export declare const STATUS_STAGE_FLOW: readonly string[];
export declare const STATUS_STAGE_LABELS: Readonly<{
    ocr: "OCR";
    translate: "翻译";
    render: "渲染";
    done: "完成";
}>;
export declare function isStatusStageKey(stageKey?: string): boolean;
export declare function statusStageLabel(stageKey?: string, fallback?: string): any;
export declare function statusStageIndex(stageKey?: string): number;
export declare function isSelectableStatusStage(stageKey?: string, currentStageKey?: string): boolean;
export declare function resolveSelectedStatusStage({ currentStageKey, selectedStageKey, manualStageSelection, }?: any): {
    selectedStageKey: string;
    manualStageSelection: boolean;
};
export declare function effectiveStatusFlowStageKey(snapshot?: any): string;
