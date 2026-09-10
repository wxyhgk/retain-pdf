export declare const HOME_RETURN_STORAGE_KEY = "retainpdf.home.return.v1";
export type HomeReturnState = {
    allowBack: boolean;
    activeTab: "library" | "categories" | "favorites" | "ask" | string;
    libraryScrollTop: number;
    panelScrollTop: number;
    windowScrollY: number;
    ts: number;
};
export declare function captureHomeReturnState(options?: {
    allowBack?: boolean;
}): void;
export declare function peekHomeReturnState(): HomeReturnState | null;
export declare function consumeHomeReturnState(): HomeReturnState | null;
export declare function clearHomeReturnState(): void;
export declare function applyHomeReturnScroll(state: HomeReturnState): void;
//# sourceMappingURL=home-return-state.d.ts.map