export declare function translationSubstageKeyForSnapshot(snapshot?: any): string;
export declare function substageKeyForSnapshot(snapshot?: any): string;
export declare function collectVisibleSubstages(stageKey: any, activeKey: any, selectedProgress?: any): {
    key: string;
    label: string;
}[];
export declare function buildSubstageViewModel({ selectedStageKey, selectedIsCurrent, snapshot, selectedProgress, }?: any): {
    activeKey: any;
    count: number;
    hidden: boolean;
    cssCount: number;
    items: {
        key: string;
        label: any;
        active: boolean;
        done: boolean;
    }[];
};
