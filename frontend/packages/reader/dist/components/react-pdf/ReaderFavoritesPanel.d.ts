export type ReaderFavoritesPanelProps = {
    open: boolean;
    jobId: string;
    documentId: string;
    onClose: () => void;
    /** 1-based page jump */
    onJumpPage: (page: number) => void;
};
export declare function ReaderFavoritesPanel({ open, jobId, documentId, onClose, onJumpPage, }: ReaderFavoritesPanelProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderFavoritesPanel.d.ts.map