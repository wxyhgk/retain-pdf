// 职责 2b：job 权威载荷与轻量 job status 轮询。
// 约束（与拆分前一致）：
// - 每秒轮询只调 loadJobPayload，绝不下载 PDF；
// - 首次观察到 succeeded 只刷新一次最终产物（terminalArtifactRefreshRef fencing）；
// - 旧 session / 已关闭的请求不能写入新 session（epoch + closing + jobId 三重检查）；
// - 瞬时状态错误不得替换可用的 Reader 快照。

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultReaderDataPort } from "../../external.js";
import { normalizeJobStatus, TERMINAL_JOB_STATUSES } from "./session-helpers.js";

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

export function useJobStatusPolling(options: {
  sessionJobId: string;
  /** render 域的 session 身份，用于 scoped 载荷判定（必须用值而非 ref，避免跨 hook 赋值顺序引入的单帧 stale）。 */
  sessionIdentity: string;
  sessionIdentityRef: React.MutableRefObject<string>;
  sessionJobIdRef: React.MutableRefObject<string>;
  sessionEpochRef: React.MutableRefObject<{ identity: string; value: number }>;
  closingRef: React.MutableRefObject<boolean>;
}): JobStatusPolling {
  const {
    sessionJobId,
    sessionIdentity,
    sessionIdentityRef,
    sessionJobIdRef,
    sessionEpochRef,
    closingRef,
  } = options;
  const [jobPayload, setJobPayload] = useState<Record<string, unknown> | null>(null);
  const [manifestPayload, setManifestPayload] = useState<Record<string, unknown> | null>(null);
  const [payloadSessionIdentity, setPayloadSessionIdentity] = useState("");
  const [jobRefreshRevision, setJobRefreshRevision] = useState(0);

  const scopedJobPayload = payloadSessionIdentity === sessionIdentity ? jobPayload : null;
  const scopedManifestPayload = payloadSessionIdentity === sessionIdentity ? manifestPayload : null;
  const jobStatus = normalizeJobStatus(scopedJobPayload);
  const jobTerminal = TERMINAL_JOB_STATUSES.has(jobStatus);

  const refreshJobArtifacts = useCallback(() => {
    setJobRefreshRevision((revision) => revision + 1);
  }, []);

  const publishPayload = useCallback((input: {
    jobPayload: Record<string, unknown> | null;
    manifestPayload: Record<string, unknown> | null;
    sessionIdentity: string;
  }) => {
    setJobPayload(input.jobPayload);
    setManifestPayload(input.manifestPayload);
    setPayloadSessionIdentity(input.sessionIdentity);
  }, []);

  const clearPayload = useCallback((sessionIdentity: string) => {
    setJobPayload(null);
    setManifestPayload(null);
    setPayloadSessionIdentity(sessionIdentity);
  }, []);

  const statusRefreshInFlightRef = useRef("");
  const terminalArtifactRefreshRef = useRef("");
  const refreshJobStatus = useCallback(async () => {
    const targetJobId = sessionJobIdRef.current;
    if (!targetJobId || statusRefreshInFlightRef.current === targetJobId) return;
    const loadJobPayload = defaultReaderDataPort.loadJobPayload;
    if (typeof loadJobPayload !== "function") return;
    const sessionEpoch = sessionEpochRef.current.value;
    statusRefreshInFlightRef.current = targetJobId;
    try {
      const nextPayload = await loadJobPayload(targetJobId);
      if (
        closingRef.current
        || sessionEpochRef.current.value !== sessionEpoch
        || sessionJobIdRef.current !== targetJobId
        || !nextPayload
        || typeof nextPayload !== "object"
      ) {
        return;
      }
      const nextStatus = normalizeJobStatus(nextPayload);
      setJobPayload(nextPayload as Record<string, unknown>);
      setPayloadSessionIdentity(sessionIdentityRef.current);
      if (
        nextStatus === "succeeded"
        && terminalArtifactRefreshRef.current !== targetJobId
      ) {
        terminalArtifactRefreshRef.current = targetJobId;
        setJobRefreshRevision((revision) => revision + 1);
      }
    } catch {
      // A transient status error must not replace a usable Reader snapshot.
    } finally {
      if (statusRefreshInFlightRef.current === targetJobId) {
        statusRefreshInFlightRef.current = "";
      }
    }
  }, []);

  useEffect(() => {
    if (!sessionJobId || jobTerminal || !scopedJobPayload) return;
    const timer = window.setInterval(() => {
      void refreshJobStatus();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [jobTerminal, refreshJobStatus, scopedJobPayload, sessionJobId]);

  return {
    jobPayload,
    setJobPayload,
    manifestPayload,
    setManifestPayload,
    payloadSessionIdentity,
    setPayloadSessionIdentity,
    scopedJobPayload,
    scopedManifestPayload,
    jobStatus,
    jobTerminal,
    jobRefreshRevision,
    refreshJobArtifacts,
    refreshJobStatus,
    publishPayload,
    clearPayload,
  };
}
