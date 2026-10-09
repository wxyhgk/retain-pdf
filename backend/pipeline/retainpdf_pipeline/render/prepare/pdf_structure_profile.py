"""准备步骤：PDF 结构画像（每页的文字 / 路径 / 图片 / 表单对象，以及 OCR 块命中了哪个文字对象）。

只依赖原 PDF 和每页 OCR 块的 item_id 与框——与译文无关，OCR 一完成就能做。按框去文字的规划
用它。原来存在 render_prewarm 里、文件在就复用、不看输入（OCR 重做后会用到旧的）；现在有指纹。

与原来同一语义：现算时用内存里的结果，命中时读文件（页面尺寸读回是 3 位小数）。
"""

from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.render.pdf_structure_profile.contracts import PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.io import PDF_STRUCTURE_PROFILE_MANIFEST_NAME
from retainpdf_pipeline.render.pdf_structure_profile.io import read_pdf_structure_profile
from retainpdf_pipeline.render.pdf_structure_profile.io import write_pdf_structure_profile
from retainpdf_pipeline.render.pdf_structure_profile.sampler import build_pdf_structure_profile
from retainpdf_pipeline.render.prepare.store import PrepareStore
from retainpdf_pipeline.render.prepare.store import file_identity

STEP = "pdf_structure_profile"
VERSION = f"1:{PDF_STRUCTURE_PROFILE_ALGORITHM_VERSION}"
OUTPUT = PDF_STRUCTURE_PROFILE_MANIFEST_NAME


def step_inputs(*, source_pdf_path: Path, pages: dict[int, list[dict]] | None) -> dict:
    return {
        "source_pdf": file_identity(source_pdf_path),
        # sampler 只看每页条目的 item_id 与 bbox（顺序也参与坐标系判定）；没有条目时扫全部页。
        "pages": {
            str(int(page)): [[str(item.get("item_id") or ""), list(item.get("bbox") or [])] for item in items or []]
            for page, items in sorted((pages or {}).items())
        },
    }


def pdf_structure_profile_builder(prepare_dir: Path | None):
    """(source_pdf_path, pages) -> (profile, json 文件)；没有缓存目录时返回 None（现做）。"""
    if prepare_dir is None:
        return None
    store = PrepareStore(Path(prepare_dir))

    def builder(source_pdf_path: Path, pages: dict[int, list[dict]] | None) -> tuple[PdfStructureDocumentProfile, Path]:
        built: list[PdfStructureDocumentProfile] = []

        def build(directory: Path) -> dict[str, Path]:
            profile = build_pdf_structure_profile(Path(source_pdf_path), pages)
            built.append(profile)
            output = directory / OUTPUT
            write_pdf_structure_profile(output, profile)
            return {OUTPUT: output}

        record = store.run(STEP, VERSION, step_inputs(source_pdf_path=Path(source_pdf_path), pages=pages), build)
        profile = built[0] if built else read_pdf_structure_profile(record.output(OUTPUT))
        if profile is None:
            raise RuntimeError(f"pdf_structure_profile: unreadable cache {record.output(OUTPUT)}")
        return profile, record.output(OUTPUT)

    return builder


__all__ = ["OUTPUT", "STEP", "VERSION", "pdf_structure_profile_builder", "step_inputs"]
