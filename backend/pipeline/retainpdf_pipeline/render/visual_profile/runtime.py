from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import ItemVisualProfile
from retainpdf_pipeline.render.visual_profile.io import read_document_visual_profile


RenderColorProfile = dict[str, dict[str, tuple[float, float, float]]]


@dataclass(frozen=True)
class VisualProfileRuntime:
    path: Path | None
    profile: DocumentVisualProfile | None
    diagnostics: dict[str, object]

    @property
    def loaded(self) -> bool:
        return self.profile is not None and bool(self.profile.pages)

    def item(self, item_id: str) -> ItemVisualProfile | None:
        if self.profile is None:
            return None
        for page in self.profile.pages.values():
            item = page.items.get(item_id)
            if item is not None:
                return item
        return None

    def colors_by_item_id(self) -> RenderColorProfile:
        if self.profile is None:
            return {}
        colors: RenderColorProfile = {}
        for page in self.profile.pages.values():
            for item_id, item in page.items.items():
                colors[item_id] = {
                    "cover_fill": item.background_rgb,
                    "text_color": item.text_rgb,
                }
        return colors

    def background_fill_for_item_id(self, item_id: str) -> tuple[float, float, float] | None:
        item = self.item(item_id)
        return item.background_rgb if item is not None else None

    def text_color_for_item_id(self, item_id: str) -> tuple[float, float, float] | None:
        item = self.item(item_id)
        return item.text_rgb if item is not None else None

    def background_fill_for_item(self, item: dict) -> tuple[float, float, float] | None:
        for key in ("source_item_id", "item_id", "block_id"):
            item_id = str(item.get(key) or "")
            if not item_id:
                continue
            fill = self.background_fill_for_item_id(item_id)
            if fill is not None:
                return fill
        return None


def load_visual_profile_runtime(path: Path | None) -> VisualProfileRuntime:
    if path is None:
        return VisualProfileRuntime(
            path=None,
            profile=None,
            diagnostics={"loaded": False, "reason": "missing_path"},
        )
    if not Path(path).exists():
        return VisualProfileRuntime(
            path=Path(path),
            profile=None,
            diagnostics={"loaded": False, "reason": "file_missing", "path": str(path)},
        )
    profile = read_document_visual_profile(Path(path))
    if profile is None:
        return VisualProfileRuntime(
            path=Path(path),
            profile=None,
            diagnostics={"loaded": False, "reason": "read_failed", "path": str(path)},
        )
    item_count = sum(len(page.items) for page in profile.pages.values())
    return VisualProfileRuntime(
        path=Path(path),
        profile=profile,
        diagnostics={
            "loaded": True,
            "path": str(path),
            "page_count": len(profile.pages),
            "item_count": item_count,
            "algorithm": profile.algorithm,
        },
    )


def merge_visual_profile_colors(
    *,
    visual_profile_path: Path | None,
    precomputed_colors_by_item_id: RenderColorProfile | None = None,
) -> tuple[RenderColorProfile | None, dict[str, object]]:
    runtime = load_visual_profile_runtime(visual_profile_path)
    colors = dict(precomputed_colors_by_item_id or {})
    profile_colors = runtime.colors_by_item_id()
    if profile_colors:
        colors.update(profile_colors)
    return (colors or None), runtime.diagnostics
