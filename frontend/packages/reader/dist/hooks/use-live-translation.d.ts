import { type LiveTranslationState } from "../shared/data/live-translation-state.js";
export type UseLiveTranslationOptions = {
    jobId: string;
    /** Authoritative status owned and refreshed by the Reader session. */
    jobStatus: string;
    enabled: boolean;
};
export declare function useLiveTranslation({ jobId, jobStatus, enabled, }: UseLiveTranslationOptions): LiveTranslationState;
//# sourceMappingURL=use-live-translation.d.ts.map