// 把需鉴权 / mock:// 的 PDF URL 拉成 react-pdf 可用的东西：一般的整份下成 { data: Uint8Array }；
// 大文件（RANGED_PDF_MIN_BYTES 以上、服务器认 Range）不整份下，给 { ranged }，pdf.js 要哪段取哪段（pdf-range-transport.ts）。
// 会话层等这一步完成再展示；本 hook 也可独立使用。
//
// 为什么大文件按段取（2026-11-07 实测，本机 40001）：323MB 的书整份下完再交给 pdf.js，本机网络 4.5 秒就传完，
// 但原文、译文两份连同交给 worker 的副本占 1GB 以上；Chromium 第一页 3.8 秒，WebKit（Safari）把几百 MB 的响应体
// 交给页面时主线程卡死，第一页 6 分多钟。小书（10–30MB）整份下只要零点几秒，照旧。

import { useEffect, useState } from "react";
import { readerPdfPort } from "../external.js";

/** 按段取的大 PDF：总长和取一段的办法（[begin, end)，走带鉴权的 fetch）。 */
export type RangedPdfSource = {
  url: string;
  length: number;
  fetchRange: (begin: number, end: number) => Promise<Uint8Array>;
};

export type ProtectedPdfFile = { data: Uint8Array } | { ranged: RangedPdfSource };

/** 这么大以上、服务器认 Range 的 PDF 按段取。 */
export const RANGED_PDF_MIN_BYTES = 48 * 1024 * 1024;

/**
 * PDF.js 会把传入的 ArrayBuffer 转移给 Worker，原 buffer 随后会 detached。
 * 缓存/会话持有的原始字节不能直接交给 Document，否则分栏切换导致重挂载时
 * 无法再次解析。每个 Document 实例只消费自己的副本。
 */
export function cloneProtectedPdfFileForWorker(
  file: ProtectedPdfFile | null,
): ProtectedPdfFile | null {
  if (!file) return null;
  // 按段取的不持有字节：每次挂载由 PdfDocumentPane 新建一个取段的 transport。
  if ("ranged" in file) return file;
  return { data: file.data.slice() };
}

type ProtectedPdfState = {
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

function setCachedProtectedPdf(url: string, file: ProtectedPdfFile) {
  const key = `${url || ""}`.trim();
  if (!key) return;
  if (fileCache.has(key)) {
    touchFileCache(key, file);
    return;
  }
  evictIfNeeded();
  fileCache.set(key, file);
}

async function readErrorReason(response: Response): Promise<string> {
  if (typeof response.json !== "function") return "";
  try {
    const payload = await response.json() as { error?: { details?: { reason?: unknown } } } | null;
    const reason = payload?.error?.details?.reason;
    return typeof reason === "string" ? reason.trim() : "";
  } catch {
    return "";
  }
}

export async function loadProtectedPdfFile(
  url: string,
  fetchResource: typeof fetch = readerPdfPort().fetchProtected,
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
  // 自己的 controller：大文件看了响应头就停掉整份下载（外面的 signal 照样能中止）。
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener?.("abort", forwardAbort, { once: true });
  let response: Response;
  try {
    response = await fetchResource(normalized, { signal: controller.signal } as RequestInit);
  } finally {
    options.signal?.removeEventListener?.("abort", forwardAbort);
  }
  if (!response.ok) {
    const err = new Error(`读取 PDF 失败 (${response.status})`) as Error & { status?: number; reason?: string };
    err.status = response.status;
    // 译文 PDF 还没产出时后端回 404 + error.details.reason=not_ready，和"任务没了"的 404 区分开。
    const reason = await readErrorReason(response);
    if (reason) err.reason = reason;
    throw err;
  }
  const ranged = rangedSourceOf(normalized, response, fetchResource);
  if (ranged) {
    controller.abort();
    const file: ProtectedPdfFile = { ranged };
    evictIfNeeded();
    fileCache.set(normalized, file);
    return file;
  }
  options.signal?.addEventListener?.("abort", forwardAbort, { once: true });
  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } finally {
    options.signal?.removeEventListener?.("abort", forwardAbort);
  }
  const file: ProtectedPdfFile = { data: new Uint8Array(buffer) };
  if (fileCache.has(normalized)) {
    touchFileCache(normalized, file);
  } else {
    evictIfNeeded();
    fileCache.set(normalized, file);
  }
  return file;
}

/** 响应头说够大、认 Range：返回按段取的办法；否则 null（整份下）。 */
function rangedSourceOf(url: string, response: Response, fetchResource: typeof fetch): RangedPdfSource | null {
  const headers = response.headers;
  if (!headers || typeof headers.get !== "function") return null;
  const length = Number(headers.get("content-length") || 0);
  const acceptsRanges = `${headers.get("accept-ranges") || ""}`.toLowerCase().includes("bytes");
  const encoded = `${headers.get("content-encoding") || ""}`.trim();
  if (!acceptsRanges || encoded || !Number.isFinite(length) || length < RANGED_PDF_MIN_BYTES) return null;
  return {
    url,
    length,
    async fetchRange(begin, end) {
      const part = await fetchResource(url, { headers: { Range: `bytes=${begin}-${end - 1}` } } as RequestInit);
      if (part.status !== 206) throw new Error(`读取 PDF 片段失败 (${part.status})`);
      return new Uint8Array(await part.arrayBuffer());
    },
  };
}

const EMPTY_STATE: ProtectedPdfState = { file: null, loading: false, error: "" };
const LOADING_STATE: ProtectedPdfState = { file: null, loading: true, error: "" };

export function useProtectedPdfFile(
  url = "",
  /** 会话已预下载时直接注入，跳过二次请求 */
  preloaded: ProtectedPdfFile | null = null,
): ProtectedPdfState {
  const normalized = `${url || ""}`.trim();
  // 结果记着它属于哪个 url。以前只存文件，换 url 后的第一次渲染还返回旧文件：
  // PdfDocumentPane 拿「新 url + 旧字节」当 Document 的 key 先重挂一次，还把旧 PDF
  // 整份复制一遍交给 worker，等 effect 换掉文件再挂一次。
  const [loaded, setLoaded] = useState<(ProtectedPdfState & { url: string }) | null>(null);

  useEffect(() => {
    if (preloaded || !normalized) return undefined;
    const cached = fileCache.get(normalized);
    if (cached) {
      // 渲染里只读缓存不动它；LRU 的「最近用过」在这里记。
      touchFileCache(normalized, cached);
      return undefined;
    }
    const controller = new AbortController();
    loadProtectedPdfFile(normalized, undefined, { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) setLoaded({ url: normalized, file: next, loading: false, error: "" });
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setLoaded({ url: normalized, file: null, loading: false, error: err?.message || String(err) });
        }
      });
    // 换书或卸载时中止下载，被放弃的大文件不再下完。
    return () => controller.abort();
  }, [normalized, preloaded]);

  if (preloaded) return { file: preloaded, loading: false, error: "" };
  if (!normalized) return EMPTY_STATE;
  if (loaded?.url === normalized) return loaded;
  const cached = fileCache.get(normalized);
  if (cached) return { file: cached, loading: false, error: "" };
  return LOADING_STATE;
}
