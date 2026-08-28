"""Vòng lặp mỏng cho hỏi đáp kiểu agentic có truy xuất.

Cố tình không dùng framework agent: chỉ một provider (endpoint tương thích DeepSeek),
dịch vụ cục bộ một người dùng, nên một vòng function calling trần ~200 dòng là đủ,
tự quản timeout/số vòng/số hiệu trích dẫn. Định nghĩa tool đồng cấu với các SDK phổ
biến (tools.py), sau này muốn chuyển đổi thì chỉ thay lớp vỏ này.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from .config import Settings
from .tools import ToolRegistry

SYSTEM_PROMPT = """You are the literature question-answering assistant of the RetainPDF library. The user's library contains scientific literature (mostly written in English and already translated into Chinese).

How to work:
- Find evidence with the tools first, then answer; never answer about the content of the literature from thin air. You may use the tools over several rounds and search repeatedly with different keywords.
- Every piece of evidence in the tool results has a ref number and a page (1-based page number). In your answer you may only cite with bracketed numbers, for example [1] [2].
  Correct: "This method significantly reduces the computational cost [2]."
  Wrong: "... [p002-b0004]", "... (block_id=...)", "... page_idx=3" - never output any internal ID.
- Organize the answer with Markdown (subheadings, lists, bold); use $...$ / $$...$$ for formulas.
- Tool results may contain image_urls. If the question involves a figure/table/structural formula, you may use:
  ![short description](/api/v1/jobs/.../markdown/images/...)
  Use only URLs returned by the tools, do not invent them.
- If you cannot find evidence, say so plainly and do not make things up.
- Answer in Chinese, keeping technical terms in the original language. Be concise and direct, and do not repeat the raw JSON of the tools."""

CITATION_RE = re.compile(r"\[(\d+)\]")
# Model đôi khi viết block_id nội bộ vào nội dung trả lời; lúc kết thúc sẽ xóa đi
# hoặc ánh xạ thành [n]
BLOCK_ID_BRACKET_RE = re.compile(r"\[\s*(p\d+[-_]b\d+)\s*\]", re.IGNORECASE)
BLOCK_ID_BARE_RE = re.compile(r"(?<![\w/])(p\d+[-_]b\d+)(?![\w/])", re.IGNORECASE)


@dataclass
class Citation:
    ref: int
    document_id: str
    job_id: str
    page_idx: int
    block_id: str
    snippet: str


@dataclass
class AskResult:
    answer: str
    citations: list[Citation] = field(default_factory=list)
    tool_trace: list[dict[str, Any]] = field(default_factory=list)
    rounds: int = 0


ChatFn = Callable[[list[dict[str, Any]], list[dict[str, Any]]], dict[str, Any]]


def assemble_streaming_message(
    lines: Iterable[str | bytes],
    on_delta: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Gộp SSE dạng streaming của DeepSeek thành message dict đồng cấu với bản không streaming.

    Phân tích từng dòng `data: {json}` (kết thúc bằng `data: [DONE]`), tích lũy content và
    tool_calls được nối theo index. Chỉ khi cả vòng không xuất hiện tool_calls (vòng trả
    lời thuần túy) thì mới gọi on_delta cho từng phần content tăng thêm — vòng gọi tool
    không emit answer_delta.
    Trả về `{"role":"assistant","content":..., "tool_calls":[...]}` để vòng lặp agent không
    cần biết đang ở chế độ streaming hay không.
    """
    content_parts: list[str] = []
    tool_calls: dict[int, dict[str, Any]] = {}
    saw_tool_calls = False
    # Kiểm toán A3: model có thể trong cùng một vòng đẩy ra phần content mở đầu rồi mới
    # đến tool_calls — emit ngay sẽ đẩy những câu rác kiểu "để tôi tìm kiếm…" xuống
    # frontend như thể đó là câu trả lời (khi done lại bị ghi đè, gây nháy).
    # HOLDBACK_CHARS ký tự đầu tiên được đệm lại để xác định tính chất: nếu xuất hiện
    # tool_calls → lặng lẽ bỏ; nếu đệm đầy mà vẫn không có tool_calls → coi là vòng trả
    # lời thuần túy, flush xong thì chuyển sang truyền thẳng (chỉ trễ vài token).
    holdback_chars = 64
    pending: list[str] = []
    pending_flushed = False

    def _flush_pending() -> None:
        nonlocal pending_flushed
        if on_delta is not None and pending:
            on_delta("".join(pending))
        pending.clear()
        pending_flushed = True

    for raw in lines:
        line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        line = line.strip()
        if not line or not line.startswith("data:"):
            continue
        data = line[len("data:"):].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            continue
        choices = chunk.get("choices") or []
        if not choices:
            continue
        delta = choices[0].get("delta") or {}
        delta_tool_calls = delta.get("tool_calls") or []
        if delta_tool_calls:
            if not saw_tool_calls:
                pending.clear()  # Vòng gọi tool: bỏ phần content mở đầu chưa xác định, không gửi cho frontend
            saw_tool_calls = True
            for call in delta_tool_calls:
                index = call.get("index", 0)
                slot = tool_calls.setdefault(
                    index,
                    {"id": "", "type": "function", "function": {"name": "", "arguments": ""}},
                )
                if call.get("id"):
                    slot["id"] = call["id"]
                if call.get("type"):
                    slot["type"] = call["type"]
                function = call.get("function") or {}
                if function.get("name"):
                    slot["function"]["name"] += function["name"]
                if function.get("arguments"):
                    slot["function"]["arguments"] += function["arguments"]
        piece = delta.get("content")
        if piece:
            content_parts.append(piece)
            if on_delta is not None and not saw_tool_calls:
                if pending_flushed:
                    on_delta(piece)
                else:
                    pending.append(piece)
                    if sum(len(p) for p in pending) >= holdback_chars:
                        _flush_pending()
    # Câu trả lời thuần túy và ngắn (chưa đạt ngưỡng đệm) được gửi bù khi luồng kết thúc
    if not saw_tool_calls and not pending_flushed:
        _flush_pending()
    message: dict[str, Any] = {"role": "assistant", "content": "".join(content_parts)}
    if tool_calls:
        message["tool_calls"] = [tool_calls[index] for index in sorted(tool_calls)]
    return message


