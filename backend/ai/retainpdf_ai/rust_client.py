"""Rust API 客户端:数据面只归 Rust 管,本服务经 HTTP 读。"""

from __future__ import annotations

from urllib.parse import quote

from typing import Any

import httpx

from .config import Settings


def _segment(value: object) -> str:
    """把一个值编码成**单个** URL 路径段。

    这里的路径原本是 f-string 直接拼的,而 `document_id` 在全库会话里是模型可控的
    （scope_tool_arguments 在没有 document scope 时原样透传）。httpx 会规范化 `..`,
    于是 `../internal/agent/runtime-sessions/X` 会把本服务的全权 key 打到
    `/api/v1/internal/...`——只能读不能写,但会话与文档的隔离边界就此失效,提示注入
    因此可以变成跨会话读取。`job_id` 早有格式白名单,`document_id` 漏了。

    编码而不是加白名单:漏的本来就是「没编码」这件事,而编码不会拒绝任何合法 id。
    `/` 和 `?` 都被转义,值再怎么写也跳不出自己这一段。
    """
    return quote(str(value or ""), safe="")


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
        return self._get(f"/api/v1/documents/{_segment(document_id)}")

    def get_document_reading(self, document_id: str) -> dict[str, Any]:
        """这本书该读哪个任务：一个任务覆盖整本就是它，多次范围翻译就是合并结果的虚拟 id。"""
        return self._get(f"/api/v1/documents/{_segment(document_id)}/reading")

    def get_document_by_job(self, job_id: str) -> dict[str, Any] | None:
        """任意 job_id(含历史 run)→ 所属文档;查不到返回 None。"""
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
            return self._get(f"/api/v1/ai/conversations/{_segment(conversation_id)}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise

    def list_agent_operations(
        self,
        conversation_id: str,
        *,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Read the browser-safe authoritative operation projection for a chat."""
        normalized = conversation_id.strip()
        if not normalized:
            return []
        data = self._get(
            f"/api/v1/ai/conversations/{_segment(normalized)}/operations",
            {"limit": max(1, min(int(limit), 100))},
        )
        return [item for item in list(data.get("operations") or []) if isinstance(item, dict)]

    def create_conversation(
        self,
        *,
        title: str = "",
        document_id: str = "",
    ) -> dict[str, Any]:
        """创建会话;document_id 可空(全库会话)。返回含 conversation_id 的记录。"""
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
        finish_reason: str = "",
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
        # 正常答完时整个字段不发:"完整"是默认,旧服务端也认不出这个键。
        reason = (finish_reason or "").strip()
        if reason:
            payload["finish_reason"] = reason
        return self._post(
            f"/api/v1/ai/conversations/{_segment(conversation_id)}/messages",
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
            f"/api/v1/ai/conversations/{_segment(conversation_id)}",
            payload,
        )

    def get_agent_runtime_session(self, conversation_id: str) -> dict[str, Any]:
        return self._get(
            f"/api/v1/internal/agent/runtime-sessions/{_segment(conversation_id)}"
        )

    def put_agent_runtime_session(
        self,
        conversation_id: str,
        *,
        runtime_id: str,
        session_cursor: str,
        expected_revision: int,
    ) -> dict[str, Any]:
        response = self._client.put(
            f"{self._base}/api/v1/internal/agent/runtime-sessions/{conversation_id}",
            json={
                "schema": "agent_runtime_session_put_v1",
                "runtime_id": runtime_id,
                "session_cursor": session_cursor,
                "expected_revision": expected_revision,
            },
        )
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 0:
            raise RuntimeError(
                "rust api error while storing agent runtime session: "
                f"{body.get('message')}"
            )
        return body.get("data") or {}

    def clear_agent_runtime_session(
        self,
        conversation_id: str,
        *,
        expected_revision: int,
    ) -> dict[str, Any]:
        response = self._client.request(
            "DELETE",
            f"{self._base}/api/v1/internal/agent/runtime-sessions/{conversation_id}",
            json={
                "schema": "agent_runtime_session_clear_v1",
                "expected_revision": expected_revision,
            },
        )
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 0:
            raise RuntimeError(
                "rust api error while clearing agent runtime session: "
                f"{body.get('message')}"
            )
        return body.get("data") or {}

    def issue_agent_capability(
        self,
        *,
        conversation_id: str,
        document_id: str,
        actions: list[str],
        ttl_seconds: int = 60,
        job_id: str = "",
    ) -> dict[str, Any]:
        """Mint one short-lived capability for the host-side agent CLI.

        `job_id` 非空时签的是任务级 capability（终端里的译文精修命令）：
        不绑会话和文档，Rust 侧也只允许任务级动作。
        """
        if job_id:
            payload: dict[str, Any] = {
                "schema": "agent_capability_issue_v1",
                "job_id": job_id,
                "actions": actions,
                "ttl_seconds": ttl_seconds,
            }
        else:
            payload = {
                "schema": "agent_capability_issue_v1",
                "conversation_id": conversation_id,
                "document_id": document_id,
                "actions": actions,
                "ttl_seconds": ttl_seconds,
            }
        return self._post("/api/v1/internal/agent/capabilities", payload)

    def create_agent_calculation(
        self,
        *,
        calculation_id: str,
        conversation_id: str,
        request_message_id: str,
        document_id: str,
        job_id: str,
        tool_name: str,
        tool_call_id: str,
        input_refs: dict[str, Any],
        input_sha256: str,
    ) -> dict[str, Any]:
        """Create or replay one durable safe-calculation identity."""
        return self._post(
            "/api/v1/internal/agent/calculations",
            {
                "schema": "agent_calculation_create_v1",
                "calculation_id": calculation_id,
                "conversation_id": conversation_id,
                "request_message_id": request_message_id,
                "document_id": document_id,
                "job_id": job_id,
                "tool_name": tool_name,
                "tool_call_id": tool_call_id,
                "input_refs": input_refs,
                "input_sha256": input_sha256,
            },
        )

    def complete_agent_calculation(
        self,
        calculation_id: str,
        *,
        result: dict[str, Any],
        artifacts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return self._post(
            f"/api/v1/internal/agent/calculations/{_segment(calculation_id)}/complete",
            {
                "schema": "agent_calculation_complete_v1",
                "result": result,
                "artifacts": artifacts,
            },
        )

    def fail_agent_calculation(
        self,
        calculation_id: str,
        *,
        code: str,
        message: str,
    ) -> dict[str, Any]:
        return self._post(
            f"/api/v1/internal/agent/calculations/{_segment(calculation_id)}/fail",
            {
                "schema": "agent_calculation_fail_v1",
                "code": code,
                "message": message,
            },
        )

    def get_agent_calculation(self, calculation_id: str) -> dict[str, Any]:
        return self._get(f"/api/v1/ai/calculations/{_segment(calculation_id)}")

    def list_agent_calculations(
        self, conversation_id: str, *, limit: int = 50, offset: int = 0
    ) -> dict[str, Any]:
        return self._get(
            f"/api/v1/ai/conversations/{_segment(conversation_id)}/calculations",
            {"limit": max(1, min(int(limit), 100)), "offset": max(0, int(offset))},
        )
