export declare function normalizeSubstageKey(value?: string): any;
export declare function substageDefinitionForKey(key?: string): {
    key: string;
    stageKey: string;
    aliases: string[];
    label: string;
    cardLabel: string;
    detail: string;
    progressRange: number[];
    defaultProgressUnit: string;
} | {
    progressRange?: undefined;
    defaultProgressUnit?: undefined;
    key: string;
    stageKey: string;
    aliases: string[];
    label: string;
    cardLabel: string;
    detail: string;
};
export declare function substageDetail(key?: string): string;
export declare function substageLabel(key?: string): string;
export declare function substageCardLabel(key?: string): string;
export declare function substagesForStage(stageKey?: string): {
    key: string;
    label: string;
}[];
export declare function substageLabelsForStage(stageKey?: string): {
    [k: string]: string;
};
export declare function substageProgressRange(key?: string): number[];
export declare function substageDefaultProgressUnit(key?: string): string;
export declare function visualStageKeyForSubstage(stageKey?: string, substage?: string): any;
