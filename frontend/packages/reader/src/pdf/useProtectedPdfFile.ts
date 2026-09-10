// 把需鉴权 / mock:// 的 PDF URL 拉成 react-pdf 可用的 { data: Uint8Array }。
// 会话层会先整文件下载完成再展示；本 hook 也可独立使用。

import { useEffect, useState } from "react";
import { fetchProtected } from "../external.js";

export type ProtectedPdfFile = { data: Uint8Array };

/**
 * PDF.js 会把传入的 ArrayBuffer 转移给 Worker，原 buffer 随后会 detached。
 * 缓存/会话持有的原始字节不能直接交给 Document，否则分栏切换导致重挂载时
 * 无法再次解析。每个 Document 实例只消费自己的副本。
 */
export function cloneProtectedPdfFileForWorker(
  file: ProtectedPdfFile | null,
): ProtectedPdfFile | null {
  return file ? { data: file.data.slice() } : null;
}

export type ProtectedPdfState = {
  file: ProtectedPdfFile | null;
  loading: boolean;
  error: string;
};

const MAX_FILE_CACHE = 2;
const fileCache = new Map<string, ProtectedPdfFile>();

function touchFileCache(key: string, value: ProtectedPdfFile): void {
  fileCache.delete(key);
  fileCache.set(key, value);
}

function evictIfNeeded(excludeKey?: string): void {
  if (fileCache.size < MAX_FILE_CACHE) return;
  if (excludeKey && fileCache.has(excludeKey)) return;
  const oldest = fileCache.keys().next().value as string | undefined;
  if (oldest) fileCache.delete(oldest);
}

export function getCachedProtectedPdf(url: string): ProtectedPdfFile | null {
  const key = `${url || ""}`.trim();
  if (!key || !fileCache.has(key)) return null;
  const hit = fileCache.get(key)!;
  // LRU: move to end
  touchFileCache(key, hit);
  return hit;
}

export function setCachedProtectedPdf(url: string, file: ProtectedPdfFile) {
  const key = `${url || ""}`.trim();
  if (!key) return;
  if (fileCache.has(key)) {
    touchFileCache(key, file);
    return;
  }
  evictIfNeeded();
  fileCache.set(key, file);
}

export async function loadProtectedPdfFile(
  url: string,
  fetchResource: typeof fetchProtected = fetchProtected,
  options: { signal?: AbortSignal } = {},
): Promise<ProtectedPdfFile | null> {
  const normalized = `${url || ""}`.trim();
  if (!normalized) {
    return null;
  }
  if (fileCache.has(normalized)) {
    const cached = fileCache.get(normalized)!;
    touchFileCache(normalized, cached);
    return cached;
  }
  const response = await fetchResource(normalized, { signal: options.signal } as RequestInit);
  if (!response.ok) {
    const err = new Error(`读取 PDF 失败 (${response.status})`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  const buffer = await response.arrayBuffer();
  const file = { data: new Uint8Array(buffer) };
  if (fileCache.has(normalized)) {
    touchFileCache(normalized, file);
  } else {
    evictIfNeeded();
    fileCache.set(normalized, file);
  }
  return file;
}

/** 并行下载多份 PDF，全部完成才 resolve；onItem 用于进度文案 */
export async function loadProtectedPdfFiles(
  urls: string[],
  {
    fetchResource = fetchProtected,
    onItem,
  }: {
    fetchResource?: typeof fetchProtected;
    onItem?: (info: { index: number; total: number; url: string }) => void;
  } = {},
): Promise<(ProtectedPdfFile | null)[]> {
  const list = urls.map((u) => `${u || ""}`.trim());
  const total = list.filter(Boolean).length || 1;
  let done = 0;
  return Promise.all(
    list.map(async (url, index) => {
      if (!url) {
        return null;
      }
      onItem?.({ index, total, url });
      const file = await loadProtectedPdfFile(url, fetchResource);
      done += 1;
      onItem?.({ index: done - 1, total, url });
      return file;
    }),
  );
}

export function useProtectedPdfFile(
  url = "",
  /** 会话已预下载时直接注入，跳过二次请求 */
  preloaded: ProtectedPdfFile | null = null,
): ProtectedPdfState {
  const [file, setFile] = useState<ProtectedPdfFile | null>(
    () => preloaded || getCachedProtectedPdf(url),
  );
  const [loading, setLoading] = useState(
    () => Boolean(`${url || ""}`.trim()) && !preloaded && !getCachedProtectedPdf(url),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (preloaded) {
      setFile(preloaded);
      setLoading(false);
      setError("");
      return;
    }
    const normalized = `${url || ""}`.trim();
    if (!normalized) {
      setFile(null);
      setLoading(false);
      setError("");
      return;
    }
    const cached = getCachedProtectedPdf(normalized);
    if (cached) {
      setFile(cached);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setFile(null);

    loadProtectedPdfFile(normalized)
      .then((next) => {
        if (!cancelled) {
          setFile(next);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFile(null);
          setLoading(false);
          setError(err?.message || String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, preloaded]);

  return { file, loading, error };
}
