export type JobStatusPolling = {
    jobPayload: Record<string, unknown> | null;
    setJobPayload: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
    manifestPayload: Record<string, unknown> | null;
    setManifestPayload: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
    payloadSessionIdentity: string;
    setPayloadSessionIdentity: React.Dispatch<React.SetStateAction<string>>;
    scopedJobPayload: Record<string, unknown> | null;
    scopedManifestPayload: Record<string, unknown> | null;
    jobStatus: string;
    jobTerminal: boolean;
    jobRefreshRevision: number;
    refreshJobArtifacts: () => void;
    refreshJobStatus: () => Promise<void>;
    /**
     * 窄命令：session-assets 发布/清空权威载荷时一次写完
     * job + manifest + sessionIdentity，不直接拿三个 setter。
     */
    publishPayload: (input: {
        jobPayload: Record<string, unknown> | null;
        manifestPayload: Record<string, unknown> | null;
        sessionIdentity: string;
    }) => void;
    clearPayload: (sessionIdentity: string) => void;
};
export declare function useJobStatusPolling(options: {
    sessionJobId: string;
    /** render 域的 session 身份，用于 scoped 载荷判定（必须用值而非 ref，避免跨 hook 赋值顺序引入的单帧 stale）。 */
    sessionIdentity: string;
    sessionIdentityRef: React.MutableRefObject<string>;
    sessionJobIdRef: React.MutableRefObject<string>;
    sessionEpochRef: React.MutableRefObject<{
        identity: string;
        value: number;
    }>;
    closingRef: React.MutableRefObject<boolean>;
}): JobStatusPolling;
//# sourceMappingURL=job-status.d.ts.map