from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from typing import Any


@dataclass(frozen=True)
class LLMTask:
    task_id: str
    agent: str
    messages: list[dict[str, str]]
    model: str = ""
    base_url: str = ""
    response_format: dict[str, Any] | None = None
    timeout_s: int = 120
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class LLMResult:
    task_id: str
    agent: str
    content: str = ""
    success: bool = True
    error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentRunContext:
    job_id: str = ""
    model: str = ""
    base_url: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


__all__ = [
    "AgentRunContext",
    "LLMResult",
    "LLMTask",
]
