"""认上下文的接线：文字层可见不可见、截图、结果和缓存（输入一样就重放、不再调模型；请求失败不缓存）、请求标签。
要装 [engine]（翻译底座）和 PyMuPDF。"""
from __future__ import annotations

import json

import pytest

pytest.importorskip("retainpdf_translation")
fitz = pytest.importorskip("fitz")

from retainpdf_toc_agent import ChatResult  # noqa: E402
from retainpdf_toc_agent_engine import CONTEXT_RESULT_FILE_NAME  # noqa: E402
from retainpdf_toc_agent_engine import text_layer_kind  # noqa: E402
from retainpdf_toc_agent_engine import toc_context  # noqa: E402
from retainpdf_toc_agent_engine import toc_page_screenshot  # noqa: E402
from retainpdf_toc_agent.context import PageDraft  # noqa: E402


def _pdf(*, invisible=False):
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    y = 100
    for title, label in (("Analyzing the Audience", "1"), ("References", "13")):
        page.insert_text((90, y), title, fontsize=11, render_mode=3 if invisible else 0)
        page.insert_text((350, y), label, fontsize=11, render_mode=3 if invisible else 0)
        y += 22
    return pdf


def _draft_dict(**extra):
    fragments = [
        {"id": "f1", "line": 1, "text": "Analyzing the Audience", "role": "title", "bbox": [90, 90, 210, 103], "size": 11},
        {"id": "f2", "line": 1, "text": "1", "role": "page", "bbox": [350, 90, 356, 103], "size": 11},
        {"id": "f3", "line": 2, "text": "References", "role": "title", "bbox": [90, 112, 150, 125], "size": 11},
        {"id": "f4", "line": 2, "text": "13", "role": "page", "bbox": [350, 112, 362, 125], "size": 11},
    ]
    return {"page_index": 0, "parent_block_id": "p001-b0001", "region": [50, 80, 380, 140], "page_size": [420, 600],
            "accepted": True, "reason": "", "fragments": fragments,
            "entries": [{"fragments": ["f1", "f2"], "level": 1}, {"fragments": ["f3", "f4"], "level": 1}], **extra}


class Model:
    def __init__(self, reply=None, error=None):
        self.calls, self.reply, self.error = [], reply, error

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return ChatResult(json.dumps(self.reply or {"actions": [{"tool": "done"}]}))


def test_text_layer_kind_tells_scans_apart():
    with _pdf() as pdf:
        assert text_layer_kind(pdf[0], [50, 80, 380, 140]) == "visible"
    with _pdf(invisible=True) as pdf:
        assert text_layer_kind(pdf[0], [50, 80, 380, 140]) == "invisible"


def test_screenshot_is_a_png_with_line_numbers_the_executor_accepts():
    from retainpdf_translation.llm.shared.model_wire import executor_accepts_images
    from retainpdf_translation.llm.shared.model_wire import image_part

    with _pdf() as pdf:
        before = pdf[0].get_text()
        data, media_type = toc_page_screenshot(pdf[0], PageDraft.from_dict(_draft_dict()))
        assert pdf[0].get_text() == before, "原页不改"
    pixmap = fitz.Pixmap(data)
    assert media_type == "image/png" and 1000 <= max(pixmap.width, pixmap.height) <= 1400
    part = image_part(data, media_type)
    assert executor_accepts_images([{"role": "user", "content": [part, {"type": "text", "text": "目录"}]}])


def test_rules_mode_records_signals_and_sends_nothing(tmp_path):
    with _pdf() as pdf:
        outcomes = toc_context([_draft_dict()], pdf=pdf, output_dir=tmp_path, mode="rules", chat_fn=None)
    assert [outcome.status for outcome in outcomes] == ["not_asked"]
    record = json.loads((tmp_path / CONTEXT_RESULT_FILE_NAME).read_text(encoding="utf-8"))
    assert record["schema"] == "toc_context_result_v1" and record["mode"] == "rules"
    assert record["summary"]["flagged"] == 1 and record["summary"]["signals"] == {"few_entries": 1}
    assert record["summary"]["requests"] == 0
    assert record["pages"][0]["draft"]["text_layer"] == "visible"


def test_off_mode_does_nothing(tmp_path):
    assert toc_context([_draft_dict()], pdf=None, output_dir=tmp_path, mode="off") == []
    assert not (tmp_path / CONTEXT_RESULT_FILE_NAME).exists()


def test_model_mode_sends_the_screenshot_and_replays_from_the_cache(tmp_path):
    model = Model()
    with _pdf() as pdf:
        run = lambda: toc_context([_draft_dict()], pdf=pdf, output_dir=tmp_path, mode="model", chat_fn=model,  # noqa: E731
                                  model_identity={"model": "m"})
        first = run()
        assert len(model.calls) == 1
        content = model.calls[0][1]["content"]
        assert content[0]["type"] == "image_url" and content[0]["image_url"]["url"].startswith("data:image/png;base64,")
        second = run()
    assert len(model.calls) == 1, "输入一样：重放上次的结果，不再调模型"
    assert [o.status for o in first] == [o.status for o in second] == ["model"]
    # 换了模型就重新问
    with _pdf() as pdf:
        toc_context([_draft_dict()], pdf=pdf, output_dir=tmp_path, mode="model", chat_fn=model, model_identity={"model": "other"})
    assert len(model.calls) == 2


def test_failed_requests_are_not_cached(tmp_path):
    broken = Model(error=RuntimeError("down"))
    with _pdf() as pdf:
        outcomes = toc_context([_draft_dict()], pdf=pdf, output_dir=tmp_path, mode="model", chat_fn=broken)
        assert outcomes[0].status == "request_failed"
        model = Model()
        toc_context([_draft_dict()], pdf=pdf, output_dir=tmp_path, mode="model", chat_fn=model)
    assert len(model.calls) == 1


def test_previous_translation_rejections_are_a_signal(tmp_path):
    (tmp_path / "toc-agent.v1.json").write_text(json.dumps({"rejected": {"References": "number_changed", "Other": "empty"}}))
    outcomes = toc_context([_draft_dict()], pdf=None, output_dir=tmp_path, mode="rules")
    assert "translation_rejected" in outcomes[0].signals


def test_context_requests_carry_their_own_label(monkeypatch):
    import retainpdf_toc_agent_engine.llm as engine_llm
    from retainpdf_base.usage_ledger import usage_stage

    labels = []
    monkeypatch.setattr(engine_llm, "request_chat_content", lambda messages, **kwargs: labels.append(kwargs["request_label"]) or "{}")
    monkeypatch.setattr(engine_llm, "raise_if_credential_rejected", lambda *args, **kwargs: None)
    chat = engine_llm.toc_chat_fn(model="m", base_url="http://127.0.0.1:9", api_key="k")
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}
    chat([{"role": "user", "content": [image, {"type": "text", "text": "目录"}]}], purpose="toc_context")
    chat([{"role": "user", "content": "目录"}], purpose="toc_translate")
    assert labels == ["toc-translate-context", "toc-translate"]
    assert {usage_stage(label) for label in labels} == {"toc_translation"}, "用量台账都记在目录翻译下"
