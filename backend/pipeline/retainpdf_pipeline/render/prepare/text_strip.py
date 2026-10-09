"""准备步骤：按框去文字（把要翻译的块下面的原文从 PDF 内容流里删掉）。

拆成两段：规划（哪些矩形要删，读译文条目里的策略——便宜，照常现做）和执行（改写内容流——
贵，这一步）。执行只依赖输入 PDF 和规划结果，所以指纹 = 输入 PDF 的内容身份 + 规划出的矩形
与各类跳过页 + 选项；改译文措辞、甚至改了哪些块翻译但删的矩形没变，都直接命中。

时间预算用完、有页没来得及处理时结果不完整，不进缓存。
"""

from __future__ import annotations

import dataclasses
import json
import os
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

from retainpdf_pipeline.render.prepare.store import MANIFEST_NAME
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import content_identity
from retainpdf_pipeline.render.prepare.store import link_or_copy
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripResult

STEP = "text_strip"
VERSION = "1"
PDF = "stripped.pdf"
RESULT = "result.json"
# 只影响日志或时间预算的参数（预算只在结果不完整时起作用，那种结果不缓存）。
_NOT_FINGERPRINTED = {"source_pdf_path", "output_pdf_path", "candidate_elapsed", "candidate_source", "max_elapsed_seconds"}
_RESULT_SKIP = {"output_pdf_path", "candidates"}


def _rects(value: dict | None) -> dict[str, list[list[float]]]:
    return {
        str(int(page)): [[float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])] for rect in rects]
        for page, rects in sorted((value or {}).items())
    }


def _jsonable(value: Any) -> Any:
    if isinstance(value, (set, frozenset)):
        return sorted(value)
    return value


def step_inputs(kwargs: dict[str, Any]) -> dict[str, Any]:
    inputs: dict[str, Any] = {"source": content_identity(kwargs["source_pdf_path"])}
    for key, value in sorted(kwargs.items()):
        if key in _NOT_FINGERPRINTED:
            continue
        inputs[key] = _rects(value) if key in {"page_rects", "page_protected_rects"} else _jsonable(value)
    return inputs


def _result_to_json(result: BBoxTextStripResult) -> dict[str, Any]:
    return {
        field.name: _jsonable(getattr(result, field.name))
        for field in dataclasses.fields(result)
        if field.name not in _RESULT_SKIP
    }


def _result_from_json(data: dict[str, Any], output_pdf_path: Path | None) -> BBoxTextStripResult:
    values: dict[str, Any] = {}
    for field in dataclasses.fields(BBoxTextStripResult):
        if field.name in _RESULT_SKIP or field.name not in data:
            continue
        value = data[field.name]
        values[field.name] = frozenset(int(v) for v in value) if field.name.endswith("_page_indices") else value
    return BBoxTextStripResult(output_pdf_path=output_pdf_path, **values)


def text_strip_runner(prepare_dir: Path | None) -> Callable[..., BBoxTextStripResult] | None:
    """按框去文字执行的缓存包装 runner(execute, **参数)；没有缓存目录时返回 None。"""
    if prepare_dir is None:
        return None
    store = PrepareStore(Path(prepare_dir))

    def runner(execute: Callable[..., BBoxTextStripResult], **kwargs: Any) -> BBoxTextStripResult:
        output_pdf_path = Path(kwargs["output_pdf_path"])
        inputs = step_inputs(kwargs)
        with store.lock(STEP):
            return _run_locked(execute, kwargs, inputs, output_pdf_path)

    def _run_locked(execute, kwargs, inputs, output_pdf_path: Path) -> BBoxTextStripResult:
        record = store.load(STEP, VERSION, inputs)
        if record is None:
            directory = store.step_dir(STEP)
            directory.mkdir(parents=True, exist_ok=True)
            (directory / MANIFEST_NAME).unlink(missing_ok=True)
            scratch = directory / f".strip-{uuid.uuid4().hex}.pdf"
            try:
                result = execute(**{**kwargs, "output_pdf_path": scratch})
                if result.deadline_skipped_page_indices:
                    # 不完整：照常交给调用方，但不缓存。
                    if result.changed:
                        os.replace(scratch, output_pdf_path)
                        return dataclasses.replace(result, output_pdf_path=output_pdf_path)
                    return result
                outputs: dict[str, Path] = {}
                if result.changed:
                    os.replace(scratch, directory / PDF)  # 新 inode：旧链接不受影响
                    outputs[PDF] = directory / PDF
                (directory / RESULT).write_text(json.dumps(_result_to_json(result)), encoding="utf-8")
                outputs[RESULT] = directory / RESULT
                record = store.save(STEP, VERSION, inputs, outputs, elapsed_seconds=0.0)
            finally:
                scratch.unlink(missing_ok=True)
        data = json.loads(record.output(RESULT).read_text(encoding="utf-8"))
        if data.get("changed"):
            link_or_copy(record.output(PDF), output_pdf_path)
            return _result_from_json(data, output_pdf_path)
        return _result_from_json(data, None)

    return runner


__all__ = ["PDF", "RESULT", "STEP", "VERSION", "step_inputs", "text_strip_runner"]
