import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { API_PREFIX } from "../config/api-constants.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint } from "./http.js";

// AI hỏi đáp thư viện (POST /api/v1/ai/ask, SSE streaming).
// Sử dụng fetch streaming thay vì EventSource: EventSource không thể mang theo header X-API-Key.

export class AiAskError extends Error {
  status: number;
  constructor(message, status = 0) {
    super(message);
    this.name = "AiAskError";
    this.status = status;
  }
}

function normalizeDonePayload(payload: any = {}) {
  return {
    answer: `${payload?.answer || ""}`,
    citations: Array.isArray(payload?.citations) ? payload.citations : [],
    toolTrace: Array.isArray(payload?.tool_trace) ? payload.tool_trace : [],
    rounds: Number(payload?.rounds) || 0,
    conversationId: `${payload?.conversation_id || payload?.conversationId || ""}`.trim(),
  // Kiểm toán C2: khi backend ghi lại lịch sử thất bại done.persisted=false, lớp trên hiển thị "Chưa lưu vào lịch sử".
  // Backend cũ không có trường này → coi như đã lưu trữ (không báo sai).
    persisted: payload?.persisted !== false,
  };
}

function parseSseEvent(line = "") {
  const trimmed = `${line}`.replace(/\r$/, "");
  if (!trimmed.startsWith("data:")) {
    return null;
  }
  const jsonText = trimmed.slice("data:".length).trim();
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText);
  } catch (_err) {
    return null;
  }
}

// Tiêu thụ SSE body của /ai/ask: tách theo dòng `data: {json}`, callback sự kiện tool,
// Sự kiện done trả về kết quả cuối cùng, sự kiện error ném ra AiAskError.
export async function readAiAskStream(body, { onToolEvent = null, onAnswerDelta = null } = {}) {
  if (!body || typeof body.getReader !== "function") {
    throw new AiAskError("Định dạng phản hồi dịch vụ AI bất thường, vui lòng thử lại.");
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = null;
  let streamedAnswer = "";

  function handleLine(line) {
    const event = parseSseEvent(line);
    if (!event || typeof event !== "object") {
      return;
    }
    if (event.type === "tool") {
      onToolEvent?.(event);
      return;
    }
    if (event.type === "answer_delta") {
      // Tăng dần theo token của vòng trả lời cuối: tích lũy và callback, frontend render theo từng phần
      const chunk = `${event.text || ""}`;
      if (chunk) {
        streamedAnswer += chunk;
        onAnswerDelta?.(streamedAnswer, chunk);
      }
      return;
    }
    if (event.type === "done") {
      // done.answer là văn bản đầy đủ chính thức; khi backend không trả về answer, dùng văn bản streaming tích lũy làm dự phòng
      result = normalizeDonePayload({
        ...event,
        answer: event.answer || streamedAnswer,
      });
      return;
    }
      if (event.type === "error") {
        throw new AiAskError(`${event.message || "Dịch vụ AI trả về lỗi."}`);
      }
  }

  try {
    while (!result) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        handleLine(buffer.slice(0, newlineIndex));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (!result) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        handleLine(buffer);
      }
    }
  } finally {
    reader.cancel?.().catch?.(() => {});
    reader.releaseLock?.();
  }
  if (!result) {
    throw new AiAskError("Phản hồi dịch vụ AI bị gián đoạn, vui lòng thử lại.");
  }
  return result;
}

async function extractErrorMessage(resp) {
  const text = await resp.text().catch(() => "");
  try {
    const envelope = JSON.parse(text);
    // Rust envelope: { code, message }
    const message = `${envelope?.message || ""}`.trim();
    if (message) {
      return message;
    }
    // FastAPI / AI service: { detail: string | [{msg}] }
    const detail = envelope?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") {
            return item.trim();
          }
          if (item && typeof item === "object") {
            return `${(item as { msg?: string }).msg || (item as { message?: string }).message || ""}`.trim();
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) {
        return parts.join("; ");
      }
    }
    return "";
  } catch (_err) {
    // Khi không phải JSON, cắt một đoạn văn bản gốc, tránh dán toàn bộ HTML vào bong bong chat
    return `${text || ""}`.replace(/\s+/g, " ").trim().slice(0, 240);
  }
}

// SSE stream chế độ mock: sao chép trung thành trình tự sự kiện backend thực (tool → answer_delta → done).
// Trích dẫn block_id căn chỉnh với khu vực đọc mock (b-intro-3), cho phép xác minh đầu cuối khi nhảy đến trích dẫn.
function buildMockAskStream(question = "") {
  const encoder = new TextEncoder();
  const answer = [
    `Về "${question}", tìm thấy các điểm chính sau:\n\n`,
    "- **Trao đổi halogen-lithi** thể hiện tính chọn lọc đáng kể trong hệ thống liên hợp [1]\n",
    "- Hiệu ứng này xuất phát từ sự liên hợp hiệu quả giữa nguyên tử lithi và vòng thơm [1]\n\n",
    "### Kết luận\n\n",
    "Trao đổi halogen bốn lần không thể hiện xu hướng phối trí, tính toán hóa học lượng tử hỗ trợ giải thích này. HTML gốc như <img src=x> sẽ hiển thị dưới dạng văn bản.\n",
  ];
  const events = [
    { type: "tool", round: 1, tool: "search_fulltext", arguments: { query: question } },
    { type: "tool", round: 1, tool: "read_blocks", arguments: {} },
    ...answer.map((text) => ({ type: "answer_delta", text })),
    {
      type: "done",
      answer: answer.join(""),
      citations: [
        {
          ref: 1,
          document_id: "doc-9f2a41c8e77b",
          job_id: "mock-job-20260415",
          page_idx: 0,
          block_id: "b-intro-3",
          snippet: "Tổng hợp hữu cơ hiện đại đã đạt đến mức độ chính xác cực kỳ cao",
        },
      ],
      tool_trace: [{ round: 1, tool: "search_fulltext" }],
      rounds: 1,
      conversation_id: "mock-conv-reader",
    },
  ];
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
}

