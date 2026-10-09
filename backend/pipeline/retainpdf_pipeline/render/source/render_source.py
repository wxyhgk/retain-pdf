from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import tempfile
import time

from retainpdf_pipeline.render.source.compression.pdf_copy import build_image_compressed_pdf_copy
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.contracts.prepare_hooks import RenderPrepareHooks
from retainpdf_pipeline.render.source.intermediate_paths import intermediate_pdf_path
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source.preparation.hidden_text_strip import build_hidden_text_stripped_pdf_copy
from retainpdf_pipeline.render.source.preparation.xobject_sanitize import build_invalid_xobject_sanitized_pdf_copy
from retainpdf_pipeline.render.source_cleanup import SourceCleanupOptions
from retainpdf_pipeline.render.source_cleanup import SourceCleanupRequest
from retainpdf_pipeline.render.source_cleanup import execute_source_cleanup
from retainpdf_pipeline.render.output.typst.shared import default_typst_temp_root
from retainpdf_pipeline.render.policy import source_cleanup_max_seconds
from retainpdf_pipeline.foundation.config import layout


@dataclass(frozen=True)
class RenderSourcePdf:
    path: Path
    temp_paths: list[Path]
    image_compressed: bool = False
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()
    source_cleanup_cover_fallback_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None
    document_analysis: RenderDocumentAnalysis | None = None


@dataclass(frozen=True)
class RenderSourceBase:
    """渲染源的底子：原 PDF 修掉非法 XObject、去掉隐藏文字层之后的样子（只依赖原 PDF）。

    path 为 None 表示两步都没有改动，直接用原 PDF。
    """

    path: Path | None
    xobject_sanitized: bool = False
    hidden_text_stripped: bool = False
    cached: bool = False  # 来自准备步骤的缓存：只能链接 / 复制，不能挪走或删除


# (source_pdf_path, *, strip_hidden_text, start_page, end_page) -> RenderSourceBase
RenderSourceBaseBuilder = Callable[..., RenderSourceBase]


def build_render_source_base(
    source_pdf_path: Path,
    *,
    strip_hidden_text: bool,
    start_page: int,
    end_page: int,
    work_dir: Path,
    output_name: str = "base.pdf",
) -> RenderSourceBase:
    """在 work_dir 里做出底子，产物是 work_dir/output_name（先写临时文件再替换，旧文件的硬链接不受影响）。"""
    work_dir.mkdir(parents=True, exist_ok=True)
    current = Path(source_pdf_path)
    scratch: list[Path] = []
    sanitized = False
    hidden_stripped = False
    try:
        sanitize_started = time.perf_counter()
        sanitized_path = work_dir / f".{output_name}.sanitized.tmp.pdf"
        scratch.append(sanitized_path)
        sanitize_result = build_invalid_xobject_sanitized_pdf_copy(
            source_pdf_path=current,
            output_pdf_path=sanitized_path,
        )
        print(f"render source pdf: invalid-xobject sanitize elapsed={time.perf_counter() - sanitize_started:.2f}s", flush=True)
        if sanitize_result.changed and sanitize_result.output_pdf_path is not None:
            current = sanitize_result.output_pdf_path
            sanitized = True
        if strip_hidden_text:
            hidden_started = time.perf_counter()
            hidden_path = work_dir / f".{output_name}.hidden.tmp.pdf"
            scratch.append(hidden_path)
            hidden_text_result = build_hidden_text_stripped_pdf_copy(
                current,
                hidden_path,
                start_page=start_page,
                end_page=end_page,
            )
            print(f"render source pdf: hidden-text strip elapsed={time.perf_counter() - hidden_started:.2f}s", flush=True)
            if hidden_text_result.changed and hidden_text_result.output_pdf_path is not None:
                current = hidden_text_result.output_pdf_path
                hidden_stripped = True
        else:
            print("render source pdf: hidden-text strip skipped", flush=True)
        if not (sanitized or hidden_stripped):
            return RenderSourceBase(path=None)
        output = work_dir / output_name
        os.replace(current, output)
        return RenderSourceBase(path=output, xobject_sanitized=sanitized, hidden_text_stripped=hidden_stripped)
    finally:
        for path in scratch:
            path.unlink(missing_ok=True)


