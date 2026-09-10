from __future__ import annotations

from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates


RENDER_PREWARM_DIR_NAME = "render_prewarm"
RENDER_PREWARM_MANIFEST_NAME = "render_source_prewarm_manifest.json"
RENDER_PREWARM_SCHEMA = "render_source_prewarm_v1"
BBOX_TEXT_STRIP_ALGORITHM_ID = "bbox_text_strip"
HIDDEN_TEXT_STRIP_ALGORITHM_VERSION = "hidden_text_strip_v1"
IMAGE_COMPRESSION_ALGORITHM_VERSION = "image_only_compress_v1"
FIRST_LINE_INDENT_ALGORITHM_VERSION = "first_line_indent_v3_pixmap_default"
GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION = "geometry_adjustments_v3_stale_merge_guard"
PAYLOAD_RENDER_ALGORITHM_VERSION = "payload_render_member_continuation_visual_profile_v19_abstract_bbox"


@dataclass(frozen=True)
class RenderPrewarmSpec:
    source_pdf_path: Path
    output_pdf_path: Path
    artifacts_dir: Path
    translated_pages: dict[int, list[dict]]
    render_mode: str
    start_page: int
    end_page: int
    pdf_compress_dpi: int
    source_cleanup_strategy: str = "pikepdf_text_strip"
    document_analysis: RenderDocumentAnalysis | None = None
    include_source_cleanup: bool = True


@dataclass(frozen=True)
class RenderPrewarmHandle:
    manifest_path: Path
    future: Future[Path | None] | None = None
    executor: ThreadPoolExecutor | None = None

    def wait(self) -> Path | None:
        try:
            return self.future.result() if self.future is not None else self.manifest_path
        finally:
            if self.executor is not None:
                self.executor.shutdown(wait=True, cancel_futures=False)


@dataclass(frozen=True)
class RenderPayloadPrewarm:
    first_line_indent_lookup: dict[str, float]
    effective_inner_bbox_lookup: dict[str, list[float]]
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None
    background_render_page_specs: list[RenderPageSpec] | None = None
    prepared_overlay_pages: dict[int, list[dict]] | None = None
    render_colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]] | None = None
    visual_profile_path: Path | None = None
    pdf_structure_profile_path: Path | None = None
    overlay_source_path: Path | None = None
    document_analysis: RenderDocumentAnalysis | None = None


def prewarm_manifest_path_from_artifacts_dir(artifacts_dir: Path) -> Path:
    return Path(artifacts_dir) / RENDER_PREWARM_DIR_NAME / RENDER_PREWARM_MANIFEST_NAME


def prewarm_manifest_path_from_translations_dir(translations_dir: Path | None) -> Path | None:
    if translations_dir is None:
        return None
    return prewarm_manifest_path_from_artifacts_dir(Path(translations_dir).parent / "artifacts")


__all__ = [
    "BBOX_TEXT_STRIP_ALGORITHM_ID",
    "FIRST_LINE_INDENT_ALGORITHM_VERSION",
    "GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION",
    "HIDDEN_TEXT_STRIP_ALGORITHM_VERSION",
    "IMAGE_COMPRESSION_ALGORITHM_VERSION",
    "PAYLOAD_RENDER_ALGORITHM_VERSION",
    "RENDER_PREWARM_SCHEMA",
    "RenderPayloadPrewarm",
    "RenderPrewarmHandle",
    "RenderPrewarmSpec",
    "prewarm_manifest_path_from_artifacts_dir",
    "prewarm_manifest_path_from_translations_dir",
]
