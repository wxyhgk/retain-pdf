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
    ) -> dict[str, Any]: ...


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
