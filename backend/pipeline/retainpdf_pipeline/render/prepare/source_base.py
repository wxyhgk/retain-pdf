"""准备步骤：渲染源的底子（修非法 XObject + 去隐藏文字层）。

只依赖原 PDF、要不要去隐藏文字（页面分析说有隐藏文字层且不是 overlay 模式）和页码范围——
与译文无关，OCR + 页面分析之后就能做。之后的「按框去文字」「压缩图片」在它上面接着做
（render/source/render_source.py）。

产物 base.pdf 每次都是新文件（写临时文件再替换），渲染时硬链接到原来中间文件的位置：
缓存换了内容，旧的引用仍指向旧文件。
"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import StepRecord
from retainpdf_pipeline.render.prepare.store import file_identity
from retainpdf_pipeline.render.source.render_source import RenderSourceBase
from retainpdf_pipeline.render.source.render_source import RenderSourceBaseBuilder
from retainpdf_pipeline.render.source.render_source import build_render_source_base

STEP = "source_base"
VERSION = "1"
PDF = "base.pdf"
INFO = "base.json"


def step_inputs(*, source_pdf_path: Path, strip_hidden_text: bool, start_page: int, end_page: int) -> dict:
    return {
        "source_pdf": file_identity(source_pdf_path),
        "strip_hidden_text": bool(strip_hidden_text),
        # 只有去隐藏文字时页码范围才影响结果。
        "page_range": [int(start_page), int(end_page)] if strip_hidden_text else None,
    }


def run_source_base(
    store: PrepareStore, *, source_pdf_path: Path, strip_hidden_text: bool, start_page: int, end_page: int
) -> tuple[RenderSourceBase, StepRecord]:
    def build(directory: Path) -> dict[str, Path]:
        base = build_render_source_base(
            source_pdf_path,
            strip_hidden_text=strip_hidden_text,
            start_page=start_page,
            end_page=end_page,
            work_dir=directory,
            output_name=PDF,
        )
        info = directory / INFO
        info.write_text(
            json.dumps(
                {
                    "changed": base.path is not None,
                    "xobject_sanitized": base.xobject_sanitized,
                    "hidden_text_stripped": base.hidden_text_stripped,
                }
            ),
            encoding="utf-8",
        )
        return {INFO: info, **({PDF: base.path} if base.path is not None else {})}

    inputs = step_inputs(
        source_pdf_path=source_pdf_path, strip_hidden_text=strip_hidden_text, start_page=start_page, end_page=end_page
    )
    record = store.run(STEP, VERSION, inputs, build)
    info = json.loads(record.output(INFO).read_text(encoding="utf-8"))
    if info.get("changed") and PDF not in record.outputs:
        raise RuntimeError(f"source_base: manifest lists no {PDF} although the base changed")
    base = RenderSourceBase(
        path=record.output(PDF) if info.get("changed") else None,
        xobject_sanitized=bool(info.get("xobject_sanitized")),
        hidden_text_stripped=bool(info.get("hidden_text_stripped")),
        cached=True,
    )
    return base, record


def source_base_builder(prepare_dir: Path | None) -> RenderSourceBaseBuilder | None:
    """给 build_render_source_pdf 的底子构建函数；没有缓存目录时返回 None（现做）。"""
    if prepare_dir is None:
        return None
    store = PrepareStore(Path(prepare_dir))

    def builder(source_pdf_path: Path, *, strip_hidden_text: bool, start_page: int, end_page: int) -> RenderSourceBase:
        base, _record = run_source_base(
            store,
            source_pdf_path=Path(source_pdf_path),
            strip_hidden_text=strip_hidden_text,
            start_page=start_page,
            end_page=end_page,
        )
        return base

    return builder


__all__ = ["INFO", "PDF", "STEP", "VERSION", "run_source_base", "source_base_builder", "step_inputs"]
