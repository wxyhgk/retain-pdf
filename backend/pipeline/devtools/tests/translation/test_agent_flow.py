"""翻译引擎 agent（translation.engine=agent，workflow/agent_flow.py）：用假模型整条跑通，不发网络请求。

- 整个翻译阶段：通读、逐页翻、审校，译文写回每页记录，清单记上引擎，断点收尾；
- 参考文献角标换成脚注标记交给 agent，写回时换回原写法；
- 接续组整组放进组头那一页，成员各自写回、整组字段重建；
- 退回原文的块标成死信，不卡发布门槛；
- 额度用完：阶段失败，进度留着；
- 换引擎不沿用旧断点（指纹里有引擎）；任务的密钥和地址进请求，不读 ANTHROPIC_API_KEY。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from retainpdf_translation.artifacts import blocking_untranslated_items
from retainpdf_translation.workflow import agent_flow
from retainpdf_translation.workflow.agent_flow import apply_agent_results
from retainpdf_translation.workflow.agent_flow import build_agent_pages
from retainpdf_translation.workflow.agent_flow import messages_url
from retainpdf_translation.workflow.execution import TranslationExecutionRequest
from retainpdf_translation.workflow.execution import execute_translation_request
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import QuotaExhausted


def _block(page: int, order: int, sub_type: str, text: str, bbox: list[float]) -> dict:
    block_type = "formula" if sub_type == "display_formula" else "text"
    return {
        "block_id": f"p{page + 1:03d}-b{order:04d}",
        "page_index": page,
        "order": order,
        "type": block_type,
        "sub_type": sub_type,
        "geometry": {"bbox": bbox},
        "content": {"kind": block_type, "text": text},
        "bbox": bbox,
        "text": text,
        "lines": [],
        "segments": [],
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "heading" if sub_type in ("heading", "title") else "body",
        "policy": {"translate": sub_type != "display_formula", "translate_reason": "test"},
        "provenance": {"provider": "test", "raw_label": "text", "raw_sub_type": sub_type, "raw_bbox": bbox, "raw_path": "$"},
        "continuation_hint": {"source": "", "group_id": "", "role": "", "scope": "", "reading_order": -1, "confidence": 0.0},
        "metadata": {},
        "source": {"provider": "test", "raw_type": block_type},
    }


def _document(tmp_path: Path) -> Path:
    pages = [
        [
            _block(0, 0, "title", "Geometry Optimization", [50, 40, 550, 70]),
            _block(0, 1, "body", "We minimize the energy $E(x)$ along the path. $ ^{12} $ The method converges quickly.", [50, 100, 550, 160]),
            _block(0, 2, "body", "A transition state is a first-order saddle point on the surface.", [50, 180, 550, 230]),
        ],
        [
            _block(1, 0, "heading", "1.1 Newton methods", [50, 40, 550, 60]),
            _block(1, 1, "body", "Newton methods use the Hessian $H$ to take a step of length $\\Delta x$.", [50, 80, 550, 130]),
        ],
    ]
    document = {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "document_id": "agent-engine-test",
        "source": {"provider": "test", "provider_version": "test", "raw_files": {}},
        "page_count": len(pages),
        "pages": [{"page_index": i, "width": 600.0, "height": 800.0, "unit": "pt", "blocks": blocks} for i, blocks in enumerate(pages)],
        "derived": {},
        "markers": {},
    }
    path = tmp_path / "document.v1.json"
    path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return path


def _fake_translation(text: str) -> str:
    return "[[BREAK]]".join("译文：" + part.strip() for part in text.split("[[BREAK]]"))


class FakeModel:
    """通读什么都不定，审校没有问题，翻译把每块加个中文前缀交回（公式、标记原样留着）；`fail` 里的块每次都交坏的。"""

    def __init__(self, *, fail: set[str] | None = None, stop_after: int | None = None) -> None:
        self.fail = fail or set()
        self.stop_after = stop_after
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        if self.stop_after is not None and len(self.bodies) > self.stop_after:
            raise QuotaExhausted("model API HTTP 400: credit balance too low")
        tool = body["tools"][0]["name"]
        usage = {"input_tokens": 100, "output_tokens": 20}
        if tool == "submit_reading":
            data = {"genre": "science_paper", "name_policy": "keep", "style": "", "terms": [], "headings": []}
        elif tool == "submit_review":
            data = {"issues": []}
        else:
            payload = json.loads(body["messages"][0]["content"])
            wanted = [b for b in payload["blocks"] if b.get("translate")]
            data = {
                "translations": [
                    {"id": b["id"], "translation": "坏了" if b["id"] in self.fail else _fake_translation(b["text"])} for b in wanted
                ]
            }
        return {"content": [{"type": "tool_use", "name": tool, "input": data}], "usage": usage}


def _request(tmp_path: Path, **overrides) -> TranslationExecutionRequest:
    values = dict(
        source_json_path=_document(tmp_path),
        output_dir=tmp_path / "translated",
        api_key="sk-job-key",
        model="claude-haiku-5-5",
        base_url="https://api.anthropic.com/v1",
        engine="agent",
    )
    values.update(overrides)
    return TranslationExecutionRequest(**values)


@pytest.fixture
def fake_transport(monkeypatch):
    holder: dict = {}

    def install(model: FakeModel) -> FakeModel:
        def make(api_key: str, *, url: str):
            holder["api_key"], holder["url"] = api_key, url
            return model

        monkeypatch.setattr(agent_flow, "make_http_transport", make)
        holder["model"] = model
        return model

    install.holder = holder
    return install


def _pages(output_dir: Path) -> dict[str, dict]:
    items = {}
    for path in sorted(output_dir.glob("page-*.json")):
        for item in json.loads(path.read_text(encoding="utf-8")):
            items[item["item_id"]] = item
    return items


def test_agent_engine_translates_every_page_and_finishes_the_stage(tmp_path: Path, fake_transport, monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-server-key-must-not-be-used")
    ledger = tmp_path / "usage.jsonl"
    monkeypatch.setenv("RETAIN_USAGE_LEDGER", str(ledger))
    model = fake_transport(FakeModel())
    result = execute_translation_request(_request(tmp_path))

    assert fake_transport.holder["api_key"] == "sk-job-key", "the job's credential is used, never the server environment"
    assert fake_transport.holder["url"] == "https://api.anthropic.com/v1/messages"
    tools = [b["tools"][0]["name"] for b in model.bodies]
    assert tools[0] == "submit_reading" and tools.count("submit_review") == 2, tools
    assert {b["model"] for b in model.bodies} == {"claude-haiku-5-5"}

    items = _pages(tmp_path / "translated")
    body = items["p001-b001"]
    # 角标交给 agent 时是脚注标记，写回后是原来的公式写法
    sent = [b for body_ in model.bodies if body_["tools"][0]["name"] == "submit_translations" for b in json.loads(body_["messages"][0]["content"])["blocks"]]
    assert any("{{fn:12}}" in b["text"] for b in sent if b["id"] == "p001-b001")
    assert body["translated_text"].startswith("译文：") and "$ ^{12} $" in body["translated_text"] and "{{fn:" not in body["translated_text"]
    assert "$E(x)$" in body["translated_text"]
    assert body["final_status"] == "translated"
    assert body["translation_diagnostics"]["route_path"] == ["agent"]
    assert items["p002-b001"]["translated_text"].startswith("译文：")

    manifest = json.loads((tmp_path / "translated" / "translation-manifest.json").read_text(encoding="utf-8"))
    assert manifest["engine"] == "agent"
    assert result["page_count"] == 2
    rows = [json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines()]
    assert len(rows) == len(model.bodies) and {row["stage"] for row in rows} >= {"translation", "agent_reader", "agent_review"}


def test_blocks_the_agent_gives_back_as_source_become_dead_letters(tmp_path: Path, fake_transport) -> None:
    fake_transport(FakeModel(fail={"p001-b002"}))
    execute_translation_request(_request(tmp_path))
    items = _pages(tmp_path / "translated")
    failed = items["p001-b002"]
    assert failed["final_status"] == "failed" and not failed["translated_text"]
    assert failed["translation_diagnostics"]["fallback_to"] == "dead_letter_queue"
    assert failed["translation_diagnostics"]["degradation_reason"] == "agent_fallback_source"
    assert not blocking_untranslated_items({0: list(items.values())}), "a dead letter does not block publishing"


def test_a_stopped_run_fails_the_stage_and_resumes_without_paying_again(tmp_path: Path, fake_transport) -> None:
    fake_transport(FakeModel(stop_after=3))  # 通读 + 第 1 页翻译 + 第 1 页审校，第 2 页时额度用完
    with pytest.raises(agent_flow.AgentRunStopped, match="quota_exhausted"):
        execute_translation_request(_request(tmp_path))
    items = _pages(tmp_path / "translated")
    assert items["p001-b001"]["translated_text"], "page 1 was written back before the stop"

    model = fake_transport(FakeModel())
    execute_translation_request(_request(tmp_path))
    tools = [b["tools"][0]["name"] for b in model.bodies]
    assert tools == ["submit_translations", "submit_review"], "only page 2 is requested again"


def test_engine_is_part_of_the_checkpoint_identity(tmp_path: Path) -> None:
    from retainpdf_translation.workflow.checkpoint.identity import _engine_identity

    legacy = _engine_identity(_request(tmp_path, engine="legacy"))
    agent = _engine_identity(_request(tmp_path))
    assert "engine" not in legacy, "legacy identity is unchanged so running jobs keep resuming"
    assert agent["engine"] == "agent" and agent["agent_prompt_version"]


def test_unknown_engine_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="unknown translation engine"):
        execute_translation_request(_request(tmp_path, engine="fancy"))


def _item(item_id: str, page_idx: int, text: str, *, unit: str = "", members: list[str] | None = None) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "normalized_sub_type": "body",
        "bbox": [50, 100, 550, 160],
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
        "translation_unit_id": unit or item_id,
        "translation_unit_kind": "group" if unit else "single",
        "translation_unit_member_ids": members or [item_id],
        "protected_map": [],
        "formula_map": [],
        "final_status": "",
    }


def test_continuation_groups_go_to_the_head_page_and_rebuild_group_fields() -> None:
    unit = "__cg__:cg-1"
    payloads = {
        0: [_item("p001-b001", 0, "The first half of a sentence that", unit=unit, members=["p001-b001", "p002-b000"])],
        1: [_item("p002-b000", 1, "continues on the next page.", unit=unit, members=["p001-b001", "p002-b000"]), _item("p002-b001", 1, "Another paragraph.")],
    }
    pages, _marks = build_agent_pages(payloads, {"pages": [{"page_index": 0, "width": 600, "height": 800}, {"page_index": 1, "width": 600, "height": 800}]})
    assert [b.id for b in pages[0].blocks] == ["p001-b001", "p002-b000"], "the tail of the group is translated with its head"
    assert pages[0].blocks[1].group == {"id": unit, "index": 2, "of": 2}
    assert [b.id for b in pages[1].blocks] == ["p002-b001"]
    assert pages[0].blocks[0].where == "第 1 页，通栏上部"

    results = {
        "p001-b001": BlockResult("p001-b001", "句子的前半句", [], 1, "ok"),
        "p002-b000": BlockResult("p002-b000", "在下一页接着说完。", [], 1, "ok"),
    }
    changed = apply_agent_results(payloads, results, {})
    assert changed == {0, 1}
    head, tail = payloads[0][0], payloads[1][0]
    assert head["translated_text"] == "句子的前半句" and tail["translated_text"] == "在下一页接着说完。"
    assert head["translation_unit_translated_text"] == "句子的前半句在下一页接着说完。" == tail["group_translated_text"]
    assert head["translation_unit_member_ids"] == ["p001-b001", "p002-b000"]


def test_messages_url_follows_the_job_base_url() -> None:
    assert messages_url("https://api.anthropic.com/v1") == "https://api.anthropic.com/v1/messages"
    assert messages_url("https://proxy.example/v1/") == "https://proxy.example/v1/messages"
    assert messages_url("https://proxy.example/v1/messages") == "https://proxy.example/v1/messages"
    assert messages_url("") == "https://api.anthropic.com/v1/messages"
    assert re.match(r"^https://", messages_url(""))