def _friendly_llm_error(status_code: int, detail: str = "") -> RuntimeError:
    """Dịch lỗi HTTP của LLM thượng nguồn thành thông báo người dùng có thể hành động (kiểm toán C1).

    HTTPStatusError để nguyên sẽ dán cả URL nội bộ vào bóng chat, và các trạng thái quan
    trọng như 402 (hết số dư)/429 (giới hạn tần suất) thì không có hướng dẫn nào.
    """
    hint = {
        400: "Dịch vụ model từ chối yêu cầu (tham số sai hoặc ngữ cảnh quá dài)",
        401: "API Key của model không hợp lệ hoặc chưa được cấp quyền: vào Cài đặt → Cài đặt API để kiểm tra Key",
        402: "Tài khoản model không đủ số dư: hãy nạp tiền ở nhà cung cấp rồi thử lại",
        403: "Dịch vụ model từ chối truy cập: kiểm tra quyền của Key hoặc model đã chọn",
        404: "Model hoặc địa chỉ API không tồn tại: kiểm tra tên model và Base URL",
        429: "Gọi model quá thường xuyên (bị giới hạn tần suất): chờ vài giây rồi thử lại",
    }.get(status_code)
    if hint is None:
        if status_code >= 500:
            hint = "Dịch vụ model tạm thời không khả dụng (lỗi phía thượng nguồn): thử lại sau"
        else:
            hint = f"Dịch vụ model trả về lỗi (HTTP {status_code})"
    snippet = f"{detail or ''}".strip().replace("\n", " ")
    if len(snippet) > 200:
        snippet = f"{snippet[:200]}…"
    return RuntimeError(f"{hint}" + (f" (thông tin từ thượng nguồn: {snippet})" if snippet else ""))


def build_deepseek_chat_fn(
    settings: Settings,
    client: httpx.Client | None = None,
    *,
    on_delta: Callable[[str], None] | None = None,
) -> ChatFn:
    http = client or httpx.Client(timeout=settings.llm_timeout_s)
    url = f"{settings.llm_base_url}/chat/completions"
    # Key rỗng sẽ tạo header HTTP không hợp lệ `Bearer ` (httpx LocalProtocolError)
    api_key = f"{settings.llm_api_key or ''}".strip()
    if not api_key:
        def _missing_key(_messages: list[dict[str, Any]], _tools: list[dict[str, Any]]) -> dict[str, Any]:
            raise RuntimeError(
                "Thiếu LLM API Key: hãy nhập API Key của model ở giao diện "
                "\"Cài đặt → Thông tin đăng nhập\", hoặc đặt biến môi trường RETAIN_AI_LLM_API_KEY."
            )
        return _missing_key
    headers = {"Authorization": f"Bearer {api_key}"}

    def chat(messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": messages,
            "tools": tools,
            "temperature": 0.2,
        }
        if on_delta is None:
            response = http.post(url, headers=headers, json=body)
            if response.status_code >= 400:
                raise _friendly_llm_error(response.status_code, response.text)
            return response.json()["choices"][0]["message"]
        # Streaming: đẩy từng token lên tầng trên qua on_delta, đồng thời gộp thành message đồng cấu để trả về
        body["stream"] = True
        with http.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code >= 400:
                # Ở chế độ stream, body chưa được đọc: đọc chi tiết lỗi trước rồi mới ném
                # (bản cũ gọi raise_for_status trước khi đọc body nên mất luôn JSON lỗi của DeepSeek)
                try:
                    detail = response.read().decode("utf-8", errors="replace")
                except Exception:
                    detail = ""
                raise _friendly_llm_error(response.status_code, detail)
            return assemble_streaming_message(response.iter_lines(), on_delta)

    return chat


