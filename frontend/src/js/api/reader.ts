import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { getMockReaderRegions } from "../mock/documents.js";
import { buildJobDetailEndpoint, submitJson } from "./http.js";

export async function fetchReaderRegions(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return getMockReaderRegions();
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/regions`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return { items: [] };
    }
     throw new Error(`Đọc khu vực đọc thất bại, vui lòng thử lại sau.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderMetadata(jobId, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    return null;
  }
  const resp = await fetch(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/metadata`, {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    if (resp.status === 404) {
      return null;
    }
     throw new Error(`Đọc siêu dữ liệu đọc thất bại, vui lòng thử lại sau.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchReaderAiChat(jobId, payload, apiPrefix) {
  if (isMockMode()) {
    void jobId;
    void apiPrefix;
    const message = `${payload?.message || ""}`.trim();
    return {
       answer: `Đây là phản hồi mock đọc hỏi đáp: ${message || "Vui lòng đặt một câu hỏi"}`,
      citations: [
        {
          title: "Mock Markdown",
          page: 1,
          snippet: "Chế độ mock sẽ trả về trích dẫn cố định, chế độ thực sẽ gọi Reader AI Chat backend.",
        },
      ],
      used_context: {
        source: "mock",
        scope: payload?.scope || "document",
      },
    };
  }
  return submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/reader/ai/chat`, payload);
}
