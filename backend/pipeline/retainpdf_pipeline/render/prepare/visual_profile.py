"""准备步骤：visual_profile（每块的底色 / 字色，从原 PDF 像素与文字 span 采样）。

指纹只含采样真正看的东西（visual_profile.visual_sampling_signature：覆盖框、要不要采底色 /
字色、块类型）和原 PDF——与译文措辞无关，改译文后重渲染直接命中。缓存按原精度存
（exact），命中时读回的与现算的逐位相同。

prewarm（source 层）不能依赖本层：由 prepare.hooks 组装进 RenderPrepareHooks 注入；没有
缓存目录时就是原来的现算。
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import StepRecord
from retainpdf_pipeline.render.prepare.store import file_identity
from retainpdf_pipeline.render.visual_profile import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile import build_document_visual_profile
from retainpdf_pipeline.render.visual_profile import document_visual_profile_from_manifest
from retainpdf_pipeline.render.visual_profile import document_visual_profile_to_manifest
from retainpdf_pipeline.render.visual_profile import visual_sampling_signature
from retainpdf_pipeline.render.visual_profile.contracts import VISUAL_PROFILE_ALGORITHM_VERSION

STEP = "visual_profile"
VERSION = f"1:{VISUAL_PROFILE_ALGORITHM_VERSION}"
OUTPUT = "visual_profile.exact.json"

VisualProfileBuilder = Callable[[Path, dict[int, list[dict]]], DocumentVisualProfile]


def step_inputs(*, source_pdf_path: Path, pages: dict[int, list[dict]]) -> dict:
    return {"source_pdf": file_identity(source_pdf_path), "sampling": visual_sampling_signature(pages)}


def run_visual_profile(
    store: PrepareStore, *, source_pdf_path: Path, pages: dict[int, list[dict]]
) -> tuple[DocumentVisualProfile, StepRecord]:
    def build(directory: Path) -> dict[str, Path]:
        profile = build_document_visual_profile(source_pdf_path, pages)
        output = directory / OUTPUT
        output.write_text(json.dumps(document_visual_profile_to_manifest(profile, exact=True)), encoding="utf-8")
        return {OUTPUT: output}

    record = store.run(STEP, VERSION, step_inputs(source_pdf_path=source_pdf_path, pages=pages), build)
    profile = document_visual_profile_from_manifest(json.loads(record.output(OUTPUT).read_text(encoding="utf-8")))
    return profile, record


def visual_profile_builder(prepare_dir: Path | None) -> VisualProfileBuilder:
    if prepare_dir is None:
        return build_document_visual_profile
    store = PrepareStore(Path(prepare_dir))

    def builder(source_pdf_path: Path, pages: dict[int, list[dict]]) -> DocumentVisualProfile:
        profile, _record = run_visual_profile(store, source_pdf_path=Path(source_pdf_path), pages=pages)
        return profile

    return builder


__all__ = ["OUTPUT", "STEP", "VERSION", "VisualProfileBuilder", "run_visual_profile", "step_inputs", "visual_profile_builder"]
