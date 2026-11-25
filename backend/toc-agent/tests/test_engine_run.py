"""接线：从 document.v1 取条目和标题、缓存（续跑不再发请求、请求失败不缓存）。"""
from __future__ import annotations

import json
from types import SimpleNamespace

from retainpdf_toc_agent import ChatResult
from retainpdf_toc_agent_engine import RESULT_FILE_NAME
from retainpdf_toc_agent_engine import toc_fixed_translations
from retainpdf_toc_agent_engine.run import collect


def _block(block_id, text, role, *, translate=True, **metadata):
    return {"block_id": block_id, "structure_role": role, "content": {"kind": "text", "text": text},
            "policy": {"translate": translate}, "metadata": metadata}


DOCUMENT = {"pages": [
    {"blocks": [
        _block("p001-b0000", "Contents", "heading"),
        _block("p001-b0001", "1 Analyzing the Audience", "toc_entry", toc_entry_number="1", toc_entry_level=1),
        _block("p001-b0002", "References", "toc_entry", toc_entry_level=2),
        _block("p001-b0003", "Energy $E=mc^2$", "toc_entry", toc_entry_level=2),
        _block("p001-b0004", "Kept", "toc_entry", translate=False),
    ]},
    {"blocks": [
        _block("p002-b0000", "1 Analyzing the Audience", "heading"),
        _block("p002-b0001", "Body text.", "body"),
    ]},
]}


class Model:
    def __init__(self):
        self.calls = 0

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls += 1
        titles = [row["title"] for row in json.loads(messages[1]["content"])["entries"]]
        zh = {"Analyzing the Audience": "分析受众", "References": "参考文献"}
        return ChatResult(json.dumps({"translations": [{"k": i, "zh": zh[t]} for i, t in enumerate(titles)]}, ensure_ascii=False))


def test_collect_takes_translatable_entries_without_formulas_and_headings():
    entries, headings = collect(DOCUMENT)
    assert [(e.id, e.number, e.title, e.level) for e in entries] == [
        ("p001-b0001", "1", "Analyzing the Audience", 1),
        ("p001-b0002", "", "References", 2),
    ]
    assert [h.id for h in headings] == ["p001-b0000", "p002-b0000"]
    assert collect(DOCUMENT, skip_titles=True)[1] == []


def test_result_is_cached_for_resume(tmp_path):
    model = Model()
    run = lambda: toc_fixed_translations(  # noqa: E731
        DOCUMENT, output_dir=tmp_path, chat_fn=model, model_identity={"model": "m"},
        glossary_entries=[SimpleNamespace(source="audience", target="受众")],
    )
    first = run()
    assert first == {"p001-b0001": "1 分析受众", "p001-b0002": "参考文献", "p002-b0000": "1 分析受众"}
    record = json.loads((tmp_path / RESULT_FILE_NAME).read_text(encoding="utf-8"))
    assert record["schema"] == "toc_agent_result_v1" and record["entries"] == 2 and record["matched_headings"] == 1
    assert run() == first and model.calls == 1
    # 换了模型就重新翻
    toc_fixed_translations(DOCUMENT, output_dir=tmp_path, chat_fn=model, model_identity={"model": "other"})
    assert model.calls == 2


def test_failed_run_is_not_cached(tmp_path):
    def broken(messages, **kwargs):
        raise RuntimeError("down")

    assert toc_fixed_translations(DOCUMENT, output_dir=tmp_path, chat_fn=broken, model_identity={}) == {}
    model = Model()
    assert toc_fixed_translations(DOCUMENT, output_dir=tmp_path, chat_fn=model, model_identity={})
    assert model.calls == 1


def test_document_without_contents_sends_nothing_and_writes_nothing(tmp_path):
    document = {"pages": [{"blocks": [_block("p001-b0000", "Intro", "heading")]}]}
    assert toc_fixed_translations(document, output_dir=tmp_path, chat_fn=None, model_identity={}) == {}
    assert not (tmp_path / RESULT_FILE_NAME).exists()
