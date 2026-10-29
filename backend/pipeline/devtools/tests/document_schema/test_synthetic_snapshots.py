"""快照守卫：人造 OCR 原始输出走完整归一化，整份 document.v1 和报告逐字节对上期望文件。

样例在 `fixtures/synthetic/`（说明见那里的 README）。归一化的路径和 normalize worker 一样：适配 → `finalize_normalized_document`
（缩放到原文 PDF、补行、按最终文档刷新报告）。原文 PDF 按 `case.json` 的 `pdf_pages` 临时生成空白页，只用它的页面尺寸。

改了归一化、输出确实该变：`UPDATE_OCR_SNAPSHOTS=1` 跑一次重新生成，再看 git diff。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.finalize import finalize_normalized_document
from retainpdf_pipeline.ocr.document_schema.validator import DocumentSchemaValidationError

SYNTHETIC = Path(__file__).parent / "fixtures" / "synthetic"
UPDATE = os.environ.get("UPDATE_OCR_SNAPSHOTS") == "1"

# 原始文件名只进 `source.raw_files`，各家用自己惯用的名字，和路径无关。
RAW_FILE_NAMES = {
    "mineru": "layout.json",
    "mineru_content_list_v2": "content_list_v2.json",
    "paddle": "result.json",
    "generic_flat_ocr": "payload.json",
}

CASES = sorted(path.name for path in SYNTHETIC.iterdir() if (path / "case.json").is_file())


def _case(name: str) -> dict:
    return json.loads((SYNTHETIC / name / "case.json").read_text(encoding="utf-8"))


def _source_pdf(tmp_path: Path, pages: list[list[float]]) -> Path:
    path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        for width, height in pages:
            pdf.new_page(width=float(width), height=float(height))
        pdf.save(path)
    return path


def _normalize(name: str, raw_file: str, tmp_path: Path) -> tuple[dict, dict]:
    case = _case(name)
    payload = json.loads((SYNTHETIC / name / raw_file).read_text(encoding="utf-8"))
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload,
        provider=case["provider"],
        document_id=name,
        source_json_path=Path(RAW_FILE_NAMES[case["provider"]]),
    )
    return finalize_normalized_document(document, report, _source_pdf(tmp_path, case["pdf_pages"]))


def _dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def _check(path: Path, value: object) -> None:
    text = _dump(value)
    if UPDATE or not path.exists():
        if not UPDATE:
            pytest.fail(f"{path.name} 不存在：用 UPDATE_OCR_SNAPSHOTS=1 生成，再看 git diff")
        path.write_text(text, encoding="utf-8")
        return
    expected = path.read_text(encoding="utf-8")
    if text != expected:
        actual = path.with_suffix(".actual.json")
        actual.write_text(text, encoding="utf-8")
        pytest.fail(
            f"{path.parent.name}/{path.name} 变了（新的写在 {actual.name}，diff 一下）；"
            "确实该变就用 UPDATE_OCR_SNAPSHOTS=1 重新生成"
        )


@pytest.mark.parametrize("name", CASES)
def test_normalized_document_matches_the_snapshot(name: str, tmp_path: Path) -> None:
    document, report = _normalize(name, _case(name)["raw_file"], tmp_path)
    _check(SYNTHETIC / name / "expected.document.v1.json", document)
    _check(SYNTHETIC / name / "expected.report.json", report)


def test_every_case_declares_its_pdf_pages_for_every_ocr_page(tmp_path: Path) -> None:
    for name in CASES:
        document, _report = _normalize(name, _case(name)["raw_file"], tmp_path)
        assert len(document["pages"]) == len(_case(name)["pdf_pages"]), name


OVERFLOW = [name for name in CASES if (SYNTHETIC / name / "raw_page_overflow.json").is_file()]


@pytest.mark.parametrize("name", OVERFLOW)
def test_a_block_slightly_past_the_page_edge_is_clamped_instead_of_failing(name: str, tmp_path: Path) -> None:
    # 以前这一个块就让整份文档校验失败（`case.json` 的 `page_overflow_variants` 记着当时的报错）；现在夹回页内、记下来。
    document, report = _normalize(name, "raw_page_overflow.json", tmp_path)
    assert report["page_overflow_clamped_block_count"] == 1
    assert document["derived"]["page_overflow_clamped_block_count"] == 1
    clamped = [
        (page, block)
        for page in document["pages"]
        for block in page["blocks"]
        if "page_overflow_clamped" in block.get("metadata", {})
    ]
    assert len(clamped) == 1
    page, block = clamped[0]
    original = block["metadata"]["page_overflow_clamped"]["original_bbox"]
    assert block["bbox"] != original
    assert 0 <= block["bbox"][0] and block["bbox"][2] <= page["width"] + 1e-3
    assert 0 <= block["bbox"][1] and block["bbox"][3] <= page["height"] + 1e-3
    # 其余的块和不越界的那份一样：只动了这一个块。
    (tmp_path / "plain").mkdir()
    plain, _ = _normalize(name, _case(name)["raw_file"], tmp_path / "plain")
    assert sum(len(p["blocks"]) for p in plain["pages"]) == sum(len(p["blocks"]) for p in document["pages"])
