"""翻译引擎 agent（translation.engine=agent，retainpdf_translation_agent_engine/agent_flow.py）：用假模型整条跑通，不发网络请求。

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
from retainpdf_translation_agent_engine import agent_flow
from retainpdf_translation_agent_engine.agent_flow import apply_agent_results
from retainpdf_translation_agent_engine.agent_flow import build_agent_pages
from retainpdf_translation_agent_engine.agent_flow import messages_url
from retainpdf_translation.workflow.execution import TranslationExecutionRequest
from retainpdf_translation.workflow.execution import execute_translation_request
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import format_answer


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
    return "译文：" + text.strip()


class FakeModel:
    """通读什么都不定，审校没有问题，翻译把每块加个中文前缀交回（公式、标记原样留着）；`fail` 里的块每次都交坏的。"""

    def __init__(self, *, fail: set[str] | None = None, stop_after: int | None = None, genre: str = "science_paper") -> None:
        self.fail = fail or set()
        self.genre = genre
        self.stop_after = stop_after
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        if self.stop_after is not None and len(self.bodies) > self.stop_after:
            raise QuotaExhausted("model API HTTP 400: credit balance too low")
        tool = body["tools"][0]["name"] if "tools" in body else "plain_text"
        usage = {"input_tokens": 100, "output_tokens": 20}
        if tool == "submit_reading":
            data = {"genre": self.genre, "name_policy": "keep", "style": "", "terms": [], "headings": []}
        elif tool == "submit_review":
            data = {"issues": []}
        elif tool == "submit_rewrite":
            data = {"blocks": []}
        elif body["messages"][0]["content"].lstrip().startswith(("人名、术语的译法", "上一节", "下面是这一节的原稿")):
            # 按节翻（第二版）：稿子每段照编号交回，占位、标记原样留着
            manuscript = body["messages"][0]["content"]
            paragraphs = re.findall(r"^¶(\d+)(?:（[^）]*）)? (.*)$", manuscript, re.M)
            text = "\n\n".join(f"¶{n} {_fake_translation(source)}" for n, source in paragraphs)
            return {"content": [{"type": "text", "text": text}], "usage": usage}
        else:
            payload = json.loads(body["messages"][0]["content"])
            wanted = [b for b in payload["blocks"] if b.get("translate")]
            # 初译交回纯文本（交卷格式）
            text = format_answer({b["id"]: "坏了" if b["id"] in self.fail else _fake_translation(b["text"]) for b in wanted})
            return {"content": [{"type": "text", "text": text}], "usage": usage}
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
        def make(api_key: str, *, url: str, on_wait=None):
            holder["api_key"], holder["url"], holder["on_wait"] = api_key, url, on_wait
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
    tools = [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]
    assert tools[0] == "submit_reading" and tools.count("submit_review") == 2, tools
    assert {b["model"] for b in model.bodies} == {"claude-haiku-5-5"}

    items = _pages(tmp_path / "translated")
    body = items["p001-b001"]
    # 角标交给 agent 时是脚注标记，写回后是原来的公式写法
    sent = [b for body_ in model.bodies if "tools" not in body_ for b in json.loads(body_["messages"][0]["content"])["blocks"]]
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


def test_editorial_events_are_written_where_the_api_reads_them(tmp_path: Path, fake_transport) -> None:
    fake_transport(FakeModel())
    execute_translation_request(_request(tmp_path))
    path = tmp_path / "translated" / agent_flow.EDITORIAL_EVENTS_RELATIVE_PATH
    events = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
    assert events[0]["type"] == "run_started" and events[0]["pages"] == 2 and events[0]["model"] == "claude-haiku-5-5"
    assert events[-1]["type"] == "run_done"
    assert {e["v"] for e in events} == {"editorial.v1"}
    # rust_api 按同一个相对路径找（retainpdf-core 的 storage_paths 常量）
    constants = Path(__file__).resolve().parents[4] / "packages/retainpdf-core/src/storage_paths/constants.rs"
    assert f'"{agent_flow.EDITORIAL_EVENTS_RELATIVE_PATH}"' in constants.read_text(encoding="utf-8")


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
    tools = [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]
    assert tools == ["plain_text", "submit_review"], "only page 2 is requested again"


def test_agent_engine_skips_translation_preparation(tmp_path: Path, fake_transport) -> None:
    """agent 自带通读：请求里带了 preparation 也不跑术语预扫、术语审定（不重复花钱）。"""
    model = fake_transport(FakeModel())
    execute_translation_request(_request(tmp_path, preparation="editorial"))
    assert not (tmp_path / "translated" / "term-base.v1.json").exists()
    assert not (tmp_path / "translated" / "style-guide.v1.json").exists()
    # 都是 agent 的请求：通读、审校用 submit_ 工具，初译按交卷格式交纯文本
    # 系统提示是带缓存断点的文本块（2026-10-31）
    assert all(b["tools"][0]["name"].startswith("submit_") if "tools" in b else "@@" in b["system"][0]["text"] for b in model.bodies)


def test_only_citation_superscripts_become_footnote_marks() -> None:
    """引用角标（正整数、列表、范围）换成脚注标记；单位的指数、乘方留作公式。2026-10-31 ACS 论文：
    "ng mL $ ^{-1} $" 以前被换成 {{fn:-1}}，模型写回 $^{-1}$，校验报脚注标记丢了，Methods 6 段整段退回原文。"""
    source = (
        "as described previously. $ ^{34} $ Cells were seeded (100 ng mL $ ^{-1} $) at $ 2 \\times 10 $ $ ^{5} $ per well "
        "into 100 mm $ ^{3} $ tumors, see refs $ ^{40, 52, 53} $ and $ ^{2-6} $."
    )
    text, marks = agent_flow._agent_text({"text": source, "source_text": source}, "paragraph")
    assert re.findall(r"\{\{fn:([^}]+)\}\}", text) == ["34", "40,52,53", "2-6"]
    assert "mL $ ^{-1} $" in text and "$ ^{5} $" in text and "mm $ ^{3} $" in text
    assert agent_flow._restore_marks(text, marks) == source
    # 表里没有的标记（接续组切开时从另一块挪过来）写成上标公式，不让 {{fn:…}} 露在译文里
    assert agent_flow._restore_marks("由于高表达，{{fn:13,33}} 降低", {}) == "由于高表达，$ ^{13,33} $ 降低"


def test_engine_is_part_of_the_checkpoint_identity(tmp_path: Path) -> None:
    from retainpdf_translation.workflow.checkpoint.identity import _engine_identity

    legacy = _engine_identity(_request(tmp_path, engine="legacy"))
    agent = _engine_identity(_request(tmp_path))
    assert "engine" not in legacy, "legacy identity is unchanged so running jobs keep resuming"
    assert agent["engine"] == "agent" and agent["agent_prompt_version"]


def test_a_retried_job_answers_old_requests_from_the_shared_cache(tmp_path: Path, fake_transport) -> None:
    """重试翻译会新建任务（新的任务目录）：请求缓存在各任务共用的目录里，问过的一模一样的请求不再发。
    以前缓存在任务自己的目录下，2026-10-30 用户重试一次论文翻译，44 次请求全部重新付费。"""
    from retainpdf_base import paths

    fake_transport(FakeModel())
    execute_translation_request(_request(tmp_path))
    assert any(paths.AGENT_REQUEST_CACHE_DIR.glob("*.json")), "answers are cached in the shared directory"
    assert not (tmp_path / "translated" / "agent" / "cache").exists()

    retried = tmp_path / "retry-job"
    retried.mkdir()
    model = fake_transport(FakeModel())
    execute_translation_request(_request(tmp_path, output_dir=retried / "translated"))
    assert model.bodies == [], "every request of the retried job is answered from the shared cache"
    assert _pages(retried / "translated")["p001-b001"]["translated_text"].startswith("译文：")


def test_new_check_rules_reset_the_state(tmp_path: Path, monkeypatch) -> None:
    """检查规则改了（CHECKS_VERSION 升了）：旧进度不再沿用，整篇按新规则重判。"""
    import retainpdf_translation_agent

    pages = [agent_flow.PageInput(page_label="1", blocks=[agent_flow.BlockInput("b1", "paragraph", "Text.", True)])]
    state = tmp_path / "agent"
    agent_flow._prepare_state_dir(state, pages, "claude-haiku-5-5")
    (state / "run").mkdir()
    (state / "run" / "progress.json").write_text("{}", encoding="utf-8")

    agent_flow._prepare_state_dir(state, pages, "claude-haiku-5-5")
    assert (state / "run" / "progress.json").exists(), "same identity: the run resumes"

    monkeypatch.setattr(retainpdf_translation_agent, "CHECKS_VERSION", "translation-agent-checks-test")
    agent_flow._prepare_state_dir(state, pages, "claude-haiku-5-5")
    assert not (state / "run").exists(), "new check rules: the old progress is dropped"
    assert json.loads((state / agent_flow.STATE_FINGERPRINT).read_text(encoding="utf-8"))["agent_checks_version"] == "translation-agent-checks-test"


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


def test_the_agent_gets_the_same_thinking_effort_as_legacy() -> None:
    """off、auto（claude-haiku-5-5）都是 low；明确的档位照用；别的模型 auto 不发字段（2026-10-31）。"""
    from retainpdf_translation.llm.shared import model_wire
    from retainpdf_translation_agent_engine.agent_flow import agent_effort

    base = "https://api.anthropic.com/v1"
    try:
        for thinking, model, expected in (
            ("off", "claude-haiku-5-5", "low"),
            ("auto", "claude-haiku-5-5", "low"),
            ("high", "claude-haiku-5-5", "high"),
            ("auto", "claude-sonnet-5", None),
        ):
            model_wire.register_connection(base_url=base, model=model, protocol="anthropic", thinking=thinking)
            assert agent_effort(base_url=base, model=model) == expected, (thinking, model)
    finally:
        model_wire.clear_registered_connections()


def test_job_data_registers_the_agent_glossary_where_and_how_the_agent_writes_it():
    """术语页读的 agent_terms / agent_term_tickets（契约 job-data.v1）要和 agent 真写出来的 glossary.json 对得上：
    文件在 translated/ 下的位置、每个登记字段的路径。"""
    from retainpdf_translation_agent import Glossary

    contract = json.loads(
        (Path(__file__).resolve().parents[5] / "contracts" / "job-data.v1.schema.json").read_text(encoding="utf-8")
    )
    glossary = Glossary()
    glossary.add("transformer", "Transformer", category="keep", reason="用户", page="3", quote="the transformer")
    glossary.propose("attention", "注意力", category="term", block_id="p003-b001", page="3", chapter="1", quote="q")
    glossary.propose("attention", "关注", category="term", block_id="p004-b002", page="4", chapter="1", quote="q2")
    payload = glossary.to_dict()
    assert payload["tickets"], "要有一张歧义单才测得到 tickets 的字段"

    def at(row, path):
        for part in path.split("."):
            assert isinstance(row, dict) and part in row, path
            row = row[part]
        return row

    for name in ("agent_terms", "agent_term_tickets"):
        spec = contract["datasets"][name]
        assert spec["source"]["root"] == "translated"
        assert spec["source"]["file"] == f"{agent_flow.AGENT_STATE_DIR}/{agent_flow.RUN_DIR}/glossary.json"
        rows = at(payload, spec["source"]["rows"].strip("/"))
        for field_name, field in spec["fields"].items():
            at(rows[0], field.get("path", field_name))
        for path in spec["identity"].values():
            assert re.fullmatch(r"p\d+-b\d+", at(rows[0], path)), "item_id 要是 pNNN-bNNN，页码才推得出来"


def test_a_separate_reviewer_model_does_the_editing_on_its_own_connection(tmp_path: Path, monkeypatch) -> None:
    """用户另配了审校模型：人文书的两轮（审意思、改文笔，2026-11-19 起）都走它的连接和 Key，通读、初译走翻译模型；用量台账按模型分开记。"""
    monkeypatch.setenv("RETAIN_AGENT_STRUCTURE", "page")  # 第一版（逐页）的两轮；第二版见下一条
    translator, editor = FakeModel(genre="humanities"), FakeModel(genre="humanities")
    by_key = {"sk-job-key": translator, "sk-editor": editor}
    monkeypatch.setattr(agent_flow, "make_http_transport", lambda api_key, *, url, on_wait=None: by_key[api_key])
    ledger = tmp_path / "usage.jsonl"
    monkeypatch.setenv("RETAIN_USAGE_LEDGER", str(ledger))
    execute_translation_request(_request(tmp_path, reviewer_model="claude-editor", reviewer_api_key="sk-editor"))

    tools = lambda model: [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]  # noqa: E731
    assert tools(editor) == ["submit_review", "submit_rewrite"] * 2, "humanities books: review for meaning, then polish, on every page"
    assert {b["model"] for b in editor.bodies} == {"claude-editor"}
    assert "submit_rewrite" not in tools(translator) and tools(translator)[0] == "submit_reading"
    assert {b["model"] for b in translator.bodies} == {"claude-haiku-5-5"}
    rows = [json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines()]
    assert sorted({row["model"] for row in rows}) == ["claude-editor", "claude-haiku-5-5"]


def test_humanities_books_are_translated_by_section_by_default(tmp_path: Path, monkeypatch) -> None:
    """2026-11-19 起人文社科、通俗读物默认按节翻（第二版）：初译整节一次走翻译模型，整节审一次意思走另配的审校模型，不做文笔那一轮。"""
    monkeypatch.delenv("RETAIN_AGENT_STRUCTURE", raising=False)
    translator, editor = FakeModel(genre="humanities"), FakeModel(genre="humanities")
    by_key = {"sk-job-key": translator, "sk-editor": editor}
    monkeypatch.setattr(agent_flow, "make_http_transport", lambda api_key, *, url, on_wait=None: by_key[api_key])
    result = execute_translation_request(_request(tmp_path, reviewer_model="claude-editor", reviewer_api_key="sk-editor"))

    tools = lambda model: [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]  # noqa: E731
    assert tools(translator) == ["submit_reading", "plain_text"], "通读一次，整节初译一次"
    assert "下面是这一节的原稿" in translator.bodies[1]["messages"][0]["content"]
    assert tools(editor) == ["submit_review"], "整节审一次意思，不做文笔那一轮"
    assert result is not None


def test_without_a_reviewer_model_science_books_keep_the_ticket_review(tmp_path: Path, fake_transport) -> None:
    model = fake_transport(FakeModel(genre="science_paper"))
    execute_translation_request(_request(tmp_path, reviewer_model="claude-haiku-5-5"))  # 和翻译模型同名：不另开连接
    tools = [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]
    assert tools.count("submit_review") == 2 and "submit_rewrite" not in tools


def test_agent_structure_is_section_unless_page_is_asked_for(monkeypatch) -> None:
    """翻译 agent 第二版（按节翻）2026-11-19 起是默认；RETAIN_AGENT_STRUCTURE=page 退回逐页，别的值、没设都按节。"""
    from retainpdf_translation_agent_engine.agent_flow import agent_structure

    monkeypatch.delenv("RETAIN_AGENT_STRUCTURE", raising=False)
    assert agent_structure() == "section"
    for value, expected in (("section", "section"), (" PAGE ", "page"), ("page", "page"), ("chapter", "section"), ("", "section")):
        monkeypatch.setenv("RETAIN_AGENT_STRUCTURE", value)
        assert agent_structure() == expected, value


def test_the_book_title_comes_from_the_pdf_metadata_before_the_first_ocr_title(tmp_path: Path) -> None:
    """11-20《The Interloper》：封面是图，OCR 的第一个标题块是第一章的 Introduction，通读、初译、审校、兜底收到的书名都是它。
    现在先看原 PDF 元数据，垃圾值（文件名、Microsoft Word 开头、纯数字）不要，再退回第一个标题块。"""
    import fitz

    def pdf(title: str) -> Path:
        path = tmp_path / f"book-{abs(hash(title))}.pdf"
        document = fitz.open()
        document.new_page()
        document.set_metadata({"title": title})
        document.save(path)
        document.close()
        return path

    payloads = {0: [{"normalized_sub_type": "body", "source_text": "Cover"}], 1: [{"normalized_sub_type": "title", "source_text": "Introduction"}]}
    assert agent_flow._document_title(payloads, pdf("The Interloper")) == "The Interloper"
    for junk in ("", "Microsoft Word - draft.docx", "interloper_final.pdf", "12345", "Untitled"):
        assert agent_flow._document_title(payloads, pdf(junk)) == "Introduction", junk
    assert agent_flow._document_title(payloads, None) == "Introduction"
    assert agent_flow._document_title(payloads, tmp_path / "missing.pdf") == "Introduction"


def test_prices_are_escaped_and_spaced_superscripts_become_footnote_marks() -> None:
    """11-20《The Interloper》："$12.59 to $17" 被当成公式、to 没翻；OCR 写成 "$ ^{1 1} $" 的上标角标漏成原样。"""
    text, marks = agent_flow._agent_text({"source_text": "Wages ran from $12.59 to $17 an hour.$ ^{1 1} $ See $x$."}, "paragraph")
    assert text == "Wages ran from \\$12.59 to \\$17 an hour.{{fn:11}} See $x$."
    assert marks == {"11": "$ ^{1 1} $"}


def test_running_headers_and_the_back_index_keep_the_original(tmp_path: Path) -> None:
    """页眉 "[170] NOTES" 被 OCR 认成标题、通读定成「[170] 注释」；书后的索引被逐条翻成中文（页码是英文版的、排序全乱）。"""
    import fitz

    pdf_path = tmp_path / "book.pdf"
    document = fitz.open()
    for _ in range(12):
        document.new_page()
    document.set_page_labels([{"startpage": 0, "prefix": "", "style": "r", "firstpagenum": 1}, {"startpage": 2, "prefix": "", "style": "D", "firstpagenum": 1}])
    document.save(pdf_path)
    document.close()

    def item(sub_type: str, text: str) -> dict:
        return {"normalized_sub_type": sub_type, "source_text": text, "should_translate": True}

    payloads = {i: [item("body", f"Body text on page {i + 1}.")] for i in range(12)}
    payloads[8] = [item("heading", "[7] NOTES"), item("body", "1. Keenan 2013, xxiv.")]  # PDF 第 9 页印着 7
    payloads[4] = [item("heading", "2 METHODS"), item("body", "We met.")]  # 印着 3：数字对不上，是正经标题
    payloads[10] = [item("body", "Last words."), item("heading", "Index"), item("body", "access, 49–50"), item("body", "Keenan, Marie, 92")]
    payloads[11] = [item("body", "Lamont, Michèle, 163n3")]

    counts = agent_flow.skip_back_matter(payloads, pdf_path)
    assert counts == {"running_header": 1, "index": 3}
    assert payloads[8][0]["should_translate"] is False and payloads[8][0]["skip_reason"] == "skip_running_header"
    assert payloads[4][0]["should_translate"] is True
    assert [i["should_translate"] for i in payloads[10]] == [True, True, False, False], "索引标题照翻，后面的条目保留原文"
    assert payloads[11][0]["skip_reason"] == "skip_back_matter_index"

    # 没有 PDF 页码标签：拿页脚页码算页码差；都没有就不认页眉
    plain = {i: [item("page_number", str(i - 1)), item("body", "x")] for i in range(2, 8)}
    plain[6].insert(0, item("heading", "CHAPTER NOTES 5"))
    assert agent_flow.skip_back_matter(plain)["running_header"] == 1
    assert agent_flow.skip_back_matter({0: [item("heading", "[7] NOTES")]})["running_header"] == 0
    early = {i: [item("body", "x")] for i in range(10)}
    early[2] = [item("heading", "Index"), item("body", "an early section called Index")]
    assert agent_flow.skip_back_matter(early)["index"] == 0, "只在书的最后四分之一认索引"


def test_blocks_with_nothing_to_translate_keep_the_original_before_the_agent(tmp_path: Path) -> None:
    """《The Interloper》书末注释 "35. Brown-Saracino 2014, 43." 交给模型、原样交回判漏翻，进了死信，阅读页「待处理」当问题列出来。
    现在交给 agent 之前就记成保留原文（和页眉、书后索引一样），写明原因；接续组的成员不管。"""
    from retainpdf_translation.core.payload import load_translations
    from retainpdf_translation.core.payload import save_translations
    from retainpdf_translation_agent_engine.reclassify import reclassify_failed_blocks

    def item(item_id: str, text: str, **extra) -> dict:
        return {"item_id": item_id, "normalized_sub_type": "body", "source_text": text, "should_translate": True, **extra}

    payloads = {0: [
        item("p001-b000", "35. Brown-Saracino 2014, 43."),
        item("p001-b001", "$$x^2$$"),
        item("p001-b002", "The puppeteers voted to join the guild."),
        item("p001-b003", "Ibid., 45.", translation_unit_member_ids=["p001-b002", "p001-b003"]),
    ]}
    assert agent_flow.skip_nothing_to_translate(payloads) == {"skip_citation_only": 1, "skip_no_prose": 1}
    first, formula, prose, member = payloads[0]
    assert (first["should_translate"], first["final_status"], first["skip_reason"]) == (False, "kept_origin", "skip_citation_only")
    assert formula["skip_reason"] == "skip_no_prose"
    assert prose["should_translate"] is True and member["should_translate"] is True

    # 以前翻好的书：失败的块按同一条规则改记，不用重翻；真没翻成的正文照旧是失败
    translated = tmp_path / "translated"
    translated.mkdir()
    page = translated / "page-001-deepseek.json"
    save_translations(page, [
        item("p001-b000", "35. Brown-Saracino 2014, 43.", final_status="failed"),
        item("p001-b001", "The puppeteers voted to join the guild.", final_status="failed"),
        item("p001-b002", "Ibid., 45.", final_status="translated"),
    ])
    assert [c["item_id"] for c in reclassify_failed_blocks(translated, apply=False)] == ["p001-b000"]
    assert load_translations(page, strict_contract=False)[0]["final_status"] == "failed", "不加 --apply 不写盘"
    reclassify_failed_blocks(translated, apply=True)
    rows = load_translations(page, strict_contract=False)
    assert [(r["final_status"], r.get("skip_reason", "")) for r in rows] == [
        ("kept_origin", "skip_citation_only"), ("failed", ""), ("translated", "")
    ]


def test_a_page_kept_whole_in_the_original_is_saved_as_kept(tmp_path: Path, fake_transport) -> None:
    """整页都在交给 agent 之前标成保留原文（书后的注释页、索引页）：以前那一页不重新存盘，记录里还是「要翻、没状态」
    （11-20《The Interloper》书后索引 95 块、书名页都这样）。"""
    from dataclasses import replace as dc_replace

    fake_transport(FakeModel())
    request = _request(tmp_path)
    document = json.loads(request.source_json_path.read_text(encoding="utf-8"))
    document["pages"].append({"page_index": 2, "width": 600.0, "height": 800.0, "unit": "pt",
                              "blocks": [_block(2, 0, "body", "35. Keenan 2013, xxiv.", [50, 100, 550, 130])]})
    document["page_count"] = 3
    request.source_json_path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    execute_translation_request(dc_replace(request, end_page=-1))
    note = _pages(tmp_path / "translated")["p003-b000"]
    assert (note["should_translate"], note["final_status"], note["skip_reason"]) == (False, "kept_origin", "skip_citation_only")
