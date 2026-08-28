"""Ứng dụng FastAPI: xác thực + /v1/ask + health check."""

from __future__ import annotations

import json
import queue
import threading
from dataclasses import asdict, replace
from typing import Any, Iterator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import __version__
from .agent import RetrievalAgent, build_deepseek_chat_fn
from .config import Settings, load_settings
from .memory import assemble_history, maybe_compress_transcript
from .rust_client import RustApiClient
from .tools import build_default_registry


class AskInput(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_id: str = ""
    # Có thể chỉ truyền job_id (kể cả run cũ): server tự xác định tài liệu tương ứng, tránh việc
    # frontend tra ngược qua active_job_id rồi lệch âm thầm ở job cũ, khiến hỏi đáp thoái hóa thành tìm kiếm toàn thư viện
    job_id: str = ""
    # Hội thoại nhiều lượt: nếu truyền ID phiên thì các lượt trước được chèn làm ngữ cảnh,
    # và khi xong sẽ ghi hai bản ghi user/assistant qua Rust API (không phá nguyên tắc một người ghi).
    # Nếu bỏ trống mà kết nối được Rust thì sẽ auto-create và trả conversation_id trong sự kiện done.
    conversation_id: str = ""
    # Cây tin nhắn: parent của user mới (head hiện tại); khi thử lại = id tin nhắn user được thử lại.
    parent_id: str = ""
    # Tạo lại câu trả lời: chỉ gắn assistant mới vào parent_id (user), không ghi thêm user.
    regenerate: bool = False
    # Id tin nhắn ổn định do client sinh, khớp với store của frontend / assistant-ui.
    user_message_id: str = ""
    assistant_message_id: str = ""
    stream: bool = False
    # B2: buộc kích hoạt nén kiểu trích xuất (dùng để kiểm thử/gỡ lỗi)
    force_compress: bool = False
    # Thông tin đăng nhập LLM do frontend gửi theo từng request: bỏ trống thì quay về cấu hình env lúc khởi động
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""


def build_app(
    settings: Settings | None = None,
    agent: RetrievalAgent | None = None,
    rust: RustApiClient | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    if agent is None:
        # LLM key không còn bắt buộc: cho phép để trống trong env, frontend gửi theo từng request (xem AskInput.llm_api_key)
        if not settings.rust_api_key:
            raise RuntimeError("RETAIN_AI_RUST_API_KEY is required")
        rust = rust or RustApiClient(settings)
        agent = RetrievalAgent(
            build_default_registry(settings, rust),
            build_deepseek_chat_fn(settings),
            max_tool_rounds=settings.max_tool_rounds,
        )

    app = FastAPI(title="retainpdf-ai", version=__version__)

    def resolve_document_id(payload: AskInput) -> str:
        document_id = payload.document_id.strip()
        if document_id or not payload.job_id.strip() or rust is None:
            return document_id
        try:
            document = rust.get_document_by_job(payload.job_id.strip())
        except Exception:
            return ""
        return str((document or {}).get("document_id") or "")

    def ensure_conversation_id(payload: AskInput, document_id: str) -> str:
        """B1: có conversation_id thì dùng; không thì auto-create qua Rust và trả về id mới."""
        existing = payload.conversation_id.strip()
        if existing:
            return existing
        if rust is None:
            return ""
        title = (payload.question or "").strip().replace("\n", " ")
        if len(title) > 48:
            title = f"{title[:48].rstrip()}…"
        if not title:
            title = "Hỏi đáp khi đọc"
        try:
            created = rust.create_conversation(title=title, document_id=document_id or "")
            return str((created or {}).get("conversation_id") or "").strip()
        except Exception as exc:
            print(f"[retainpdf-ai] auto-create conversation failed: {exc}", flush=True)
            return ""

    def _visible_path(
        messages: list[dict[str, Any]],
        head_id: str,
        *,
        stop_at: str = "",
    ) -> list[dict[str, Any]]:
        """Lần ngược theo parent_id từ head (hoặc stop_at), trả về đường đi gốc → lá.

        Dữ liệu cũ không có parent / message_id thì được nối thành chuỗi tuyến tính theo seq.
        """
        if not messages:
            return []
        ordered = sorted(
            messages,
            key=lambda m: int(m.get("seq") or 0) if str(m.get("seq") or "").strip() else 0,
        )
        # Tạo id ổn định + parent tuyến tính, để khi thiếu trường cây thì suy biến thành nguyên bản transcript
        by_id: dict[str, dict[str, Any]] = {}
        prev_id = ""
        for index, raw in enumerate(ordered):
            mid = str(raw.get("message_id") or "").strip() or f"__seq_{raw.get('seq', index)}"
            pid = str(raw.get("parent_id") or "").strip()
            if not pid and prev_id:
                pid = prev_id
            node = {**raw, "message_id": mid, "parent_id": pid}
            by_id[mid] = node
            prev_id = mid

        start_id = (stop_at or head_id or "").strip()
        if not start_id:
            start_id = prev_id
        cur = by_id.get(start_id)
        if cur is None and ordered:
            cur = by_id.get(prev_id)
        chain: list[dict[str, Any]] = []
        guard = 0
        while cur is not None and guard <= len(messages) + 2:
            chain.append(cur)
            guard += 1
            pid = str(cur.get("parent_id") or "").strip()
            cur = by_id.get(pid) if pid else None
        chain.reverse()
        return chain

    def load_transcript(
        conversation_id: str,
        *,
        stop_at: str = "",
    ) -> list[dict[str, Any]]:
        if not conversation_id or rust is None:
            return []
        try:
            detail = rust.get_conversation(conversation_id) or {}
        except Exception:
            return []
        messages = list(detail.get("messages") or [])
        head_id = str(detail.get("head_id") or "").strip()
        path = _visible_path(messages, head_id, stop_at=stop_at)
        out: list[dict[str, Any]] = []
        for message in path:
            role = str(message.get("role") or "")
            content = str(message.get("content") or "")
            if role not in {"user", "assistant"} or not content.strip():
                continue
            out.append(
                {
                    "role": role,
                    "content": content,
                    "message_id": str(message.get("message_id") or ""),
                    "parent_id": str(message.get("parent_id") or ""),
                    "citations_json": message.get("citations_json") or "[]",
                }
            )
        return out

    def prepare_memory(
        conversation_id: str,
        *,
        force_compress: bool = False,
        stop_at: str = "",
    ) -> tuple[list[dict[str, str]], dict[str, Any] | None, dict[str, Any], str]:
        """Nén (tùy chọn) + dựng history; trả về (history, compress_event|None, memory_debug, summary_id).

        Khi summary_id khác rỗng, bên gọi bắt buộc phải gắn user của lượt này (hoặc assistant khi
        regenerate) bên dưới nó — bản tóm tắt chỉ đọc lại được ở lượt sau (load_transcript) nếu
        nằm trên đường đi head. Bản cũ gắn tóm tắt với set_head=False dưới head, còn user cũng
        gắn dưới head, nên tóm tắt thành nút anh em của user (nhánh chết): không bao giờ đọc lại
        được → mỗi lượt lại nén lại + ghi thêm một bản tóm tắt mồ côi (kiểm toán A2).
        """
        transcript = load_transcript(conversation_id, stop_at=stop_at)
        compress = maybe_compress_transcript(
            transcript,
            window_turns=settings.memory_window_turns,
            compress_after_turns=settings.memory_compress_after_turns,
            force=force_compress,
        )
        compress_event: dict[str, Any] | None = None
        summary_id = ""
        working = compress.messages
        if compress.compressed and compress.summary_message and conversation_id and rust is not None:
            try:
                summary_msg = rust.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=str(compress.summary_message.get("content") or ""),
                    model="memory/extractive_v1",
                    parent_id=stop_at or "",
                    set_head=False,
                )
                summary_id = str((summary_msg or {}).get("message_id") or "").strip()
                compress_event = compress.event
            except Exception as exc:
                print(f"[retainpdf-ai] persist summary failed: {exc}", flush=True)
                # Lưu thất bại thì vẫn dùng view working trong bộ nhớ để hoàn tất lượt này
        assembled = assemble_history(
            working,
            window_turns=settings.memory_window_turns,
            max_chars=settings.memory_max_chars,
        )
        debug = {
            **assembled.debug,
            "compressed": bool(compress.compressed and compress_event is not None),
            "evidence_count": 0,
        }
        return assembled.history, compress_event, debug, summary_id

    def persist_turn(
        conversation_id: str,
        payload: AskInput,
        result: Any,
        *,
        chain_parent_id: str = "",
    ) -> None:
        """Ghi lịch sử theo kiểu nỗ lực tối đa: thất bại chỉ ghi log, không ảnh hưởng kết quả trả về.

        Lượt bình thường: user(parent=chain_parent_id|payload.parent_id|head) + assistant(parent=user).
        regenerate: chỉ assistant(parent = nút user chain_parent_id|payload.parent_id).
        chain_parent_id = id nút tóm tắt vừa được prepare_memory ghi xuống: khi có giá trị thì tin
        nhắn lượt này lấy tóm tắt làm parent, để nối tóm tắt vào đường đi head (nếu không tóm tắt
        thành nhánh chết, xem ghi chú ở prepare_memory).

        Trả về việc có lưu thành công hay không (không có phiên để ghi = True, không tính là lỗi);
        False sẽ được chuyển qua done.persisted để frontend báo "lượt này chưa lưu vào lịch sử"
        (kiểm toán C2: trước đây thất bại chỉ print, người dùng không hề biết).
        """
        if not conversation_id or rust is None:
            return True
        try:
            parent_hint = chain_parent_id.strip() or payload.parent_id.strip()
            citations_json = json.dumps(
                [asdict(citation) for citation in result.citations], ensure_ascii=False
            )
            tool_trace_json = json.dumps(result.tool_trace, ensure_ascii=False)
            model = payload.llm_model or settings.llm_model
            if payload.regenerate:
                # Thử lại: parent_id bắt buộc phải là tin nhắn user
                user_parent = parent_hint
                rust.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=result.answer,
                    citations_json=citations_json,
                    tool_trace_json=tool_trace_json,
                    model=model,
                    parent_id=user_parent,
                    message_id=payload.assistant_message_id.strip(),
                    set_head=True,
                )
                return True
            user_msg = rust.append_conversation_message(
                conversation_id,
                role="user",
                content=payload.question.strip(),
                parent_id=parent_hint,
                message_id=payload.user_message_id.strip(),
                set_head=True,
            )
            user_id = str((user_msg or {}).get("message_id") or "").strip()
            rust.append_conversation_message(
                conversation_id,
                role="assistant",
                content=result.answer,
                citations_json=citations_json,
                tool_trace_json=tool_trace_json,
                model=model,
                parent_id=user_id or parent_hint,
                message_id=payload.assistant_message_id.strip(),
                set_head=True,
            )
            return True
        except Exception as exc:
            print(f"[retainpdf-ai] persist conversation turn failed: {exc}", flush=True)
            return False

    def require_api_key(request: Request) -> None:
        if not settings.api_keys:
            raise HTTPException(status_code=500, detail="RETAIN_AI_API_KEYS is not configured")
        provided = request.headers.get("X-API-Key", "")
        if provided not in settings.api_keys:
            raise HTTPException(status_code=401, detail="invalid api key")

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"ok": True, "version": __version__}

    def _result_payload(
        result: Any,
        *,
        conversation_id: str = "",
        memory: dict[str, Any] | None = None,
        persisted: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "answer": result.answer,
            "citations": [asdict(citation) for citation in result.citations],
            "tool_trace": result.tool_trace,
            "rounds": result.rounds,
            "persisted": persisted,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if memory:
            payload["memory"] = memory
        return payload

    def _resolve_llm_settings(payload: AskInput) -> Settings:
        # Khi frontend gửi kèm LLM key/base/model theo request thì ghi đè cấu hình lúc khởi động;
        # cả ba để trống thì quay về env. Thiếu key thì báo lỗi ngay, tránh để đến khi gọi thượng nguồn mới nhận 401.
        api_key = (payload.llm_api_key or settings.llm_api_key).strip()
        if not api_key:
            raise HTTPException(status_code=400, detail="Thiếu LLM API Key: hãy nhập API Key của model trong phần cài đặt thông tin đăng nhập ở giao diện.")
        return replace(
            settings,
            llm_api_key=api_key,
            llm_base_url=(payload.llm_base_url or settings.llm_base_url).rstrip("/"),
            llm_model=payload.llm_model or settings.llm_model,
        )

    def _request_chat_fn(payload: AskInput):
        # Luồng không streaming: nếu request không ghi đè tham số LLM nào thì dùng lại chat_fn lúc khởi động (trả None).
        resolved = _resolve_llm_settings(payload)  # tiện thể kiểm tra thiếu key
        if not payload.llm_api_key and not payload.llm_base_url and not payload.llm_model:
            return None
        return build_deepseek_chat_fn(resolved)

    def _sse_events(payload: AskInput, resolved: Settings) -> Iterator[str]:
        # Vòng lặp agent là đồng bộ và chặn luồng, nên đặt vào thread riêng và đẩy sự kiện qua queue —
        # frontend thấy được cảm giác tiến trình "đang tìm kiếm…" ngay từ lần gọi tool đầu tiên (~2s);
        # vòng trả lời cuối đẩy answer_delta từng token qua on_delta.
        events: queue.Queue[dict[str, Any] | None] = queue.Queue()
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        # regenerate: ngữ cảnh dừng ở nút user; viết tiếp bình thường: đi theo đường head hiện tại
        memory_stop = (
            payload.parent_id.strip()
            if payload.regenerate and payload.parent_id.strip()
            else ""
        )
        history, compress_event, memory_debug, summary_id = prepare_memory(
            conversation_id,
            force_compress=bool(payload.force_compress),
            stop_at=memory_stop,
        )
        # Luồng SSE luôn dùng chat_fn streaming có on_delta: phần văn bản tăng thêm đi vào hàng đợi sự kiện.
        chat_fn = build_deepseek_chat_fn(
            resolved,
            on_delta=lambda text: events.put({"type": "answer_delta", "text": text}),
        )

        def run() -> None:
            try:
                if compress_event:
                    events.put(compress_event)
                result = agent.ask(
                    payload.question,
                    document_id=document_id,
                    job_id=payload.job_id.strip(),
                    on_event=events.put,
                    chat_fn=chat_fn,
                    history=history,
                )
                persisted = persist_turn(conversation_id, payload, result, chain_parent_id=summary_id)
                events.put(
                    {
                        "type": "done",
                        **_result_payload(
                            result,
                            conversation_id=conversation_id,
                            memory=memory_debug,
                            persisted=persisted,
                        ),
                    }
                )
            except Exception as exc:
                # RuntimeError là thông báo do chính ta tạo cho người dùng đọc (ví dụ _friendly_llm_error),
                # nên trả thẳng không kèm tên lớp ngoại lệ; các ngoại lệ khác giữ tên lớp để dễ truy vết
                message = str(exc) if isinstance(exc, RuntimeError) else f"{type(exc).__name__}: {exc}"
                events.put({"type": "error", "message": message})
            finally:
                events.put(None)

        threading.Thread(target=run, daemon=True).start()
        while True:
            event = events.get()
            if event is None:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    @app.post("/v1/ask", dependencies=[Depends(require_api_key)])
    def ask(payload: AskInput) -> Any:
        if payload.stream:
            # Ném HTTPException bên trong generator không chuyển thành 400 được, nên kiểm tra và dựng settings ngay tại đây
            resolved = _resolve_llm_settings(payload)
            return StreamingResponse(
                _sse_events(payload, resolved),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        chat_fn = _request_chat_fn(payload)
        document_id = resolve_document_id(payload)
        conversation_id = ensure_conversation_id(payload, document_id)
        memory_stop = (
            payload.parent_id.strip()
            if payload.regenerate and payload.parent_id.strip()
            else ""
        )
        history, _compress_event, memory_debug, summary_id = prepare_memory(
            conversation_id,
            force_compress=bool(payload.force_compress),
            stop_at=memory_stop,
        )
        result = agent.ask(
            payload.question,
            document_id=document_id,
            job_id=payload.job_id.strip(),
            chat_fn=chat_fn,
            history=history,
        )
        persisted = persist_turn(conversation_id, payload, result, chain_parent_id=summary_id)
        return {
            "code": 0,
            "message": "ok",
            "data": _result_payload(
                result,
                conversation_id=conversation_id,
                persisted=persisted,
                memory=memory_debug,
            ),
        }

    return app
