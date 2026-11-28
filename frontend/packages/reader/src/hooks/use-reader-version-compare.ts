// 顶栏「对比版本」：对照阅读的左栏换成这本书另一份译文，和右边正在读的这份逐段对着看，挑出好的那份。
//
// 几份译文都是用同一份 OCR 结果翻的，块编号、块的位置一样：左栏拿那一份的 regions，悬停时两栏框的是同一段。
// 左栏走「原文栏」那一路（PdfDocumentPane pane="source"），所以把那一份的译文放进 regions 的 source 里：
// 悬停复制、搜索标记读的都是那一份的译文。
// 「用这一份」= 设成这本书阅读用的版本（PUT translation-version），再把地址里的 job_id 换成那一份的任务，
// 阅读页按地址重新载入（route-identity 监听 replaceState）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ReaderTranslationVersionsPort, ReaderVersionOption } from "../contracts/session.js";
import { readerSessionDataPort } from "../external.js";
import { normalizeReaderRegions, type ReaderRegion } from "../shared/data/reader-regions.js";

export type ComparedVersion = {
  versionId: string;
  name: string;
  jobId: string;
  url: string;
  /** 那一份的块，source 换成了那一份的译文（左栏当原文栏用）。 */
  regions: ReaderRegion[];
};

export type VersionCompare = {
  /** 能对比：宿主给了端口，这本书至少两份译文。 */
  available: boolean;
  versions: ReaderVersionOption[];
  /** 右边正在读的那一份（任务落在哪一份；找不到用书的当前版本）。 */
  readingVersionId: string;
  compared: ComparedVersion | null;
  /** 正在载入哪一份（版本 id），没在载是空串。 */
  loading: string;
  error: string;
  choose: (versionId: string) => void;
  clear: () => void;
  /** 「用这一份」。 */
  adopt: () => Promise<void>;
};

function versionsPort(): ReaderTranslationVersionsPort | null {
  try {
    return readerSessionDataPort().translationVersions ?? null;
  } catch {
    return null;
  }
}

/** 左栏当原文栏用：source 换成那一份的译文（位置一样，只换字）。 */
export function asComparePaneRegions(regions: readonly ReaderRegion[]): ReaderRegion[] {
  return regions.map((region) => ({ ...region, source: { ...region.translated } }));
}

/** 正在读的任务在哪一份里；找不到（合并出来的虚拟任务）用书的当前版本。 */
export function readingVersionOf(versions: readonly ReaderVersionOption[], jobId: string, currentVersionId: string | null): string {
  return versions.find((version) => version.jobIds.includes(jobId))?.versionId || currentVersionId || "";
}

/** 把地址里的 job_id 换掉（保留读到的页），阅读页按地址重新载入。 */
export function readerUrlWithJob(href: string, jobId: string): string {
  const url = new URL(href);
  url.searchParams.set("job_id", jobId);
  url.searchParams.delete("block_id");
  return `${url.pathname}${url.search}${url.hash}`;
}

export type ReaderTranslationVersions = {
  versions: ReaderVersionOption[];
  /** 正在读的那一份（任务落在哪一份；找不到用书的当前版本）；没有是空串。 */
  readingVersionId: string;
};

/** 这本书的几份译文和正在读哪一份：阅读页自己的（提问要记读的是哪份、对比版本要列出来），2026-11-27 从对比版本里拆出。 */
export function useReaderTranslationVersions({ documentId, jobId }: { documentId: string; jobId: string }): ReaderTranslationVersions {
  const [versions, setVersions] = useState<ReaderVersionOption[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

  useEffect(() => {
    setVersions([]);
    const port = versionsPort();
    if (!port || !documentId) return undefined;
    let disposed = false;
    port.list(documentId)
      .then((view) => {
        if (disposed) return;
        setVersions(view.versions);
        setCurrentVersionId(view.currentVersionId);
      })
      .catch(() => {});
    return () => { disposed = true; };
  }, [documentId, jobId]);

  const readingVersionId = readingVersionOf(versions, jobId, currentVersionId);
  return useMemo(() => ({ versions, readingVersionId }), [versions, readingVersionId]);
}

/** 对比版本（扩展 extensions/builtin/compare）：几份译文和正在读哪份从阅读页来（useReaderTranslationVersions）。 */
export function useReaderVersionCompare({ documentId, jobId, versions, readingVersionId }: { documentId: string; jobId: string } & ReaderTranslationVersions): VersionCompare {
  const [compared, setCompared] = useState<ComparedVersion | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const request = useRef(0);

  // 换书、换任务：丢掉上一本的对比（还在载的那次也作废）。
  useEffect(() => {
    request.current += 1;
    setCompared(null);
    setLoading("");
    setError("");
  }, [documentId, jobId]);

  const choose = useCallback((versionId: string) => {
    const port = versionsPort();
    const option = versions.find((version) => version.versionId === versionId);
    if (!port || !option || !documentId) return;
    const ticket = ++request.current;
    setLoading(versionId);
    setError("");
    (async () => {
      const data = readerSessionDataPort();
      const versionJob = await port.resolveJob(documentId, versionId);
      if (!versionJob) throw new Error("这一份还没有能读的译文。");
      const payload = await data.loadReaderPayload(versionJob, { includeOptionalArtifacts: true });
      const url = data.resolveReaderTranslatedPdfUrl(payload.jobPayload, payload.manifestPayload);
      if (!url) throw new Error("这一份没有译文 PDF。");
      return { versionId, name: option.name, jobId: versionJob, url, regions: asComparePaneRegions(normalizeReaderRegions(payload.regionsPayload)) };
    })()
      .then((next) => { if (ticket === request.current) setCompared(next); })
      .catch((err: unknown) => { if (ticket === request.current) setError((err as Error)?.message || "这一份打不开。"); })
      .finally(() => { if (ticket === request.current) setLoading(""); });
  }, [documentId, versions]);

  const clear = useCallback(() => {
    request.current += 1;
    setCompared(null);
    setLoading("");
    setError("");
  }, []);

  const adopt = useCallback(async () => {
    const port = versionsPort();
    if (!port || !compared || !documentId) return;
    try {
      await port.select(documentId, compared.versionId);
    } catch (err) {
      setError((err as Error)?.message || "换不过去，请稍后再试。");
      return;
    }
    const href = globalThis.location?.href;
    if (href) globalThis.history?.replaceState(globalThis.history.state, "", readerUrlWithJob(href, compared.jobId));
    setCompared(null);
  }, [compared, documentId]);

  // 同一个对象，扩展拿它登记贡献时不会每画一次就换一份。
  return useMemo(() => ({
    available: versions.length >= 2,
    versions,
    readingVersionId,
    compared,
    loading,
    error,
    choose,
    clear,
    adopt,
  }), [versions, readingVersionId, compared, loading, error, choose, clear, adopt]);
}