class RetrievalAgent:
    def __init__(
        self,
        registry: ToolRegistry,
        chat_fn: ChatFn,
        *,
        max_tool_rounds: int = 6,
    ) -> None:
        self._registry = registry
        self._chat = chat_fn
        self._max_tool_rounds = max(1, max_tool_rounds)

    def ask(
        self,
        question: str,
        *,
        document_id: str = "",
        job_id: str = "",
        on_event: Callable[[dict[str, Any]], None] | None = None,
        chat_fn: ChatFn | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AskResult:
        # chat_fn ghi đè: bộ trả lời tạm thời dựng từ LLM key đi kèm request; mặc định dùng bản tạo lúc khởi động
        emit = on_event or (lambda event: None)
        chat = chat_fn or self._chat
        scoped_document_id = document_id.strip()
        scoped_job_id = job_id.strip()
        user_content = question.strip()
        if scoped_document_id:
            # Mô tả phạm vi cứng + tầng tool bắt buộc chèn document_id (xem _scope_tool_arguments)
            user_content = (
                f"(Restricted to document_id={scoped_document_id}"
                f"{f', job_id={scoped_job_id}' if scoped_job_id else ''}"
                f". search_fulltext / search_favorites / list_documents / read_blocks "
                f"must operate only inside that document.)\n{user_content}"
            )
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        # Hội thoại nhiều lượt: chèn lại các lượt trước (chỉ giữ role/content, không phát lại vết gọi tool)
        for turn in history or []:
            role = str(turn.get("role") or "")
            content = str(turn.get("content") or "").strip()
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_content})
        citations: dict[int, Citation] = {}
        trace: list[dict[str, Any]] = []
        next_ref = 1
        # Hỏi đáp toàn cuốn: không lộ list_documents để model không đi "duyệt thư viện"
        tool_specs = _tool_specs_for_scope(self._registry, scoped_document_id)

        for round_index in range(1, self._max_tool_rounds + 1):
            message = chat(messages, tool_specs)
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                answer = _sanitize_answer_text(
                    str(message.get("content") or "").strip(), citations
                )
                return AskResult(
                    answer=answer,
                    citations=_referenced_citations(answer, citations),
                    tool_trace=trace,
                    rounds=round_index,
                )
            messages.append(
                {
                    "role": "assistant",
                    "content": message.get("content") or "",
                    "tool_calls": tool_calls,
                }
            )
            for call in tool_calls:
                name = call.get("function", {}).get("name", "")
                # Phiên hỏi đáp toàn cuốn chặn cứng các tool duyệt toàn thư viện
                if scoped_document_id and name == "list_documents":
                    result = {
                        "error": "Browsing the library is not allowed in whole-document Q&A; use search_fulltext / read_blocks.",
                        "document_id": scoped_document_id,
                    }
                    emit({"type": "tool", "round": round_index, "tool": name, "arguments": {"skipped": True}})
                    trace.append({"round": round_index, "tool": name, "arguments": {"skipped": True}})
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.get("id", ""),
                            "content": json.dumps(result, ensure_ascii=False),
                        }
                    )
                    continue
                try:
                    arguments = json.loads(call.get("function", {}).get("arguments") or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                if not isinstance(arguments, dict):
                    arguments = {}
                arguments = _scope_tool_arguments(
                    name,
                    arguments,
                    document_id=scoped_document_id,
                    job_id=scoped_job_id,
                )
                emit({"type": "tool", "round": round_index, "tool": name, "arguments": arguments})
                result = self._registry.invoke(name, arguments)
                next_ref = _assign_refs(result, citations, next_ref)
                trace.append({"round": round_index, "tool": name, "arguments": arguments})
                # Payload gửi cho model bỏ các trường nội bộ như block_id, tránh việc model chép thành [p002-b0004]
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "content": json.dumps(
                            _public_tool_payload(result), ensure_ascii=False
                        ),
                    }
                )

        # Hết số vòng: buộc model chốt câu trả lời dựa trên bằng chứng đã có (không đưa tool)
        messages.append(
            {
                "role": "user",
                "content": "Give the final answer directly based on the evidence retrieved above, without calling any more tools. Cite only with [n].",
            }
        )
        # Bắt buộc dùng chat ở mức request (chat_fn or self._chat): với cách triển khai không
        # đặt key trong env mà frontend gửi key theo từng request thì self._chat là _missing_key
        # — câu hỏi chạy hết số vòng tool sẽ báo nhầm "Thiếu LLM API Key" ở vòng chốt (kiểm toán A1).
        message = chat(messages, [])
        answer = _sanitize_answer_text(str(message.get("content") or "").strip(), citations)
        return AskResult(
            answer=answer,
            citations=_referenced_citations(answer, citations),
            tool_trace=trace,
            rounds=self._max_tool_rounds,
        )


