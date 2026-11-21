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
