from __future__ import annotations

from dataclasses import dataclass
from typing import Callable
from typing import Mapping

import fitz


ProfileCollector = Callable[[fitz.Page, Mapping[str, object]], object]


@dataclass(frozen=True)
class PageProfileCollectorSpec:
    name: str
    collect: ProfileCollector


class PageProfileRegistry:
    def __init__(self, collectors: list[PageProfileCollectorSpec] | None = None) -> None:
        self._collectors = list(collectors or [])

    def register(self, name: str, collect: ProfileCollector) -> "PageProfileRegistry":
        return PageProfileRegistry([*self._collectors, PageProfileCollectorSpec(name=name, collect=collect)])

    def collect(self, page: fitz.Page, context: Mapping[str, object] | None = None) -> dict[str, object]:
        resolved_context = context or {}
        return {spec.name: spec.collect(page, resolved_context) for spec in self._collectors}


EMPTY_PAGE_PROFILE_REGISTRY = PageProfileRegistry()
