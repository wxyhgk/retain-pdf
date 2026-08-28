"""Client của Rust API: tầng dữ liệu chỉ do Rust quản lý, dịch vụ này đọc qua HTTP."""

from __future__ import annotations

from typing import Any

import httpx

from .config import Settings


class RustApiClient:
    def __init__(self, settings: Settings, client: httpx.Client | None = None) -> None:
        self._base = settings.rust_api_base
        self._client = client or httpx.Client(
            timeout=10.0,
            headers={"X-API-Key": settings.rust_api_key},
        )

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self._client.get(f"{self._base}{path}", params=params or {})
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != 0:
            raise RuntimeError(f"rust api error on {path}: {payload.get('message')}")
        return payload.get("data") or {}

    def search_fulltext(
        self,
        query: str,
        limit: int = 20,
        *,
        document_id: str = "",
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"q": query, "limit": limit}
        doc = document_id.strip()
        if doc:
            params["document_id"] = doc
        data = self._get("/api/v1/search", params)
        return list(data.get("hits") or [])

    def list_documents(
        self,
        *,
        tag: str = "",
        reading_status: str = "",
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": limit}
        if tag:
            params["tag"] = tag
        if reading_status:
            params["reading_status"] = reading_status
        data = self._get("/api/v1/documents", params)
        return list(data.get("documents") or [])

    def get_document(self, document_id: str) -> dict[str, Any]:
        return self._get(f"/api/v1/documents/{document_id}")

    def get_document_by_job(self, job_id: str) -> dict[str, Any] | None:
        """Bất kỳ job_id nào (kể cả run cũ) → tài liệu tương ứng; không tìm thấy thì trả None."""
        data = self._get("/api/v1/documents", {"job_id": job_id})
        documents = list(data.get("documents") or [])
        return documents[0] if documents else None

    def list_favorites(self, document_id: str = "") -> list[dict[str, Any]]:
        params = {"document_id": document_id} if document_id else None
        data = self._get("/api/v1/favorites", params)
        return list(data.get("favorites") or [])

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(f"{self._base}{path}", json=payload)
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 0:
            raise RuntimeError(f"rust api error on {path}: {body.get('message')}")
        return body.get("data") or {}

    def _patch(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._client.patch(f"{self._base}{path}", json=payload)
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 0:
            raise RuntimeError(f"rust api error on {path}: {body.get('message')}")
        return body.get("data") or {}

    def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        try:
            return self._get(f"/api/v1/ai/conversations/{conversation_id}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise

    def create_conversation(
        self,
        *,
        title: str = "",
        document_id: str = "",
    ) -> dict[str, Any]:
        """Tạo phiên hội thoại; document_id có thể rỗng (phiên trên toàn thư viện). Trả về bản ghi có conversation_id."""
        payload: dict[str, Any] = {"title": (title or "").strip()}
        doc = (document_id or "").strip()
        if doc:
            payload["document_id"] = doc
        return self._post("/api/v1/ai/conversations", payload)

    def append_conversation_message(
        self,
        conversation_id: str,
        *,
        role: str,
        content: str,
        citations_json: str = "",
        tool_trace_json: str = "",
        model: str = "",
        parent_id: str = "",
        message_id: str = "",
        set_head: bool = True,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "role": role,
            "content": content,
            "citations_json": citations_json,
            "tool_trace_json": tool_trace_json,
            "model": model,
            "set_head": set_head,
        }
        pid = (parent_id or "").strip()
        if pid:
            payload["parent_id"] = pid
        mid = (message_id or "").strip()
        if mid:
            payload["message_id"] = mid
        return self._post(
            f"/api/v1/ai/conversations/{conversation_id}/messages",
            payload,
        )

    def patch_conversation(
        self,
        conversation_id: str,
        *,
        head_id: str = "",
        title: str = "",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if (head_id or "").strip():
            payload["head_id"] = head_id.strip()
        if (title or "").strip():
            payload["title"] = title.strip()
        return self._patch(
            f"/api/v1/ai/conversations/{conversation_id}",
            payload,
        )
