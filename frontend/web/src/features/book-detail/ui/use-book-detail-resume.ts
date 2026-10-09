// 失败 / 取消的翻译任务：读续跑计划，提供「从断点继续」。
//
// 计划只在任务停在失败 / 取消时读一次（换任务、任务状态变化时重读），不跟 2 秒的列表轮询。
// 续跑提交成功后把新任务交给 onJobSubmitted，详情页立刻跟上；失败把原因写进 error，
// 由失败卡片就地显示（以前「重试」出错时，提示落在看不见的地方）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchResumePlan as fetchResumePlanRequest,
  resumeJob as resumeJobRequest,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import type { DocumentJobSummary } from "@/features/library/domain.js";
import type { JobResumePlan } from "../domain/job-resume-model.js";
import { submittedJobFromResume, type ResumeReceipt } from "./resume-receipt.js";

const RESUMABLE_STATUSES: readonly string[] = ["failed", "error", "timeout", "dead", "cancelled", "canceled"];

export function isResumableJob(job?: DocumentJobSummary | null): boolean {
  return RESUMABLE_STATUSES.includes(`${job?.status || ""}`.trim().toLowerCase());
}

function jobIdOf(job?: DocumentJobSummary | null): string {
  const id = `${job?.job_id || job?.id || ""}`.trim();
  return id.startsWith("doc:") ? "" : id;
}

export type BookDetailResumeState = {
  plan: JobResumePlan | null;
  loading: boolean;
  pending: boolean;
  error: string;
  resume: () => Promise<unknown>;
};

export function useBookDetailResume({
  open,
  job,
  onJobSubmitted,
  // 必须带接口前缀：不带时请求打到 /jobs/:id/...（少了 /api/v1），一律 404。
  fetchResumePlan = (jobId: string) => fetchResumePlanRequest(jobId, API_PREFIX),
  resumeJob = (jobId: string) => resumeJobRequest(jobId, API_PREFIX),
}: {
  open: boolean;
  job?: DocumentJobSummary | null;
  onJobSubmitted?: (job: Partial<DocumentJobSummary>) => unknown;
  /** 测试替身用；默认走平台接口（演示模式下自动走 mock）。 */
  fetchResumePlan?: (jobId: string) => Promise<unknown>;
  resumeJob?: (jobId: string) => Promise<unknown>;
}): BookDetailResumeState {
  const jobId = jobIdOf(job);
  const status = `${job?.status || ""}`.trim().toLowerCase();
  const eligible = Boolean(open && jobId && isResumableJob(job));
  const [plan, setPlan] = useState<JobResumePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    setPlan(null);
    setError("");
    if (!eligible) {
      setLoading(false);
      return undefined;
    }
    const request = ++requestRef.current;
    setLoading(true);
    fetchResumePlan(jobId)
      .then((result) => {
        if (request !== requestRef.current) return;
        setPlan(result && typeof result === "object" ? result as JobResumePlan : null);
      })
      .catch(() => {
        // 读不到计划不挡路：卡片退回「重新处理」，不显示续跑按钮。
        if (request === requestRef.current) setPlan(null);
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
    return () => {
      requestRef.current += 1;
    };
    // 计划只随任务和它的状态变，不随父组件每次渲染新建的函数引用变。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, jobId, status]);

  const resume = useCallback(async () => {
    if (!jobId || pending) return null;
    setPending(true);
    setError("");
    try {
      const receipt = await resumeJob(jobId) as ResumeReceipt | null;
      if (receipt) {
        onJobSubmitted?.(submittedJobFromResume(receipt, job, {
          fallbackWorkflow: `${plan?.from_stage || ""}` === "render" ? "render" : "book",
        }));
      }
      return receipt;
    } catch (cause) {
      setError(`${(cause as Error)?.message || cause || "提交失败，请稍后再试。"}`);
      return null;
    } finally {
      setPending(false);
    }
  }, [job, jobId, onJobSubmitted, pending, plan, resumeJob]);

  return { plan, loading, pending, error, resume };
}
