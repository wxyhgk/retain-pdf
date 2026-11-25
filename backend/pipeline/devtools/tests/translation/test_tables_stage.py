"""流水线的表格翻译这一步（T3）：document.v1 的表格块 + 原文页 → 表格模型 → 表格 agent → translated/tables.v1.json。

用评测集里一张真表（公开样例 1.pdf 第 7 页）和脚本假的模型。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest
import requests

from retainpdf_pipeline.translate.tables_stage import TABLES_FILE_NAME
from retainpdf_pipeline.translate.tables_stage import translate_tables
from retainpdf_translation.public import GlossaryEntry

REPO = Path(__file__).resolve().parents[5]
RECORD = next(
    record
    for record in json.loads((REPO / "tests/fixtures/tables/ocr/glm_ocr.tables.json").read_text(encoding="utf-8"))
    if record["fixture"] == "1.pdf" and record["source_page"] == 7
)
PDF = REPO / "tests/fixtures/pdfs/1.pdf"


def _document(tmp_path: Path) -> Path:
    page_index = RECORD["source_page"] - 1
    blocks = [
        {"block_id": "p007-b0011", "type": "text", "sub_type": "table_caption", "text": "Table 1 Oxidant screening"},
        {"block_id": RECORD["block_id"], "type": "table", "sub_type": "table_html", "page_index": page_index,
         "bbox": RECORD["bbox_pt"], "text": RECORD["html"]},
        {"block_id": "p007-b0013", "type": "text", "sub_type": "table_footnote", "text": "a Reaction conditions: see text."},
        {"block_id": "p007-b0014", "type": "text", "sub_type": "body", "text": "Body text."},
    ]
    path = tmp_path / "document.v1.json"
    path.write_text(json.dumps({"pages": [{"page_index": page_index, "blocks": blocks}]}), encoding="utf-8")
    return path


class Model:
    """把所有 `?` 格子都译成「译:原文」（不动数字、上下标），记下收到的消息。"""

    def __init__(self) -> None:
        self.calls: list[list[dict]] = []

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        self.calls.append(messages)
        cells = {}
        for line in messages[1]["content"].splitlines():
            parts = line.split(" ", 3)
            if len(parts) == 4 and parts[2] == "?" and "→" not in line:
                cells[parts[0]] = "译" + parts[3]
        return json.dumps({"action": "submit", "cells": cells, "terms": {"oxidant": "氧化剂"}}, ensure_ascii=False)


def _run(tmp_path: Path, chat, **kwargs):  # noqa: ANN001, ANN003
    return translate_tables(
        source_json_path=_document(tmp_path), source_pdf_path=PDF, output_dir=tmp_path / "translated",
        api_key="", model="m", base_url="http://model.invalid", chat_fn=chat, **kwargs,
    )


def test_tables_are_translated_into_tables_v1_with_caption_footnotes_and_glossary(tmp_path: Path) -> None:
    model = Model()
    summary = _run(tmp_path, model, glossary_entries=[GlossaryEntry(source="cymene", target="伞花烃")])
    assert summary["tables"] == 1 and summary["status:translated"] == 1

    payload = json.loads((tmp_path / "translated" / TABLES_FILE_NAME).read_text(encoding="utf-8"))
    assert payload["schema"] == "tables.v1" and payload["prompt_version"] == "table_translate.v1"
    table = payload["tables"][0]
    assert (table["block_id"], table["page_index"], table["caption"]) == (RECORD["block_id"], 6, "Table 1 Oxidant screening")
    assert table["model"]["model_version"] == "table.v1" and table["result"]["status"] == "translated"
    assert table["translated_html"].startswith("<table><tr><th>译")

    prompt = model.calls[0][1]["content"]
    assert "表题：Table 1 Oxidant screening" in prompt and "表注：a Reaction conditions: see text." in prompt
    assert "Body text." not in prompt
    assert "cymene → 伞花烃" in prompt, "术语表的译法给到模型"


def test_a_second_run_reuses_the_saved_results_without_asking_the_model(tmp_path: Path) -> None:
    _run(tmp_path, Model())
    again = Model()
    summary = _run(tmp_path, again)
    assert again.calls == [] and summary["cache_hits"] == 1 and summary["status:translated"] == 1


def _http_error(status: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    return requests.HTTPError(f"{status} error", response=response)


def test_a_rejected_key_stops_the_job_but_other_request_errors_only_keep_that_table(tmp_path: Path) -> None:
    def rejected(messages, *, purpose, response_format=None):  # noqa: ANN001
        raise _http_error(401)

    with pytest.raises(requests.HTTPError, match="API Key 被上游拒绝"):
        _run(tmp_path, rejected)

    def flaky(messages, *, purpose, response_format=None):  # noqa: ANN001
        raise _http_error(500)

    summary = _run(tmp_path, flaky)
    table = json.loads((tmp_path / "translated" / TABLES_FILE_NAME).read_text(encoding="utf-8"))["tables"][0]
    assert summary["status:kept"] == 1
    assert (table["result"]["status"], table["result"]["reason"], table["translated_html"]) == ("kept", "request_failed:HTTPError", None)


def test_without_the_source_pdf_nothing_is_sent(tmp_path: Path) -> None:
    summary = translate_tables(source_json_path=_document(tmp_path), source_pdf_path=None, output_dir=tmp_path / "t",
                               api_key="", model="m", base_url="u", chat_fn=Model())
    assert summary == {"mode": "translate", "skipped_reason": "source_pdf_missing"}


def test_the_reader_looks_for_the_same_file_name() -> None:
    # 阅读页的区块接口按同一个文件名找表格译文（retainpdf-core 的 storage_paths 常量）
    constants = REPO / "backend/packages/retainpdf-core/src/storage_paths/constants.rs"
    assert f'TABLE_TRANSLATIONS_FILE_NAME: &str = "{TABLES_FILE_NAME}"' in constants.read_text(encoding="utf-8")


# ---- 定结构（G4）：合成的一页，表题框进了表格、两行数据被 OCR 并成一行 ----

SYNTHETIC_LINES = [["Table 4", "Synthetic", "batches"], ["Batch", "Status", "Density"], ["B-01", "stable", "1.92"],
                   ["B-02", "cracked", "1.95"], ["B-03", "stable", "1.89"]]
SYNTHETIC_HTML = (
    "<table><tr><td>Table 4 Synthetic batches Batch</td><td>Status</td><td>Density</td></tr>"
    "<tr><td>B-01 B-02</td><td>stable cracked</td><td>1.92 1.95</td></tr>"
    "<tr><td>B-03</td><td>stable</td><td>1.89</td></tr></table>"
)


def _synthetic(tmp_path: Path) -> tuple[Path, Path]:
    import fitz

    pdf = fitz.open()
    page = pdf.new_page(width=420, height=300)
    for index, row in enumerate(SYNTHETIC_LINES):
        for x, text in zip((50, 160, 270), row):
            page.insert_text((x, 100 + index * 16), text, fontsize=9)
    pdf_path = tmp_path / "synthetic.pdf"
    pdf.save(pdf_path)
    blocks = [{"block_id": "p001-b0002", "type": "table", "sub_type": "table_html", "page_index": 0,
               "bbox": [40, 85, 390, 175], "text": SYNTHETIC_HTML}]
    doc_path = tmp_path / "document.v1.json"
    doc_path.write_text(json.dumps({"pages": [{"page_index": 0, "blocks": blocks}]}), encoding="utf-8")
    return doc_path, pdf_path


class StructureModel:
    """定结构的请求：表题移出去、第 1 行从 L3 切开；翻格子的请求：所有 `?` 格子译成「译:原文」。"""

    def __init__(self, structure_reply: dict) -> None:
        self.structure_reply = structure_reply
        self.purposes: list[str] = []
        self.first_structure_request: list[dict] | None = None

    def __call__(self, messages, *, purpose, response_format=None):  # noqa: ANN001
        self.purposes.append(purpose)
        if purpose == "table_structure":
            self.first_structure_request = self.first_structure_request or messages
            return json.dumps(self.structure_reply)
        cells = {}
        for line in messages[1]["content"].splitlines():
            parts = line.split(" ", 3)
            if len(parts) == 4 and parts[2] == "?":
                cells[parts[0]] = "译" + parts[3]
        return json.dumps({"action": "submit", "cells": cells}, ensure_ascii=False)


FIX = {"action": "edit", "done": True, "edits": [{"tool": "move_to_caption", "lines": [0]},
                                                  {"tool": "split_row", "row": 1, "at_lines": [3]}]}


def _run_synthetic(tmp_path: Path, chat):  # noqa: ANN001
    doc_path, pdf_path = _synthetic(tmp_path)
    return translate_tables(source_json_path=doc_path, source_pdf_path=pdf_path, output_dir=tmp_path / "translated",
                            api_key="", model="m", base_url="http://model.invalid", chat_fn=chat)


def test_a_table_with_an_unreliable_structure_is_fixed_from_a_screenshot_then_translated(tmp_path: Path) -> None:
    model = StructureModel(FIX)
    summary = _run_synthetic(tmp_path, model)
    assert summary["structure:fixed"] == 1 and summary["status:translated"] == 1
    assert model.purposes == ["table_structure", "table_translate"]
    image = model.first_structure_request[1]["content"][0]
    assert image["type"] == "image_url" and image["image_url"]["url"].startswith("data:image/png;base64,")

    payload = json.loads((tmp_path / "translated" / TABLES_FILE_NAME).read_text(encoding="utf-8"))
    assert payload["structure_prompt_version"] == "table_structure.v1"
    table = payload["tables"][0]
    assert table["result"]["structure"]["status"] == "fixed"
    assert table["result"]["structure"]["issues_before"] == ["row_swallows_rows"]
    assert table["model"]["structure_source"] == "ocr_html+agent" and (table["model"]["n_rows"], table["model"]["n_cols"]) == (4, 3)
    assert table["bbox"] == table["model"]["bbox"] and table["bbox"][1] > 85, "表格的框收到表题下面，译文 PDF 不会盖掉表题"
    assert table["result"]["cells"]["r2c1"]["translation"] == "译cracked"

    # 再跑一次：缓存命中，用存下的修好的结构，不再请求
    again = StructureModel(FIX)
    summary = _run_synthetic(tmp_path, again)
    assert again.purposes == [] and summary["cache_hits"] == 1
    table = json.loads((tmp_path / "translated" / TABLES_FILE_NAME).read_text(encoding="utf-8"))["tables"][0]
    assert table["model"]["structure_source"] == "ocr_html+agent" and table["result"]["status"] == "translated"


def test_a_structure_the_model_cannot_fix_keeps_the_table_untranslated(tmp_path: Path) -> None:
    model = StructureModel({"action": "give_up", "reason": "看不清"})
    summary = _run_synthetic(tmp_path, model)
    assert summary["structure:kept"] == 1 and summary["status:skipped"] == 1
    assert model.purposes == ["table_structure"], "没修好不翻格子"
    table = json.loads((tmp_path / "translated" / TABLES_FILE_NAME).read_text(encoding="utf-8"))["tables"][0]
    assert table["result"]["reason"] == "structure_unreliable:row_swallows_rows"
    assert table["result"]["structure"]["reason"] == "model_gave_up"
    assert table["model"]["structure_source"] == "ocr_html", "存的是原来的表格模型"