def _scope_tool_arguments(
    name: str,
    arguments: dict[str, Any],
    *,
    document_id: str = "",
    job_id: str = "",
) -> dict[str, Any]:
    """Khi hỏi đáp toàn cuốn, buộc tool chạy đúng tài liệu/tác vụ hiện tại, không trông chờ model tự truyền tham số."""
    if not document_id:
        return arguments
    scoped = dict(arguments)
    if name in {"search_fulltext", "search_favorites", "list_documents", "read_blocks"}:
        scoped["document_id"] = document_id
    if name == "read_blocks" and job_id and not str(scoped.get("job_id") or "").strip():
        scoped["job_id"] = job_id
    return scoped


def _tool_specs_for_scope(registry: ToolRegistry, document_id: str = "") -> list[dict[str, Any]]:
    """Khi hỏi đáp toàn cuốn thì bỏ list_documents khỏi danh sách tool, giảm bớt việc "duyệt thư viện" vô nghĩa."""
    specs = registry.specs()
    if not document_id.strip():
        return specs
    filtered: list[dict[str, Any]] = []
    for spec in specs:
        name = str((spec.get("function") or {}).get("name") or "")
        if name == "list_documents":
            continue
        filtered.append(spec)
    return filtered


def _assign_refs(result: dict[str, Any], citations: dict[int, Citation], next_ref: int) -> int:
    """Đánh số trích dẫn cho các kết quả tool có neo, và ghi số đó trở lại kết quả (bên trong vẫn giữ block_id cho Citation)."""
    anchored: list[dict[str, Any]] = []
    anchored.extend(result.get("hits") or [])
    anchored.extend(result.get("favorites") or [])
    # read_blocks: ghi neo ở lớp ngoài vào từng block
    blocks = result.get("blocks")
    if isinstance(blocks, list):
        rewritten_blocks: list[dict[str, Any]] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            item = dict(block)
            item.setdefault("document_id", result.get("document_id"))
            item.setdefault("job_id", result.get("job_id"))
            item.setdefault("page_idx", result.get("page_idx"))
            rewritten_blocks.append(item)
            anchored.append(item)
        result["blocks"] = rewritten_blocks
    for entry in anchored:
        if not isinstance(entry, dict):
            continue
        document_id = str(entry.get("document_id") or "")
        block_id = str(entry.get("block_id") or "")
        if not document_id or not block_id:
            continue
        entry["ref"] = next_ref
        snippet = str(
            entry.get("translated_snippet")
            or entry.get("translated_text")
            or entry.get("translated_quote_text")
            or entry.get("source_snippet")
            or entry.get("source_text")
            or entry.get("quote_text")
            or ""
        )
        citations[next_ref] = Citation(
            ref=next_ref,
            document_id=document_id,
            job_id=str(entry.get("job_id") or ""),
            page_idx=int(entry.get("page_idx") or 0),
            block_id=block_id,
            snippet=snippet[:200],
        )
        next_ref += 1
    return next_ref