// AI agentic hỏi đáp thư viện. Khi truyền documentId, giới hạn trong một tài liệu; không truyền thì tìm kiếm toàn bộ kho.
// jobId cũng được gửi lên: server có thể truy ngược document, lịch sử run ổn định hơn.
// Khi truyền conversationId, chạy đa vòng; nếu bỏ trống, server có thể auto-create và trả về done.conversation_id.
// Trả về { answer, citations, toolTrace, rounds, conversationId }; nếu thất bại, ném ra AiAskError.
export async function askLibraryAi({
  question = "",
  documentId = "",
  jobId = "",
  conversationId = "",
  /** parent_id của tin nhắn user khi new user / regenerate */
  parentId = "",
  /** Regenerate: chỉ thêm nhánh anh em assistant */
  regenerate = false,
  userMessageId = "",
  assistantMessageId = "",
  onToolEvent = null,
  onAnswerDelta = null,
  signal = null,
  apiPrefix = API_PREFIX,
  fetchImpl = fetch,
  llmApiKey = "",
  llmBaseUrl = "",
  llmModel = "",
} = {}) {
  const trimmed = `${question}`.trim();
  if (!trimmed) {
    throw new AiAskError("Vui lòng nhập câu hỏi.", 400);
  }
  if (isMockMode()) {
    // Mô phỏng trung thành SSE stream thực: sự kiện tool → answer_delta từng khối → done có trích dẫn,
    // Cho phép markdown render / streaming / nhảy trích dẫn ba đường link đều có thể tái hiện đầu cuối trong mock.
    return readAiAskStream(buildMockAskStream(trimmed), { onToolEvent, onAnswerDelta });
  }
  const payload: Record<string, any> = { question: trimmed, stream: true };
  const normalizedDocumentId = `${documentId || ""}`.trim();
  const normalizedJobId = `${jobId || ""}`.trim();
  const normalizedConversationId = `${conversationId || ""}`.trim();
  if (normalizedDocumentId) {
    payload.document_id = normalizedDocumentId;
  }
  if (normalizedJobId) {
    payload.job_id = normalizedJobId;
  }
  if (normalizedConversationId) {
    payload.conversation_id = normalizedConversationId;
  }
  const normalizedParentId = `${parentId || ""}`.trim();
  if (normalizedParentId) {
    payload.parent_id = normalizedParentId;
  }
  if (regenerate) {
    payload.regenerate = true;
  }
  const uid = `${userMessageId || ""}`.trim();
  const aid = `${assistantMessageId || ""}`.trim();
  if (uid) payload.user_message_id = uid;
  if (aid) payload.assistant_message_id = aid;
  // Mang theo chứng chỉ LLM theo yêu cầu: phải không rỗng, cấm gửi Authorization: Bearer rỗng
  const key = `${llmApiKey || ""}`.trim();
  if (key) {
    // Nếu người dùng nhầm dán cả "Bearer xxx" vào cài đặt, gỡ bỏ tiền tố
    payload.llm_api_key = key.replace(/^Bearer\s+/i, "").trim();
  }
  if (`${llmBaseUrl || ""}`.trim()) {
    payload.llm_base_url = `${llmBaseUrl}`.trim();
  }
  if (`${llmModel || ""}`.trim()) {
    payload.llm_model = `${llmModel}`.trim();
  }
  const resp = await fetchImpl(buildApiEndpoint(apiPrefix, "ai/ask"), {
    method: "POST",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal,
  });
  if (!resp.ok) {
    if (resp.status === 502) {
      throw new AiAskError("Dịch vụ AI chưa chạy (502), vui lòng khởi động dịch vụ retainpdf-ai trước.", 502);
    }
    const message = await extractErrorMessage(resp);
    // 401: phần lớn là X-API-Key của cổng dịch vụ (runtime xApiKey), không phải Key mô hình
    if (resp.status === 401) {
      const hint = /X-API-Key|api key|invalid api key|Unauthorized/i.test(message)
        ? message
        : "Xác thực dịch vụ thất bại: X-API-Key không hợp lệ hoặc chưa cấu hình (kiểm tra xApiKey trong runtime-config / cấu hình auth backend).";
      throw new AiAskError(`${hint}(${resp.status})`, 401);
    }
    // 400 thiếu LLM key: chỉ rõ đến "Cài đặt → Thông tin xác thực" của Model API Key
    if (resp.status === 400 && /LLM|Model\s*API\s*Key|api key/i.test(message)) {
      throw new AiAskError(
        message.includes("thông tin xác thực") || message.includes("cài đặt")
          ? `${message}(${resp.status})`
          : `Thiếu Model API Key: vui lòng đến Cài đặt → Cấu hình API điền thông tin trước khi hỏi. (${resp.status})`,
        400,
      );
    }
    throw new AiAskError(`${message || "Yêu cầu hỏi đáp AI thất bại, vui lòng thử lại sau."}(${resp.status})`, resp.status);
  }
  const contentType = `${resp.headers?.get?.("content-type") || ""}`.toLowerCase();
  if (contentType.includes("application/json")) {
    // Khi backend không trả về theo streaming, tương thích envelope JSON một lần
    return normalizeDonePayload(unwrapEnvelope(await resp.json()));
  }
  return readAiAskStream(resp.body, { onToolEvent, onAnswerDelta });
}
