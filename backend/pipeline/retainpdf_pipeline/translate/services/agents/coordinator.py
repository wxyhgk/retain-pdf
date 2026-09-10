from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from retainpdf_pipeline.translate.services.agents.terminology import TerminologyAgent
from retainpdf_pipeline.translate.services.agents.reviewer import ConsistencyReviewerAgent
from retainpdf_pipeline.translate.services.agents.reviewer import TranslationReviewResult
from retainpdf_pipeline.translate.services.agents.repair import RepairAgent
from retainpdf_pipeline.translate.services.agents.repair import TranslationRepairRequest
from retainpdf_pipeline.translate.services.agents.repair import TranslationRepairResult
from retainpdf_pipeline.translate.services.agents.runtime import TranslationAgentRuntime

if TYPE_CHECKING:
    from collections.abc import Iterable

    from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext


class TranslationAgentCoordinator:
    def __init__(
        self,
        *,
        terminology_agent: TerminologyAgent | None = None,
        reviewer_agent: ConsistencyReviewerAgent | None = None,
        repair_agent: RepairAgent | None = None,
    ):
        self.terminology_agent = terminology_agent
        self.reviewer_agent = reviewer_agent
        self.repair_agent = repair_agent

    @classmethod
    def from_control_context(cls, context: "TranslationControlContext") -> "TranslationAgentCoordinator":
        scoped_context = context.scoped_to_source_texts([])
        glossary_entries = list(scoped_context.glossary_entries or [])
        return cls(
            terminology_agent=TerminologyAgent(glossary_entries),
            reviewer_agent=ConsistencyReviewerAgent(glossary_entries),
            repair_agent=RepairAgent(glossary_entries=glossary_entries),
        )

    def scope_context_to_source_texts(
        self,
        context: "TranslationControlContext",
        texts: "Iterable[str]",
    ) -> "TranslationControlContext":
        text_list = [text for text in texts if text]
        if not text_list or self.terminology_agent is None:
            return context
        matched = self.terminology_agent.match_source_texts(text_list)
        if len(matched.entries) == len(context.glossary_entries):
            return context
        return replace(context, glossary_entries=matched.entries)

    def review_batch(
        self,
        batch: list[dict],
        result: dict[str, dict[str, str]],
    ) -> TranslationReviewResult:
        reviewer = self.reviewer_agent or ConsistencyReviewerAgent()
        return reviewer.review_batch(batch, result)

    def build_repair_task(
        self,
        request: TranslationRepairRequest,
        *,
        model: str = "",
        base_url: str = "",
        timeout_s: int = 70,
    ):
        repair_agent = self.repair_agent or RepairAgent()
        return repair_agent.build_task(request, model=model, base_url=base_url, timeout_s=timeout_s)

    def parse_repair_result(self, *, item_id: str, content: str) -> TranslationRepairResult:
        repair_agent = self.repair_agent or RepairAgent()
        return repair_agent.parse_result(item_id=item_id, content=content)

    def run_repair(
        self,
        request: TranslationRepairRequest,
        *,
        runtime: TranslationAgentRuntime,
        model: str = "",
        base_url: str = "",
        timeout_s: int = 70,
    ) -> TranslationRepairResult:
        task = self.build_repair_task(
            request,
            model=model,
            base_url=base_url,
            timeout_s=timeout_s,
        )
        result = runtime.execute_task(task)
        if not result.success:
            raise RuntimeError(result.error or f"agent task failed: {task.task_id}")
        return self.parse_repair_result(
            item_id=str(task.metadata.get("item_id", "") or ""),
            content=result.content,
        )


__all__ = [
    "TranslationAgentCoordinator",
]