def _public_anchor(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Neo mà model nhìn thấy: chỉ có ref / page (đánh số từ 1) / snippet, không có ID nội bộ."""
    ref = entry.get("ref")
    if ref is None:
        return None
    try:
        page_idx = int(entry.get("page_idx") or 0)
    except (TypeError, ValueError):
        page_idx = 0
    snippet = str(
        entry.get("translated_snippet")
        or entry.get("translated_text")
        or entry.get("translated_quote_text")
        or entry.get("source_snippet")
        or entry.get("source_text")
        or entry.get("quote_text")
        or entry.get("snippet")
        or ""
    )[:280]
    return {
        "ref": int(ref),
        "page": page_idx + 1,
        "snippet": snippet,
    }


def _public_tool_payload(result: dict[str, Any]) -> dict[str, Any]:
    """Kết quả thô của tool → ngữ cảnh cho model. Bóc bỏ block_id/job_id v.v. để model không chép vào câu trả lời."""
    if not isinstance(result, dict):
        return {"error": "invalid tool result"}
    if result.get("error"):
        return {"error": str(result.get("error"))}

    public: dict[str, Any] = {}
    if result.get("hint"):
        public["hint"] = str(result.get("hint"))
    if result.get("document_id"):
        # Chỉ trả về id tài liệu khi cần xác nhận phạm vi; thông thường phiên toàn cuốn đã khóa sẵn
        public["scoped"] = True

    hits = result.get("hits")
    if isinstance(hits, list):
        public_hits = []
        for hit in hits:
            if isinstance(hit, dict):
                item = _public_anchor(hit)
                if item:
                    public_hits.append(item)
        if public_hits:
            public["hits"] = public_hits
            public["how_to_cite"] = "When answering, cite hits[].ref as [1] [2]; page is the page number, for reference only."

    favorites = result.get("favorites")
    if isinstance(favorites, list):
        public_favs = []
        for fav in favorites:
            if isinstance(fav, dict):
                item = _public_anchor(fav)
                if item:
                    public_favs.append(item)
        if public_favs:
            public["favorites"] = public_favs

    blocks = result.get("blocks")
    if isinstance(blocks, list):
        public_blocks = []
        for block in blocks:
            if isinstance(block, dict):
                item = _public_anchor(block)
                if item:
                    public_blocks.append(item)
        if public_blocks:
            public["blocks"] = public_blocks
            public["page"] = int(result.get("page_idx") or 0) + 1
            public["how_to_cite"] = "When answering, cite blocks[].ref as [n]."

    images = result.get("image_urls")
    if isinstance(images, list) and images:
        public["image_urls"] = [str(u) for u in images[:8]]

    # image_urls gắn trên kết quả search đã bị bỏ khi bóc hits; thu lại từ hits gốc
    if isinstance(hits, list):
        img_urls: list[str] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            for u in hit.get("image_urls") or []:
                img_urls.append(str(u))
                if len(img_urls) >= 8:
                    break
            if len(img_urls) >= 8:
                break
        if img_urls:
            public["image_urls"] = img_urls

    if not public:
        public["ok"] = True
    return public


def _sanitize_answer_text(answer: str, citations: dict[int, Citation]) -> str:
    """Ánh xạ [p002-b0004] / block_id trần trong nội dung thành [n] hoặc xóa đi."""
    if not answer:
        return answer
    by_block = {
        c.block_id.lower().replace("_", "-"): c.ref
        for c in citations.values()
        if c.block_id
    }

    def repl_bracket(match: re.Match[str]) -> str:
        key = match.group(1).lower().replace("_", "-")
        ref = by_block.get(key)
        return f"[{ref}]" if ref is not None else ""

    def repl_bare(match: re.Match[str]) -> str:
        key = match.group(1).lower().replace("_", "-")
        ref = by_block.get(key)
        return f"[{ref}]" if ref is not None else ""

    cleaned = BLOCK_ID_BRACKET_RE.sub(repl_bracket, answer)
    cleaned = BLOCK_ID_BARE_RE.sub(repl_bare, cleaned)
    # Thu gọn khoảng trắng thừa sinh ra do việc xóa
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" *\n", "\n", cleaned)
    return cleaned.strip()


def _referenced_citations(answer: str, citations: dict[int, Citation]) -> list[Citation]:
    # Giữ [n] theo thứ tự xuất hiện trong nội dung, tránh sorted làm xáo trộn thứ tự đọc
    ordered_refs: list[int] = []
    seen: set[int] = set()
    for match in CITATION_RE.findall(answer):
        ref = int(match)
        if ref in seen or ref not in citations:
            continue
        seen.add(ref)
        ordered_refs.append(ref)
    selected = [citations[ref] for ref in ordered_refs]
    # Khi model không đánh [n]: lọc trùng theo trang, tối đa 3 mục, tránh frontend đổ ra một danh sách dài
    if not selected and citations:
        picked: list[Citation] = []
        pages: set[int] = set()
        for ref in sorted(citations):
            item = citations[ref]
            if item.page_idx in pages:
                continue
            pages.add(item.page_idx)
            picked.append(item)
            if len(picked) >= 3:
                break
        return picked
    return selected[:8]
