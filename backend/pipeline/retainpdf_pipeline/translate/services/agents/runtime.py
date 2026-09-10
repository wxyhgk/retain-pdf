from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope

from retainpdf_pipeline.translate.services.agents.contracts import AgentRunContext
from retainpdf_pipeline.translate.services.agents.contracts import LLMResult
from retainpdf_pipeline.translate.services.agents.contracts import LLMTask


AgentRequestFn = Callable[..., str]


@dataclass(frozen=True)
class AgentPlan:
    plan_id: str
    tasks: list[LLMTask]
    metadata: dict[str, object] | None = None


@dataclass(frozen=True)
class AgentPlanResult:
    plan_id: str
    results: list[LLMResult]
    metadata: dict[str, object] | None = None

    @property
    def success(self) -> bool:
        return all(result.success for result in self.results)


class TranslationAgentRuntime:
    """Executes LLM-backed agent tasks through the active translation provider."""

    def __init__(
        self,
        *,
        api_key: str = "",
        context: AgentRunContext | None = None,
        request_chat_content_fn: AgentRequestFn | None = None,
    ):
        self.api_key = api_key
        self.context = context or AgentRunContext()
        self._request_chat_content_fn = request_chat_content_fn

    def execute_task(self, task: LLMTask) -> LLMResult:
        request_fn = self._request_chat_content_fn or _default_request_chat_content
        model = task.model or self.context.model
        base_url = task.base_url or self.context.base_url
        request_label = _request_label(task)
        try:
            with unit_scope("agent", [task.agent, task.task_id]):
                content = request_fn(
                    task.messages,
                    api_key=self.api_key,
                    model=model,
                    base_url=base_url,
                    response_format=task.response_format,
                    timeout=task.timeout_s,
                    request_label=request_label,
                )
        except Exception as exc:
            return LLMResult(
                task_id=task.task_id,
                agent=task.agent,
                success=False,
                error=f"{type(exc).__name__}: {exc}",
                metadata={
                    **task.metadata,
                    "model": model,
                    "base_url": base_url,
                    "request_label": request_label,
                },
            )
        return LLMResult(
            task_id=task.task_id,
            agent=task.agent,
            content=content,
            success=True,
            metadata={
                **task.metadata,
                "model": model,
                "base_url": base_url,
                "request_label": request_label,
            },
        )

    def execute_plan(self, plan: AgentPlan) -> AgentPlanResult:
        return AgentPlanResult(
            plan_id=plan.plan_id,
            results=[self.execute_task(task) for task in plan.tasks],
            metadata=plan.metadata,
        )


def _default_request_chat_content(*args, **kwargs) -> str:
    from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content

    return request_chat_content(*args, **kwargs)


def _request_label(task: LLMTask) -> str:
    item_id = str(task.metadata.get("item_id", "") or "")
    if item_id:
        return f"agent:{task.agent}:{item_id}"
    return f"agent:{task.agent}:{task.task_id}"


__all__ = [
    "AgentPlan",
    "AgentPlanResult",
    "AgentRequestFn",
    "TranslationAgentRuntime",
]
