// 这本书的译文版本：读列表（连隐藏的，管理里要能恢复），切换、改名、隐藏。
// 跟 useTranslationCoverage 一样，任务列表读回来再取，之后任务状态一变（翻完一份新译文）就重取。
// 切换用 PUT 记住用户的选择：之后「阅读」照旧问 /reading，后端按书的当前版本拼，阅读入口不用改。
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchTranslationVersions,
  patchTranslationVersion,
  setCurrentTranslationVersion,
  type TranslationVersionsView,
} from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";

export type TranslationVersionsApi = {
  list: (documentId: string) => Promise<TranslationVersionsView>;
  select: (documentId: string, versionId: string | null) => Promise<TranslationVersionsView>;
  patch: (documentId: string, versionId: string, payload: { label?: string; hidden?: boolean }) => Promise<TranslationVersionsView>;
};

export const translationVersionsFromApi: TranslationVersionsApi = {
  list: (documentId) => fetchTranslationVersions(API_PREFIX, documentId, { includeHidden: true }),
  select: (documentId, versionId) => setCurrentTranslationVersion(API_PREFIX, documentId, versionId),
  patch: (documentId, versionId, payload) => patchTranslationVersion(API_PREFIX, documentId, versionId, payload),
};

function errorText(err: unknown, fallback: string): string {
  return (err as { message?: string } | null)?.message || fallback;
}

export function useTranslationVersions({
  open,
  documentId,
  jobs,
  ready = true,
  api = translationVersionsFromApi,
}: {
  open: boolean;
  documentId: string;
  jobs: Array<{ job_id?: string; id?: string; status?: string }>;
  ready?: boolean;
  api?: TranslationVersionsApi;
}) {
  const [loaded, setLoaded] = useState<{ documentId: string; view: TranslationVersionsView } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const jobsKey = useMemo(
    () => jobs.map((job) => `${job.job_id || job.id || ""}:${job.status || ""}`).sort().join("|"),
    [jobs],
  );
  const id = `${documentId || ""}`.trim();

  useEffect(() => {
    setError("");
    if (!open || !id) {
      setLoaded(null);
      return undefined;
    }
    if (!ready) return undefined;
    let cancelled = false;
    api.list(id)
      .then((view) => { if (!cancelled) setLoaded({ documentId: id, view }); })
      // 读失败只是不显示版本卡，不打断详情页。
      .catch(() => {});
    return () => { cancelled = true; };
    // api 默认值不变，测试注入的也不变；按书和任务状态重读。
  }, [open, id, ready, jobsKey]);

  const run = useCallback(async (action: () => Promise<TranslationVersionsView>, fallback: string) => {
    if (!id) return false;
    setBusy(true);
    setError("");
    try {
      await action();
      // PUT / PATCH 回的列表不带隐藏的版本；管理里要列出来才能恢复，再读一次全的。
      const view = await api.list(id);
      setLoaded({ documentId: id, view });
      return true;
    } catch (err) {
      setError(errorText(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }, [id, api]);

  return {
    view: loaded?.documentId === id ? loaded.view : null,
    busy,
    error,
    select: (versionId: string | null) => run(() => api.select(id, versionId), "切换译文版本失败。"),
    rename: (versionId: string, label: string) => run(() => api.patch(id, versionId, { label }), "改名失败。"),
    setHidden: (versionId: string, hidden: boolean) => run(() => api.patch(id, versionId, { hidden }), hidden ? "隐藏失败。" : "恢复失败。"),
  };
}
