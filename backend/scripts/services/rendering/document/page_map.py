from __future__ import annotations

from dataclasses import dataclass

from services.rendering.layout.model.models import RenderPageSpec


@dataclass(frozen=True)
class RenderPageMap:
    source_page_indices: list[int]

    @classmethod
    def from_page_specs(cls, page_specs: list[RenderPageSpec]) -> "RenderPageMap":
        return cls(source_page_indices=[spec.page_index for spec in page_specs])

    def target_page_for_source(self, source_page_index: int) -> int | None:
        try:
            return self.source_page_indices.index(source_page_index) + 1
        except ValueError:
            return None
