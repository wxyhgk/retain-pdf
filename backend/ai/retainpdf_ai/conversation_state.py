"""Durable conversation state coordination for AI request turns."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Protocol

from .api_contracts import AskInput
from .config import Settings
from .conversation_tree import transcript_from_detail
from .memory import assemble_history, maybe_compress_transcript
from .runtimes.contracts import AgentRuntime


class ConversationStore(Protocol):
    def get_document_by_job(self, job_id: str) -> dict[str, Any] | None: ...

    def create_conversation(
        self, *, title: str = "", document_id: str = ""
    ) -> dict[str, Any]: ...

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None: ...

    def append_conversation_message(
        self,
        conversation_id: str,
        *,
        role: str,
        content: str,
        **kwargs: Any,
    ) -> dict[str, Any]: ...


class ConversationState:
    def __init__(
        self,
        settings: Settings,
        store: ConversationStore | None,
    ) -> None:
        self._settings = settings
        self._store = store

    def resolve_document_id(self, payload: AskInput) -> str:
        document_id = payload.document_id.strip()
        if document_id or not payload.job_id.strip() or self._store is None:
            return document_id
        try:
            document = self._store.get_document_by_job(payload.job_id.strip())
        except Exception:  # noqa: BLE001 - missing lookup degrades to no document scope
            return ""
        return str((document or {}).get("document_id") or "")

    def ensure_conversation_id(self, payload: AskInput, document_id: str) -> str:
        existing = payload.conversation_id.strip()
        if existing:
            return existing
        if self._store is None:
            return ""
        title = (payload.question or "").strip().replace("\n", " ")
        if len(title) > 48:
            title = f"{title[:48].rstrip()}…"
        if not title:
            title = "阅读问答"
        try:
            created = self._store.create_conversation(
                title=title, document_id=document_id or ""
            )
            return str((created or {}).get("conversation_id") or "").strip()
        except Exception as exc:  # noqa: BLE001 - conversation storage is optional
            print(f"[retainpdf-ai] auto-create conversation failed: {exc}", flush=True)
            return ""

    def load_transcript(
        self,
        conversation_id: str,
        *,
        stop_at: str = "",
    ) -> list[dict[str, Any]]:
        if not conversation_id or self._store is None:
            return []
        try:
            detail = self._store.get_conversation(conversation_id) or {}
        except Exception:  # noqa: BLE001 - unavailable history degrades to empty
            return []
        return transcript_from_detail(detail, stop_at=stop_at)

    def prepare_memory(
        self,
        conversation_id: str,
        *,
        force_compress: bool = False,
        stop_at: str = "",
    ) -> tuple[list[dict[str, str]], dict[str, Any] | None, dict[str, Any], str]:
        """Assemble history and durably attach an optional extractive summary."""
        transcript = self.load_transcript(conversation_id, stop_at=stop_at)
        compress = maybe_compress_transcript(
            transcript,
            window_turns=self._settings.memory_window_turns,
            compress_after_turns=self._settings.memory_compress_after_turns,
            force=force_compress,
        )
        compress_event: dict[str, Any] | None = None
        summary_id = ""
        working = compress.messages
        if (
            compress.compressed
            and compress.summary_message
            and conversation_id
            and self._store is not None
        ):
            try:
                summary_message = self._store.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=str(compress.summary_message.get("content") or ""),
                    model="memory/extractive_v1",
                    parent_id=stop_at or "",
                    set_head=False,
                )
                summary_id = str(
                    (summary_message or {}).get("message_id") or ""
                ).strip()
                compress_event = compress.event
            except Exception as exc:  # noqa: BLE001 - memory persistence is best effort
                print(f"[retainpdf-ai] persist summary failed: {exc}", flush=True)
        assembled = assemble_history(
            working,
            window_turns=self._settings.memory_window_turns,
            max_chars=self._settings.memory_max_chars,
        )
        debug = {
            **assembled.debug,
            "compressed": bool(compress.compressed and compress_event is not None),
            "evidence_count": 0,
        }
        return assembled.history, compress_event, debug, summary_id

    def persist_turn(
        self,
        conversation_id: str,
        payload: AskInput,
        result: Any,
        request_runtime: AgentRuntime,
        *,
        chain_parent_id: str = "",
        prepersisted_user_id: str = "",
    ) -> bool:
        """Best-effort durable write of the user/assistant turn."""
        if not conversation_id or self._store is None:
            return True
        try:
            parent_hint = chain_parent_id.strip() or payload.parent_id.strip()
            citations_json = json.dumps(
                [asdict(citation) for citation in result.citations],
                ensure_ascii=False,
            )
            tool_trace_json = json.dumps(result.tool_trace, ensure_ascii=False)
            model = (
                self._settings.fx_model or request_runtime.runtime_id
                if request_runtime.capabilities.model_transport == "runtime_managed"
                else payload.llm_model or self._settings.llm_model
            )
            if payload.regenerate:
                self._store.append_conversation_message(
                    conversation_id,
                    role="assistant",
                    content=result.answer,
                    citations_json=citations_json,
                    tool_trace_json=tool_trace_json,
                    model=model,
                    parent_id=parent_hint,
                    message_id=payload.assistant_message_id.strip(),
                    set_head=True,
                )
                return True
            user_id = prepersisted_user_id.strip()
            if not user_id:
                user_message = self._store.append_conversation_message(
                    conversation_id,
                    role="user",
                    content=payload.question.strip(),
                    parent_id=parent_hint,
                    message_id=payload.user_message_id.strip(),
                    set_head=True,
                )
                user_id = str((user_message or {}).get("message_id") or "").strip()
            self._store.append_conversation_message(
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
        except Exception as exc:  # noqa: BLE001 - answer remains usable
            print(f"[retainpdf-ai] persist conversation turn failed: {exc}", flush=True)
            return False

    def persist_agent_request_message(
        self,
        conversation_id: str,
        payload: AskInput,
        request_runtime: AgentRuntime,
        *,
        chain_parent_id: str = "",
    ) -> tuple[str, bool]:
        """Persist the user request before durable Agent tools can run."""
        if not (
            request_runtime.capabilities.document_operations
            or request_runtime.capabilities.durable_calculations
        ):
            return "", True
        parent_hint = chain_parent_id.strip() or payload.parent_id.strip()
        if payload.regenerate:
            return parent_hint, bool(parent_hint)
        if not conversation_id or self._store is None:
            return "", False
        requested_id = payload.user_message_id.strip()
        try:
            user_message = self._store.append_conversation_message(
                conversation_id,
                role="user",
                content=payload.question.strip(),
                parent_id=parent_hint,
                message_id=requested_id,
                set_head=True,
            )
            message_id = str((user_message or {}).get("message_id") or "").strip()
            return message_id, bool(message_id)
        except Exception as exc:  # noqa: BLE001 - retry covers transport ambiguity
            if requested_id and self._matches_existing_request(
                conversation_id, requested_id, payload.question
            ):
                return requested_id, True
            print(f"[retainpdf-ai] pre-persist Agent request failed: {exc}", flush=True)
            return "", False

    def _matches_existing_request(
        self,
        conversation_id: str,
        requested_id: str,
        question: str,
    ) -> bool:
        if self._store is None:
            return False
        try:
            detail = self._store.get_conversation(conversation_id) or {}
            return any(
                str(message.get("message_id") or "") == requested_id
                and str(message.get("role") or "") == "user"
                and str(message.get("content") or "").strip() == question.strip()
                for message in detail.get("messages") or []
            )
        except Exception:  # noqa: BLE001 - preserve the original write failure
            return False
