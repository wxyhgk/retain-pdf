import type { ReaderAiChatSession, ReaderAiSessionSummary, ReaderAiSessionsBag } from "../types/types.js";
export declare const MAX_SESSIONS = 20;
export declare function deriveSessionTitle(session?: ReaderAiChatSession): string;
export declare function summarizeSessions({ sessions, activeId, }?: ReaderAiSessionsBag): ReaderAiSessionSummary[];
export declare function trimSessions({ sessions, activeId }?: ReaderAiSessionsBag, max?: number): ReaderAiChatSession[];
//# sourceMappingURL=chat-sessions-view-model.d.ts.map