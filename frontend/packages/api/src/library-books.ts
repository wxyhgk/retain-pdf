// Library books API — standalone, typed by @retainpdf/contracts/library-books
// No frontend/web deps; browser-aware (reads window.__FRONT_RUNTIME_CONFIG__ for apiBase / X-API-Key if present).

import { buildApiHeaders, buildApiUrl, unwrapEnvelope } from "./internal/runtime.js";
import { stripOcrSuffix } from "./utils/strip-ocr.js";
import type {
  LibraryBookListView,
  LibraryDeleteResultView,
} from "@retainpdf/contracts/library-books";

function buildApiEndpoint(apiPrefix: string | undefined, path: string): string {
  return buildApiUrl(apiPrefix, path);
}

export async function fetchLibraryBookList(
  apiPrefix: string,
  { limit = 40, offset = 0, q = "", jobIds = [] as string[] } = {},
): Promise<LibraryBookListView> {
  const params = new URLSearchParams();
  params.set("limit", `${limit}`);
  params.set("offset", `${offset}`);
  if (`${q || ""}`.trim()) params.set("q", `${q || ""}`.trim());
  if (Array.isArray(jobIds) && jobIds.length) {
    params.set("job_ids", jobIds.map((id) => `${id}`.trim()).filter(Boolean).join(","));
  }
  const resp = await fetch(`${buildApiEndpoint(apiPrefix, "library/books")}?${params.toString()}`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) throw new Error(`读取图书馆失败，请稍后重试。(${resp.status})`);
  return unwrapEnvelope<LibraryBookListView>(await resp.json());
}

export async function deleteLibraryBook(
  apiPrefix: string,
  jobId: string,
  { force = false } = {},
): Promise<LibraryDeleteResultView> {
  const normalizedJobId = stripOcrSuffix(`${jobId || ""}`);
  if (!normalizedJobId) throw new Error("删除失败: 缺少 job_id");
  const params = force ? "?force=true" : "";
  const resp = await fetch(
    `${buildApiEndpoint(apiPrefix, `library/books/${encodeURIComponent(normalizedJobId)}`)}${params}`,
    { method: "DELETE", headers: buildApiHeaders() },
  );
  if (!resp.ok) {
    const envelope = await resp.json().catch(() => null) as { message?: unknown } | null;
    const message = typeof envelope?.message === "string" ? envelope.message : "删除任务失败，请稍后重试。";
    const error = new Error(`${message}(${resp.status})`) as Error & { status?: number };
    error.status = resp.status;
    throw error;
  }
  return unwrapEnvelope<LibraryDeleteResultView>(await resp.json());
}
