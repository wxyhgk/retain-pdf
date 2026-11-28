"""目录页认上下文（R2，2026-11-28）接进翻译：子开关默认 off；rules 只记信号；model 拿不准的页问模型、改了写回归一化文档。
不调真模型：假的 chat_fn 看草稿回 actions。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.ocr.document_schema.toc_pages import split_toc_blocks_with_text_layer
from retainpdf_pipeline.translate.toc_context_stage import CONTEXT_ENV
from retainpdf_pipeline.translate.toc_context_stage import run_toc_context
from retainpdf_toc_agent import ChatResult
from retainpdf_translation.core.ocr.json_extractor import extract_text_items

# 论文集的目录：标题一行（页码在右）、下面一行斜体作者（规则把作者行当成了没页码的条目）
PAPERS = [("Infidelity in couples therapy", "Fred Piercy and Jane Doe", "1"),
          ("Treating affairs in practice", "Kathy Smith", "17"),
          ("Prevention and repair", "Lee Wong", "33")]


def _job(tmp_path: Path, rows, *, author_lines=True) -> tuple[Path, Path, Path]:
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    y = 100
    for title, author, label in rows:
        page.insert_text((90, y), title, fontsize=11)
        page.insert_text((350, y), label, fontsize=11)
        if author_lines and author:
            y += 14
            page.insert_text((90, y), author, fontsize=9, fontname="Times-Italic")
        y += 22
    job = tmp_path / "job"
    (job / "source").mkdir(parents=True)
    (job / "ocr/normalized").mkdir(parents=True)
    (job / "translated").mkdir()
    pdf_path = job / "source/book.pdf"
    pdf.save(pdf_path)
    document = adapt_payload_to_document_v1(
        payload={"provider": PROVIDER_GENERIC_FLAT_OCR, "pages": [{
            "width": 420.0, "height": 600.0, "unit": "pt",
            "blocks": [{"type": "text", "sub_type": "table_of_contents", "bbox": [50, 80, 400, y], "text": "contents",
                        "lines": [], "segments": [], "tags": ["table_of_contents"],
                        "derived": {"role": "table_of_contents", "by": "", "confidence": 0.0}, "metadata": {}}],
        }]},
        document_id="toc-doc", provider=PROVIDER_GENERIC_FLAT_OCR, source_json_path=Path("/tmp/toc-doc.json"),
    )
    document["pages"][0]["blocks"][0]["policy"] = {"translate": True, "translate_reason": "test"}
    with fitz.open(pdf_path) as opened:
        split_toc_blocks_with_text_layer(document, opened)
    doc_path = job / "ocr/normalized/document.v1.json"
    doc_path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return doc_path, pdf_path, job / "translated"


class Model:
    def __init__(self, decide):
        self.decide, self.calls = decide, []

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls.append(messages)
        content = messages[1]["content"]
        view = json.loads(content[-1]["text"] if isinstance(content, list) else content)
        return ChatResult(json.dumps({"actions": self.decide(view) + [{"tool": "done"}]}))


def _authors_back(view):
    """斜体的行是作者：改角色、挂回上一行的那条。"""
    actions, previous_entry = [], None
    for line in view["lines"]:
        italic = [frag["id"] for frag in line["frags"] if frag.get("i")]
        if italic and previous_entry:
            actions += [{"tool": "set_role", "fragments": italic, "role": "author"},
                        {"tool": "attach", "fragments": italic, "entry": previous_entry}]
        else:
            previous_entry = next((frag.get("e") for frag in line["frags"] if frag.get("e")), previous_entry)
    return actions


def _run(doc_path, pdf_path, output_dir, mode, chat_fn=None):
    return run_toc_context(toc_mode="agent", context_mode=mode, source_json_path=doc_path, source_pdf_path=pdf_path,
                           output_dir=output_dir, api_key="k", model="m", base_url="u", chat_fn=chat_fn)


def _entries(doc_path):
    document = json.loads(doc_path.read_text(encoding="utf-8"))
    return document, [b for b in document["pages"][0]["blocks"] if b.get("structure_role") == "toc_entry"]


def test_switch_is_off_by_default(tmp_path, monkeypatch):
    monkeypatch.delenv(CONTEXT_ENV, raising=False)
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)
    before = doc_path.read_bytes()
    never = Model(lambda view: pytest.fail("off 时不发请求"))
    assert _run(doc_path, pdf_path, output_dir, None, never) == {"status": "off"}
    assert run_toc_context(toc_mode="translate", context_mode="model", source_json_path=doc_path, source_pdf_path=pdf_path,
                           output_dir=output_dir, api_key="k", model="m", base_url="u", chat_fn=never) == {"status": "off"}
    assert doc_path.read_bytes() == before and not any(output_dir.iterdir())


def test_default_translation_run_does_not_touch_the_contents(tmp_path, monkeypatch):
    import retainpdf_pipeline.translate.translation_stage as stage

    monkeypatch.delenv(CONTEXT_ENV, raising=False)
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)
    before = doc_path.read_bytes()
    monkeypatch.setattr(stage, "execute_translation_request", lambda request: {"translated_items": 0})
    result = stage.translate_book_pipeline(source_json_path=doc_path, output_dir=output_dir, api_key="k",
                                           source_pdf_path=pdf_path)
    assert result == {"translated_items": 0} and doc_path.read_bytes() == before and not any(output_dir.iterdir())


def test_rules_mode_only_records_which_pages_would_be_asked(tmp_path):
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)
    before = doc_path.read_bytes()
    summary = _run(doc_path, pdf_path, output_dir, "rules", Model(lambda view: pytest.fail("rules 不发请求")))
    assert summary["status"] == "done" and summary["flagged"] == 1 and summary["requests"] == 0
    assert "author_line_unrecognized" in summary["signals"]
    assert doc_path.read_bytes() == before
    assert (output_dir / "toc-context.v1.json").is_file()


def test_model_mode_sets_author_lines_aside_and_rewrites_the_entries(tmp_path):
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)
    _document, before = _entries(doc_path)
    # 规则把作者行并进了下一篇的标题（8e0722 那样），最后一行作者自成一条
    assert [e["metadata"]["toc_entry_title"] for e in before][1:] == [
        "Fred Piercy and Jane Doe Treating affairs in practice", "Kathy Smith Prevention and repair", "Lee Wong"]
    model = Model(_authors_back)
    summary = _run(doc_path, pdf_path, output_dir, "model", model)
    assert summary["statuses"] == {"model": 1} and summary["written"] == 1 and len(model.calls) == 1
    document, entries = _entries(doc_path)
    assert [e["metadata"]["toc_entry_title"] for e in entries] == [title for title, _a, _p in PAPERS]
    assert [[line["text"] for line in e["metadata"]["toc_entry_author_lines"]] for e in entries] == [[a] for _t, a, _p in PAPERS]
    assert [e["metadata"]["toc_entry_page_label"] for e in entries] == ["1", "17", "33"]
    assert all(e["metadata"]["toc_entry_context_source"] == "model" and e["metadata"]["toc_entry_keep_original"] is False
               for e in entries)
    assert all(len(e["metadata"]["toc_entry_title_lines"]) == 1 for e in entries), "作者行不进标题的行"
    blocks = document["pages"][0]["blocks"]
    assert [b["block_id"] for b in blocks] == [f"p001-b{i:04d}" for i in range(len(blocks))]
    assert document["derived"]["toc_context"]["pages_changed"] == 1
    # 翻译按新的条目走：标题不带作者
    texts = [item.text for item in extract_text_items(document, 0)]
    assert texts == ["Infidelity in couples therapy", "1", "Treating affairs in practice", "17", "Prevention and repair", "33"]
    # 续跑：文档已经改过，不再改第二遍、不再发请求
    assert _run(doc_path, pdf_path, output_dir, "model", model) == {"status": "already_applied"} and len(model.calls) == 1


def test_quiet_contents_page_sends_nothing_even_in_model_mode(tmp_path):
    rows = [("Analyzing the Audience", "", "1"), ("Choosing Words", "", "3"), ("References", "", "13")]
    doc_path, pdf_path, output_dir = _job(tmp_path, rows, author_lines=False)
    before = doc_path.read_bytes()
    summary = _run(doc_path, pdf_path, output_dir, "model", Model(lambda view: pytest.fail("没有信号不问")))
    assert summary["statuses"] == {"rules": 1} and summary["written"] == 0
    assert doc_path.read_bytes() == before


def test_rules_rejected_block_is_split_when_the_model_confirms(tmp_path):
    rows = [("Preface", "", "vii"), ("Introduction", "", "1")]
    doc_path, pdf_path, output_dir = _job(tmp_path, rows, author_lines=False)
    _document, entries = _entries(doc_path)
    assert entries == [], "条目太少：规则不拆，照旧一整块"
    summary = _run(doc_path, pdf_path, output_dir, "model", Model(lambda view: []))
    assert summary["signals"]["rules_rejected"] == 1 and summary["written"] == 1
    document, entries = _entries(doc_path)
    assert [e["metadata"]["toc_entry_title"] for e in entries] == ["Preface", "Introduction"]
    assert not any(b.get("structure_role") == "table_of_contents" for b in document["pages"][0]["blocks"])


def test_kept_entries_are_left_in_the_original(tmp_path):
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)

    def keep_second(view):
        # 第二篇（e2：规则草稿里它带着上一篇的作者行）不翻
        return _authors_back(view) + [{"tool": "keep", "entry": view["entries"][1]["id"], "reason": "name"}]

    _run(doc_path, pdf_path, output_dir, "model", Model(keep_second))
    document, entries = _entries(doc_path)
    kept = entries[1]
    assert kept["metadata"]["toc_entry_keep_original"] is True and kept["metadata"]["toc_entry_keep_reason"] == "name"
    assert kept["policy"]["translate"] is False
    labels = [b for b in document["pages"][0]["blocks"] if b.get("structure_role") == "toc_page_label"]
    assert [b["policy"]["translate"] for b in labels] == [True, False, True], "不翻的条目，页码也不重画"
    assert [item.text for item in extract_text_items(document, 0)] == [
        "Infidelity in couples therapy", "1", "Prevention and repair", "33"]


def test_model_failure_keeps_the_rules(tmp_path):
    doc_path, pdf_path, output_dir = _job(tmp_path, PAPERS)
    before = doc_path.read_bytes()

    def broken(messages, **kwargs):
        raise RuntimeError("upstream 500")

    summary = _run(doc_path, pdf_path, output_dir, "model", broken)
    assert summary["statuses"] == {"request_failed": 1} and summary["written"] == 0
    assert doc_path.read_bytes() == before


def test_another_jobs_document_is_not_rewritten(tmp_path):
    doc_path, pdf_path, _output_dir = _job(tmp_path, PAPERS)
    before = doc_path.read_bytes()
    other = tmp_path / "other-job" / "translated"
    other.mkdir(parents=True)
    summary = _run(doc_path, pdf_path, other, "model", Model(_authors_back))
    assert summary["statuses"] == {"model": 1} and summary["written"] == 0
    assert doc_path.read_bytes() == before
