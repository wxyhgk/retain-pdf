"""翻译 agent 测试系统（整套跑通）：用假模型测样例整理、翻译 agent 包的翻译和重翻、缓存和报告，不发网络请求。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import TranslationAgent as Agent

from devtools.agent_lab.__main__ import run
from devtools.agent_lab.pages import build_pages
from devtools.ocr_viewer.complex_sample import PRINTED_PAGE
from devtools.ocr_viewer.complex_sample import build


def _truth(tmp_path: Path) -> dict:
    _, truth_path = build().save(tmp_path)
    return json.loads(truth_path.read_text(encoding="utf-8"))


def _tool_response(translations: list[dict]) -> dict:
    return {
        "content": [{"type": "tool_use", "name": "submit_translations", "input": {"translations": translations}}],
        "usage": {"input_tokens": 100, "output_tokens": 50},
    }


def _requested_blocks(body: dict) -> list[dict]:
    payload = json.loads(body["messages"][0]["content"])
    return [b for b in payload["blocks"] if b["translate"]], payload


def _fake_translation(text: str) -> str:
    """假译文：每一段（接续组按 [[BREAK]] 分段）前面加"译文："，公式、引用、数字原样留着。"""
    return "[[BREAK]]".join("译文：" + part.strip() for part in text.split("[[BREAK]]"))


class FakeModel:
    """把要翻的块原样加个中文前缀交回（公式、引用、数字都保留）；可以故意弄坏某些块。"""

    def __init__(self, broken: dict[str, str] | None = None, drop: set[str] | None = None) -> None:
        self.broken = broken or {}
        self.drop = drop or set()
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        blocks, payload = _requested_blocks(body)
        retry = "retry" in payload
        out = []
        for block in blocks:
            if not retry and block["id"] in self.drop:
                continue
            text = _fake_translation(block["text"])
            if not retry and block["id"] in self.broken:
                text = self.broken[block["id"]]
            out.append({"id": block["id"], "translation": text})
        return _tool_response(out)


def test_pages_carry_class_position_formulas_and_groups(tmp_path: Path) -> None:
    pages = build_pages(_truth(tmp_path), page_labels=PRINTED_PAGE)
    assert [p.page_label for p in pages] == ["i", "1", "2"]
    blocks = {b.id: b for p in pages for b in p.blocks}
    assert "$F_1$" in blocks["abstract"].source
    assert "{{fn:1}}" in blocks["intro-p1"].source
    assert blocks["toc-store"].source == "2.2.1 Storing every relation once, on the block that points to its target"
    assert blocks["fig1-cap"].where.startswith("第 1 页，右栏")
    assert blocks["intro-zh"].translate is False and blocks["intro-zh"].translate_reason == "source_is_target_language"
    assert blocks["ref1"].translate is False
    # 跨页接续的后半段和前半段放在同一页的请求里
    page1 = next(p for p in pages if p.page_label == "1")
    ids = [b.id for b in page1.blocks]
    assert "method-p1" in ids and "method-p1-cont1" in ids
    assert blocks["method-p1-cont1"].group == {"id": "cg-method-p1", "index": 2, "of": 2}
    assert pages[2].section_path, "page 2 should know its section"


def test_broken_blocks_are_retried_alone_and_fixed(tmp_path: Path) -> None:
    fake = FakeModel(broken={"abstract": "摘要（公式丢了）"}, drop={"fig1-cap"})
    agent = Agent(model="fake", transport=fake, cache_dir=tmp_path / "cache")
    results = run(tmp_path / "out", agent=agent)
    blocks = results["blocks"]
    for key in ("abstract", "fig1-cap"):
        assert blocks[key]["attempts"] == 2 and blocks[key]["status"] != "error", blocks[key]
        assert blocks[key]["history"][0]["issues"]
    retry_bodies = [b for b in fake.bodies if "retry" in json.loads(b["messages"][0]["content"])]
    assert len(retry_bodies) == 1, "both failed blocks are on page 1 and go back in one request"
    assert sorted(b["id"] for b in _requested_blocks(retry_bodies[0])[0]) == ["abstract", "fig1-cap"]
    summary = results["summary"]
    assert summary["error"] == 0 and summary["retried"] == 2 and summary["requests"] == 3 + 1
    assert (tmp_path / "out" / "report.html").is_file()


def test_second_run_is_served_from_cache(tmp_path: Path) -> None:
    fake = FakeModel()
    run(tmp_path / "out", agent=Agent(model="fake", transport=fake, cache_dir=tmp_path / "cache"))
    calls = len(fake.bodies)
    second = run(tmp_path / "out", agent=Agent(model="fake", transport=fake, cache_dir=tmp_path / "cache"))
    assert len(fake.bodies) == calls
    assert second["summary"]["cached_requests"] == second["summary"]["requests"] == 3


def test_report_embeds_translations(tmp_path: Path) -> None:
    run(tmp_path / "out", agent=Agent(model="fake", transport=FakeModel(), cache_dir=tmp_path / "cache"))
    html = (tmp_path / "out" / "report.html").read_text(encoding="utf-8")
    blob = html.split('<script id="data" type="application/json">', 1)[1].split("</script>", 1)[0]
    data = json.loads(blob)
    translated = [b for b in data["blocks"] if b.get("translation")]
    assert translated and all(b["translation"].startswith("译文：") for b in translated)
    assert len(data["images"]) == 3


class DuplicatingModel(FakeModel):
    """第一次把跨页段落两半都译成同一句（实测 Haiku 出过这种错），重翻时分对。"""

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        blocks, payload = _requested_blocks(body)
        out = []
        for block in blocks:
            text = _fake_translation(block["text"])
            if "retry" not in payload and block["id"] == "cg-method-p1":
                dup = "最后凡被栏或页分隔的段落都保留指向其所接续块的指针"
                head, tail = block["text"].split("[[BREAK]]")
                text = f"译文：{dup}{head}[[BREAK]]译文：{dup}{tail}"
            out.append({"id": block["id"], "translation": text})
        return _tool_response(out)


def test_duplicated_text_across_a_continuation_group_is_caught_and_the_group_retried(tmp_path: Path) -> None:
    fake = DuplicatingModel()
    results = run(tmp_path / "out", agent=Agent(model="fake", transport=fake, cache_dir=tmp_path / "cache"))
    head, tail = results["blocks"]["method-p1"], results["blocks"]["method-p1-cont1"]
    for block in (head, tail):
        assert block["attempts"] == 2 and block["status"] != "error", block
        assert any(i["code"] == "group_overlap" for i in block["history"][0]["issues"])
    retries = [json.loads(b["messages"][0]["content"]) for b in fake.bodies]
    retries = [p for p in retries if "retry" in p]
    assert len(retries) == 1 and [r["id"] for r in retries[0]["retry"]] == ["cg-method-p1"]
    assert [b["id"] for b in retries[0]["blocks"] if b["translate"]] == ["cg-method-p1"]


def test_continuation_group_is_sent_as_one_record_with_break_markers(tmp_path: Path) -> None:
    from retainpdf_translation_agent.agent import BREAK
    from retainpdf_translation_agent.agent import expand_translations
    from retainpdf_translation_agent.agent import request_records

    page = next(p for p in build_pages(_truth(tmp_path), page_labels=PRINTED_PAGE) if p.page_label == "1")
    wanted = {b.id for b in page.to_translate()}
    records = request_records(page.to_input({}).blocks, wanted)
    group = next(r for r in records if r["id"] == "cg-method-p1")
    assert group["members"] == ["method-p1", "method-p1-cont1"] and group["text"].count(BREAK) == 1
    assert not any(r["id"] in {"method-p1", "method-p1-cont1"} for r in records)
    blocks = page.to_input({}).blocks
    per_block, issues = expand_translations({"cg-method-p1": "前半[[BREAK]]后半"}, blocks, wanted)
    assert per_block["method-p1"] == "前半" and per_block["method-p1-cont1"] == "后半" and not issues
    _, issues = expand_translations({"cg-method-p1": "没有断点"}, blocks, wanted)
    assert issues["method-p1"][0]["code"] == "group_break"