def _link_or_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.unlink(missing_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copyfile(source, target)


def build_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    translated_pages: dict[int, list[dict]] | None = None,
    protected_pages: dict[int, list[dict]] | None = None,
    strip_hidden_text: bool = True,
    start_page: int = 0,
    end_page: int = -1,
    artifact_mode: bool = False,
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None,
    source_cleanup_strategy: str = "pikepdf_text_strip",
    document_analysis: RenderDocumentAnalysis | None = None,
    pdf_structure_profile_path: Path | None = None,
    prepare_hooks: RenderPrepareHooks | None = None,
) -> RenderSourcePdf:
    temp_paths: list[Path] = []
    typst_temp_root = default_typst_temp_root(output_pdf_path)
    work_root = output_pdf_path.parent if artifact_mode else typst_temp_root
    bbox_text_stripped_page_indices: frozenset[int] = frozenset()
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset()
    source_text_precleaned_page_indices: frozenset[int] = frozenset()
    source_cleanup_cover_fallback_page_indices: frozenset[int] = frozenset()
    hidden_text_page_indices = document_analysis.hidden_text_strip_page_indices if document_analysis is not None else frozenset()
    base_options = {
        "strip_hidden_text": bool(strip_hidden_text and hidden_text_page_indices),
        "start_page": start_page,
        "end_page": end_page,
    }
    base_work_dir: Path | None = None
    hooks = prepare_hooks or RenderPrepareHooks()
    if hooks.source_base is not None:
        base = hooks.source_base(source_pdf_path, **base_options)
    else:
        work_root.mkdir(parents=True, exist_ok=True)
        base_work_dir = Path(tempfile.mkdtemp(prefix=".render-source-base-", dir=work_root))
        base = build_render_source_base(source_pdf_path, work_dir=base_work_dir, **base_options)
    render_source_path = source_pdf_path
    if base.path is not None:
        # 放到原来中间文件的位置。缓存来的用硬链接（缓存文件被替换时这里仍是旧内容，删这里
        # 也不伤缓存）；现做的直接挪过来。
        suffix = ".source-hidden-text-stripped.pdf" if base.hidden_text_stripped else ".source-xobject-sanitized.pdf"
        render_source_path = intermediate_pdf_path(work_root=work_root, output_pdf_path=output_pdf_path, suffix=suffix)
        if base.cached:
            _link_or_copy(base.path, render_source_path)
        else:
            os.replace(base.path, render_source_path)
        if not artifact_mode:
            temp_paths.append(render_source_path)
        print(f"render source pdf: using {suffix.strip('.').removesuffix('.pdf')} copy {render_source_path}", flush=True)
    if base_work_dir is not None:
        shutil.rmtree(base_work_dir, ignore_errors=True)

    if translated_pages and layout.use_bbox_text_strip_cleanup(source_cleanup_strategy):
        translated_page_indices = frozenset(page_idx for page_idx, items in translated_pages.items() if items)
        pikepdf_text_strip_page_indices = (
            document_analysis.pikepdf_text_strip_page_indices & translated_page_indices
            if document_analysis is not None
            else translated_page_indices
        )
        if not pikepdf_text_strip_page_indices:
            bbox_text_strip_skipped_page_indices = translated_page_indices
            source_cleanup_cover_fallback_page_indices = translated_page_indices
            print(
                "render source pdf: bbox-text strip skipped "
                f"no-pikepdf-text-strip-pages pages={len(bbox_text_strip_skipped_page_indices)}",
                flush=True,
            )
        else:
            bbox_started = time.perf_counter()
            bbox_text_stripped_path = intermediate_pdf_path(
                work_root=work_root,
                output_pdf_path=output_pdf_path,
                suffix=".source-bbox-text-stripped.pdf",
            )
            source_cleanup_result = execute_source_cleanup(
                SourceCleanupRequest(
                    source_pdf_path=render_source_path,
                    output_pdf_path=bbox_text_stripped_path,
                    translated_pages=translated_pages,
                    protected_pages=protected_pages,
                    candidates=bbox_text_strip_candidates,
                    options=SourceCleanupOptions(
                        strategy=source_cleanup_strategy,
                        skip_formula_pages=False,
                        max_elapsed_seconds=source_cleanup_max_seconds(),
                    ),
                    document_analysis=document_analysis,
                    strip_runner=hooks.text_strip,
                )
            )
            bbox_text_result = source_cleanup_result.bbox_text_strip
            print(f"render source pdf: bbox-text strip elapsed={time.perf_counter() - bbox_started:.2f}s", flush=True)
            bbox_text_stripped_page_indices = bbox_text_result.changed_page_indices
            bbox_text_strip_skipped_page_indices = (
                bbox_text_result.skipped_complex_page_indices
                | bbox_text_result.skipped_no_text_overlap_page_indices
                | bbox_text_result.skipped_visual_background_page_indices
                | bbox_text_result.skipped_form_xobject_page_indices
                | bbox_text_result.strip_no_effect_page_indices
            )
            source_text_precleaned_page_indices = bbox_text_result.changed_page_indices
            source_cleanup_cover_fallback_page_indices = (
                bbox_text_result.skipped_complex_page_indices
                | bbox_text_result.skipped_visual_background_page_indices
                | bbox_text_result.skipped_form_xobject_page_indices
                | bbox_text_result.strip_no_effect_page_indices
            ) - bbox_text_result.changed_page_indices
            bbox_text_strip_candidates = bbox_text_result.candidates
            if bbox_text_result.changed and bbox_text_result.output_pdf_path is not None:
                render_source_path = bbox_text_result.output_pdf_path
                if not artifact_mode:
                    temp_paths.append(render_source_path)
                print(
                    f"render source pdf: using bbox-text stripped copy {render_source_path}",
                    flush=True,
                )
            else:
                bbox_text_stripped_path.unlink(missing_ok=True)

    if pdf_compress_dpi <= 0:
        return RenderSourcePdf(
            path=render_source_path,
            temp_paths=temp_paths,
            bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
            bbox_text_strip_candidates=bbox_text_strip_candidates,
            document_analysis=document_analysis,
        )
    compress_started = time.perf_counter()
    compressed_source_path = intermediate_pdf_path(
        work_root=work_root,
        output_pdf_path=output_pdf_path,
        suffix=".source-compressed.pdf",
    )
    if build_image_compressed_pdf_copy(render_source_path, compressed_source_path, dpi=pdf_compress_dpi):
        print(f"render source pdf: image compression elapsed={time.perf_counter() - compress_started:.2f}s", flush=True)
        print(f"render source pdf: using compressed copy {compressed_source_path}", flush=True)
        if not artifact_mode:
            temp_paths.append(compressed_source_path)
        return RenderSourcePdf(
            path=compressed_source_path,
            temp_paths=temp_paths,
            image_compressed=True,
            bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
            bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
            source_text_precleaned_page_indices=source_text_precleaned_page_indices,
            source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
            bbox_text_strip_candidates=bbox_text_strip_candidates,
            document_analysis=document_analysis,
        )
    compressed_source_path.unlink(missing_ok=True)
    print("render source pdf: source image compression skipped", flush=True)
    return RenderSourcePdf(
        path=render_source_path,
        temp_paths=temp_paths,
        bbox_text_stripped_page_indices=bbox_text_stripped_page_indices,
        bbox_text_strip_skipped_page_indices=bbox_text_strip_skipped_page_indices,
        source_text_precleaned_page_indices=source_text_precleaned_page_indices,
        source_cleanup_cover_fallback_page_indices=source_cleanup_cover_fallback_page_indices,
        bbox_text_strip_candidates=bbox_text_strip_candidates,
        document_analysis=document_analysis,
    )

def prepare_render_source_pdf(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
    pdf_compress_dpi: int,
    translated_pages: dict[int, list[dict]] | None = None,
    strip_hidden_text: bool = True,
    start_page: int = 0,
    end_page: int = -1,
    artifact_mode: bool = False,
    pdf_structure_profile_path: Path | None = None,
) -> tuple[Path, list[Path]]:
    prepared = build_render_source_pdf(
        source_pdf_path=source_pdf_path,
        output_pdf_path=output_pdf_path,
        pdf_compress_dpi=pdf_compress_dpi,
        translated_pages=translated_pages,
        strip_hidden_text=strip_hidden_text,
        start_page=start_page,
        end_page=end_page,
        artifact_mode=artifact_mode,
        pdf_structure_profile_path=pdf_structure_profile_path,
    )
    return prepared.path, prepared.temp_paths
