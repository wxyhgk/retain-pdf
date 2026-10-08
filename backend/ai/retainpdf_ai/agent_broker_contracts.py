"""Shared contracts for the host-owned Agent command broker."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class CapabilityIssuer(Protocol):
    def issue_agent_capability(
        self,
        *,
        conversation_id: str,
        document_id: str,
        actions: list[str],
        ttl_seconds: int,
        job_id: str = "",
    ) -> dict[str, Any]: ...


class BrokerUsageError(ValueError):
    """解析失败，且原因可以原样告诉 agent。

    普通 ValueError 在 broker 里统一回「invalid broker request」—— 那是有意的，
    别把宿主细节漏给模型。但「需要用户确认」「页码写错了」这类原因模型必须看到，
    否则它只会换着花样重试。只有这个子类的消息会被透传。
    """


@dataclass(frozen=True)
class BrokerScope:
    conversation_id: str
    document_id: str
    request_message_id: str
    intent_summary: str
    job_id: str = ""
    confirmed: bool = False
    green_light: bool = False

    @property
    def effects_allowed(self) -> bool:
        return self.confirmed or self.green_light


@dataclass(frozen=True)
class BrokerCommand:
    public_argv: tuple[str, ...]
    action: str
    cli_argv: tuple[str, ...]
    request_payload: dict[str, Any] | None = None
