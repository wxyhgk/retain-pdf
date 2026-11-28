import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import { type ReaderMetadata, type ReaderRegion } from "../../shared/data/reader-regions.js";
import type { CommittedDocumentSource, ReaderMode, ReaderOptionalArtifactErrors, ReaderSessionState } from "./types.js";
import type { SessionIdentityEvent } from "./job-identity.js";
import { type TranslatedLayout } from "./translated-layout.js";
export type SessionAssets = {
    sourceUrl: string;
    translatedUrl: string;
    sourceFile: ProtectedPdfFile | null;
    translatedFile: ProtectedPdfFile | null;
    /** 译文栏用 HTML 画（原文 PDF + 排版引擎的版面）：版面完整时有，这时没下载译文 PDF（translatedFile 是 null，translatedUrl 照旧给下载用）。 */
    translatedLayout: TranslatedLayout | null;
    assetsReady: boolean;
    title: string;
    regions: ReaderRegion[];
    regionsSettled: boolean;
    readerMetadata: ReaderMetadata;
    readerErrors: ReaderOptionalArtifactErrors;
    boot: ReaderSessionState["boot"];
};
export type SessionAssetCommands = {
    applyIdentityEvent: (event: SessionIdentityEvent) => void;
    publishPayload: (input: {
        jobPayload: Record<string, unknown> | null;
        manifestPayload: Record<string, unknown> | null;
        sessionIdentity: string;
    }) => void;
    clearPayload: (sessionIdentity: string) => void;
    switchSessionMode: (mode: ReaderMode) => void;
};
export declare function useSessionAssets(options: {
    sessionJobId: string;
    jobId: string;
    routeDocumentId: string;
    documentJobId: string;
    rejectedDocumentJobId: string;
    sourceOnly: boolean;
    locationKey: string;
    sessionIdentity: string;
    committedSource: CommittedDocumentSource | null;
    applyIdentityEvent: SessionAssetCommands["applyIdentityEvent"];
    publishPayload: SessionAssetCommands["publishPayload"];
    clearPayload: SessionAssetCommands["clearPayload"];
    switchSessionMode: SessionAssetCommands["switchSessionMode"];
    jobRefreshRevision: number;
    sessionEpochRef: React.MutableRefObject<{
        identity: string;
        value: number;
    }>;
    closingRef: React.MutableRefObject<boolean>;
    activeLoadAbortRef: React.MutableRefObject<AbortController | null>;
}): SessionAssets;
//# sourceMappingURL=session-assets.d.ts.map