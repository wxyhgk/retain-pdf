"""不要完整版式 payload 的路线（rpr_fit）只算底色 / 字色。

与 payload 预热里同一条路：版式几何 → 预备条目（覆盖框）→ visual_profile 准备步骤；对外格式
的文件硬链接到原来 prewarm 写的位置（引擎输入里的路径不变）。失败时返回 None：引擎没有
visual_profile 也能排，只是底色按白、字色按黑（与 no_cache 时一样）。
"""

from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.visual_profile import PUBLIC_OUTPUT
from retainpdf_pipeline.render.prepare.visual_profile import run_visual_profile
from retainpdf_pipeline.render.source.intermediate_paths import link_or_copy_file
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_geometry


def build_route_visual_profile(
    *,
    prepare_dir: Path,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    target_path: Path,
) -> Path | None:
    try:
        _seeded, indents, inner_bboxes, _stats = build_payload_geometry(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
        )
        prepared = prepare_translated_pages_for_render(
            source_pdf_path,
            translated_pages,
            first_line_indent_lookup=indents,
            effective_inner_bbox_lookup=inner_bboxes,
        )
        _profile, record = run_visual_profile(PrepareStore(prepare_dir), source_pdf_path=source_pdf_path, pages=prepared)
        link_or_copy_file(record.output(PUBLIC_OUTPUT), target_path)
        return target_path
    except Exception as exc:  # noqa: BLE001 - 底色 / 字色缺失不致命
        print(f"render route visual profile: failed {type(exc).__name__}: {exc}", flush=True)
        return None


__all__ = ["build_route_visual_profile"]
