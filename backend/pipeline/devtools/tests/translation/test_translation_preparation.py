"""译前准备（术语预扫 + 风格指南）：全部用 mock LLM，不发任何网络请求。"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from retainpdf_pipeline.translate.llm.shared import cache
from retainpdf_pipeline.translate.llm.shared.control_context import normalize_preparation_mode
from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages
from retainpdf_pipeline.translate.services.context.session_context import build_translation_context_from_policy
from retainpdf_pipeline.translate.services.policy import build_translation_policy_config
from retainpdf_pipeline.translate.services.preparation import prepare_translation
from retainpdf_pipeline.translate.services.preparation.segments import PrescanSegment
from retainpdf_pipeline.translate.services.preparation.segments import build_prescan_batches
from retainpdf_pipeline.translate.services.preparation.segments import estimate_tokens
from retainpdf_pipeline.translate.services.preparation.segments import mask_math
from retainpdf_pipeline.translate.services.preparation.style_guide import render_style_guidance
from retainpdf_pipeline.translate.services.preparation.term_base import build_term_base_terms
from retainpdf_pipeline.translate.services.preparation.term_base import term_base_glossary_entries
from retainpdf_pipeline.translate.services.preparation.term_prescan import PrescanBatchResult
from retainpdf_pipeline.translate.services.preparation.term_prescan import PrescanTerm
from retainpdf_pipeline.translate.services.preparation.term_prescan import filter_prescan_terms
from retainpdf_pipeline.translate.services.preparation.term_prescan import run_term_prescan
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.workflow.checkpoint.identity import build_translation_identity
from retainpdf_pipeline.translate.workflow.checkpoint.preparation import PrescanCheckpoint
from retainpdf_pipeline.translate.workflow.checkpoint.preparation import prescan_checkpoint_path
from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest
from retainpdf_pipeline.translate.workflow.execution import resolve_reviewer_connection
from retainpdf_pipeline.translate.workflow.execution_plan import build_translation_execution_plan

MODEL = "mock-model"
BASE_URL = "https://mock.invalid/v1"

PARAGRAPHS = [
    "The harmonic oscillator is the simplest model of molecular vibration.",
    "Solving the Schrödinger equation for the harmonic oscillator gives $E_n = (n + 1/2) h\\nu$ levels.",
    "The force constant $k$ determines the vibrational frequency of the harmonic oscillator.",
    "Max Planck introduced the quantum of energy, and the harmonic oscillator was quantized.",
    "In MATLAB we plot the wave function $\\psi(x)$ of the harmonic oscillator.",
]


def _block(page_idx: int, order: int, text: str, *, block_type: str = "text", role: str = "body") -> dict:
    block_id = f"p{page_idx + 1:03d}-b{order:04d}"
    return {
        "block_id": block_id,
        "page_index": page_idx,
        "order": order,
        "type": block_type,
        "sub_type": "",
        "geometry": {"bbox": [0, order * 20, 150, order * 20 + 18]},
        "content": {"kind": "text", "text": text},
        "bbox": [0, order * 20, 150, order * 20 + 18],
        "text": text,
        "lines": [],
        "segments": [],
        "layout_role": "paragraph",
        "semantic_role": role,
        "structure_role": "body",
        "policy": {"translate": True, "translate_reason": "test"},
        "provenance": {
            "provider": "test",
            "raw_label": block_type,
            "raw_sub_type": "",
            "raw_bbox": [0, 0, 150, 20],
            "raw_path": f"$.pages[{page_idx}].blocks[{order}]",
        },
        "continuation_hint": {
            "source": "",
            "group_id": "",
            "role": "",
            "scope": "",
            "reading_order": -1,
            "confidence": 0.0,
        },
        "metadata": {},
        "source": {"provider": "test", "raw_type": block_type},
    }


def _write_document(tmp_path: Path) -> Path:
    pages = []
    for page_idx in range(2):
        blocks = [_block(page_idx, order, text) for order, text in enumerate(PARAGRAPHS)]
        blocks.append(_block(page_idx, len(blocks), "$$ E = \\hbar \\omega (n + 1/2) $$", block_type="formula"))
        pages.append({"page_index": page_idx, "width": 200.0, "height": 200.0, "unit": "pt", "blocks": blocks})
    source_json = tmp_path / "document.v1.json"
    source_json.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "schema_version": "1.1",
                "document_id": "preparation-test",
                "source": {"provider": "test", "provider_version": "test", "raw_files": {}},
                "page_count": len(pages),
                "pages": pages,
                "derived": {},
                "markers": {},
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return source_json


class MockLLM:
    """按请求类型返回固定 JSON；可以让指定次数的预扫请求失败，模拟中断。"""

    def __init__(self, *, fail_prescan_calls: set[int] | None = None, style_fails: bool = False):
        self.prescan_calls = 0
        self.style_calls = 0
        self.fail_prescan_calls = set(fail_prescan_calls or ())
        self.style_fails = style_fails
        self.prescan_messages: list[list[dict]] = []

    def __call__(self, messages, **kwargs):
        label = str(kwargs.get("request_label", ""))
        if label.startswith("term-prescan"):
            self.prescan_calls += 1
            self.prescan_messages.append(messages)
            if self.prescan_calls in self.fail_prescan_calls:
                raise TimeoutError("mock upstream timeout")
            text = json.loads(messages[1]["content"])
            joined = " ".join(segment["text"] for segment in text["segments"])
            terms = []
            if "harmonic oscillator" in joined:
                terms.append({"source": "harmonic oscillator", "target": "谐振子", "kind": "domain_term"})
            if "Max Planck" in joined:
                terms.append({"source": "Max Planck", "target": "马克斯·普朗克", "kind": "proper_noun"})
            # 模型偶尔会把变量、泛学术词交回来，确定性过滤必须拦住。
            terms.append({"source": "k", "target": "k", "kind": "domain_term"})
            terms.append({"source": "model", "target": "模型", "kind": "domain_term"})
            return json.dumps({"terms": terms}, ensure_ascii=False)
        if label == "style-guide":
            self.style_calls += 1
            if self.style_fails:
                raise TimeoutError("mock upstream timeout")
            return json.dumps(
                {
                    "register": "规范、简洁的学术书面语",
                    "audience": "物理化学专业本科生",
                    "rules": [
                        {"category": "names", "rule": "Hamiltonian 统一译作哈密顿量。", "example": ""},
                    ],
                    "do_not_translate": ["MATLAB"],
                    "notes": "",
                },
                ensure_ascii=False,
            )
        raise AssertionError(f"unexpected request: {label}")


def _segments(texts: list[str]) -> list[PrescanSegment]:
    return [PrescanSegment(segment_id=f"s{index}", page_index=index // 4, order=index, text=text) for index, text in enumerate(texts)]


# ---------------------------------------------------------------- 切批


def test_batches_cut_at_twelve_segments() -> None:
    batches = build_prescan_batches(_segments(["short text here"] * 30))
    assert [len(batch.segments) for batch in batches] == [12, 12, 6]


def test_batches_cut_at_six_hundred_tokens() -> None:
    paragraph = "x" * 800  # 200 token
    batches = build_prescan_batches(_segments([paragraph] * 7))
    assert [len(batch.segments) for batch in batches] == [3, 3, 1]
    assert all(batch.token_estimate <= 600 for batch in batches)


def test_oversized_segment_gets_its_own_batch_without_truncation() -> None:
    huge = "word " * 1000
    batches = build_prescan_batches(_segments(["small", huge, "small"]))
    assert [len(batch.segments) for batch in batches] == [1, 1, 1]
    assert batches[1].segments[0].text == huge


def test_token_estimate_counts_cjk_per_char() -> None:
    assert estimate_tokens("谐振子") == 3
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("") == 0


def test_math_is_masked_before_prescan() -> None:
    masked = mask_math("energy $E_n = h\\nu$ and $$\\int f(x) dx$$ end")
    assert "E_n" not in masked and "\\int" not in masked
    assert masked.count("[math]") == 2


# ---------------------------------------------------------------- 过滤


def test_filter_rejects_math_symbols_variables_and_generic_words() -> None:
    raw = [
        {"source": source, "target": target, "kind": "domain_term"}
        for source, target in [
            ("x", "x"),
            ("x_i", "x_i"),
            ("\\alpha", "阿尔法"),
            ("alpha", "阿尔法"),
            ("f(x)", "f(x)"),
            ("Figure 3.2", "图 3.2"),
            ("method", "方法"),
            ("the results", "结果"),
            ("E = mc^2", "能量"),
            ("harmonic oscillator", "谐振子"),
            ("Schrödinger equation", "薛定谔方程"),
            ("MATLAB", "MATLAB"),
            ("not in text", "不存在"),
            ("harmonic", "谐波，振动。"),
        ]
    ]
    text = (
        "x x_i \\alpha alpha f(x) Figure 3.2 method the results E = mc^2 harmonic oscillator "
        "Schrödinger equation MATLAB harmonic"
    )
    kept = filter_prescan_terms(raw, batch_text=text, target_lang="zh-CN")
    assert [term.source for term in kept] == ["harmonic oscillator", "Schrödinger equation", "MATLAB"]


# ---------------------------------------------------------------- 多数票 / 冲突 / 用户优先


def _result(order: int, *pairs: tuple[str, str]) -> PrescanBatchResult:
    return PrescanBatchResult(
        batch_id=f"b{order:05d}",
        terms=tuple(PrescanTerm(source=source, target=target, kind="domain_term") for source, target in pairs),
    )


def test_majority_vote_wins_and_conflicts_are_recorded() -> None:
    segments = _segments(["harmonic oscillator here", "a harmonic oscillator", "Harmonic oscillator again"])
    results = [
        _result(0, ("harmonic oscillator", "简谐振子")),
        _result(1, ("harmonic oscillator", "谐振子")),
        _result(2, ("Harmonic oscillator", "谐振子")),
    ]
    terms = build_term_base_terms(batch_results=results, segments=segments, user_entries=[])
    assert len(terms) == 1
    term = terms[0]
    assert term["target"] == "谐振子"
    assert term["votes"] == 2
    assert term["conflict_candidates"] == [{"target": "简谐振子", "votes": 1}]
    assert term["frequency"] == 3
    assert term["first_occurrence"] == {"page_index": 0, "page_number": 1, "item_id": "s0"}
    assert term["origin"] == "extracted"


def test_tie_breaks_on_earliest_occurrence() -> None:
    segments = _segments(["wave function", "wave function"])
    results = [_result(0, ("wave function", "波函数")), _result(1, ("wave function", "波动函数"))]
    terms = build_term_base_terms(batch_results=results, segments=segments, user_entries=[])
    assert terms[0]["target"] == "波函数"
    assert terms[0]["conflict_candidates"] == [{"target": "波动函数", "votes": 1}]


def test_user_glossary_wins_over_extracted_votes() -> None:
    segments = _segments(["harmonic oscillator", "harmonic oscillator", "SCF loop"])
    user = normalize_glossary_entries(
        [
            {"source": "harmonic oscillator", "target": "谐振子", "level": "canonical"},
            {"source": "SCF", "target": "自洽场", "level": "preferred"},
            {"source": "unused term", "target": "没出现", "level": "preferred"},
        ]
    )
    results = [
        _result(0, ("harmonic oscillator", "简谐振子")),
        _result(1, ("harmonic oscillator", "简谐振子")),
    ]
    terms = {term["source"]: term for term in build_term_base_terms(batch_results=results, segments=segments, user_entries=user)}
    assert set(terms) == {"harmonic oscillator", "SCF"}
    assert terms["harmonic oscillator"]["target"] == "谐振子"
    assert terms["harmonic oscillator"]["origin"] == "user_glossary"
    assert terms["harmonic oscillator"]["level"] == "canonical"
    assert terms["harmonic oscillator"]["conflict_candidates"] == [{"target": "简谐振子", "votes": 2}]
    assert terms["SCF"]["origin"] == "user_glossary"
    # 用户条目本来就按原级别注入，术语库不再重复注入它们。
    assert term_base_glossary_entries({"terms": list(terms.values())}) == []


def test_locked_user_terms_are_sent_to_the_prescan_prompt(tmp_path: Path) -> None:
    llm = MockLLM()
    batches = build_prescan_batches(_segments(["The harmonic oscillator is simple."]))
    run_term_prescan(
        batches,
        store=PrescanCheckpoint(tmp_path / "ckpt.json", fingerprint="f"),
        api_key="",
        model=MODEL,
        base_url=BASE_URL,
        workers=1,
        target_lang="zh-CN",
        target_language_name="简体中文",
        domain="量子化学",
        user_entries=normalize_glossary_entries([{"source": "harmonic oscillator", "target": "谐振子"}]),
        request_fn=llm,
    )
    payload = json.loads(llm.prescan_messages[0][1]["content"])
    assert payload["locked_terms"] == [{"source": "harmonic oscillator", "target": "谐振子"}]


# ---------------------------------------------------------------- 断点续跑


def test_prescan_resume_only_reruns_unfinished_batches(tmp_path: Path) -> None:
    segments = _segments([f"The harmonic oscillator number {index} vibrates." for index in range(36)])
    batches = build_prescan_batches(segments)
    assert len(batches) == 3
    path = tmp_path / "term-prescan.checkpoint.v1.json"
    common = dict(
        api_key="",
        model=MODEL,
        base_url=BASE_URL,
        workers=1,
        target_lang="zh-CN",
        target_language_name="简体中文",
        domain="",
        user_entries=[],
    )

    first = MockLLM(fail_prescan_calls={2})
    results = run_term_prescan(batches, store=PrescanCheckpoint(path, fingerprint="f"), request_fn=first, **common)
    assert [result.ok for result in results] == [True, False, True]
    assert PrescanCheckpoint(path, fingerprint="f").completed_batch_ids == ["b00000", "b00002"]

    second = MockLLM()
    resumed = run_term_prescan(batches, store=PrescanCheckpoint(path, fingerprint="f"), request_fn=second, **common)
    assert second.prescan_calls == 1
    assert [result.reused for result in resumed] == [True, False, True]
    assert all(result.ok for result in resumed)

    # 文件头指纹换了（换模型、换文档）就整份作废。
    third = MockLLM()
    run_term_prescan(batches, store=PrescanCheckpoint(path, fingerprint="other"), request_fn=third, **common)
    assert third.prescan_calls == 3


def _prepare(tmp_path: Path, mode: str, llm: MockLLM, *, glossary=None):
    source_json = _write_document(tmp_path)
    from retainpdf_pipeline.translate.core.ocr.json_extractor import load_ocr_json

    output_dir = tmp_path / "translated"
    output_dir.mkdir(exist_ok=True)
    return prepare_translation(
        mode=mode,
        data=load_ocr_json(source_json),
        page_indices=range(0, 2),
        output_dir=output_dir,
        source_json_path=source_json,
        api_key="",
        model=MODEL,
        base_url=BASE_URL,
        workers=2,
        domain_context={"domain": "量子化学", "summary": "量子化学教材"},
        rule_profile_name="general_sci",
        rule_guidance="Rule profile (general_sci):\n...",
        custom_rules_text="",
        user_glossary_entries=glossary or [],
        batch_store_factory=lambda fingerprint: PrescanCheckpoint(prescan_checkpoint_path(output_dir), fingerprint=fingerprint),
        request_fn=llm,
    )


def test_prepare_writes_frozen_artifacts_and_reuses_them(tmp_path: Path) -> None:
    llm = MockLLM()
    preparation = _prepare(tmp_path, "terms+style", llm)
    term_base = json.loads((tmp_path / "translated" / "term-base.v1.json").read_text(encoding="utf-8"))
    style = json.loads((tmp_path / "translated" / "style-guide.v1.json").read_text(encoding="utf-8"))

    assert term_base["schema"] == "term_base_v1" and term_base["complete"] is True
    sources = {term["source"]: term for term in term_base["terms"]}
    assert set(sources) == {"harmonic oscillator", "Max Planck"}
    assert sources["harmonic oscillator"]["frequency"] == 10
    assert sources["Max Planck"]["target"] == "马克斯·普朗克"
    assert style["schema"] == "style_guide_v1" and style["llm_status"] == "ok"
    assert {rule["origin"] for rule in style["rules"]} == {"baseline", "document"}
    assert "MATLAB" in style["do_not_translate"]
    assert preparation.style_guidance == render_style_guidance(style)
    assert "Hamiltonian 统一译作哈密顿量" in preparation.style_guidance
    # 首现括注只能由 QA 检查，不进逐块 prompt（逐块翻译判断不了是不是首现）。
    assert "首次出现" not in preparation.style_guidance
    assert {entry.source for entry in preparation.term_base_entries} == {"harmonic oscillator", "Max Planck"}

    calls = (llm.prescan_calls, llm.style_calls)
    again = MockLLM()
    reused = _prepare(tmp_path, "terms+style", again)
    assert (again.prescan_calls, again.style_calls) == (0, 0)
    assert reused.identity() == preparation.identity()
    assert calls[1] == 1


def test_prepare_resumes_after_interruption_and_marks_incomplete(tmp_path: Path) -> None:
    first = MockLLM(fail_prescan_calls={1})
    partial = _prepare(tmp_path, "terms", first)
    term_base = json.loads((tmp_path / "translated" / "term-base.v1.json").read_text(encoding="utf-8"))
    assert term_base["complete"] is False
    assert len(term_base["extraction"]["failed_batch_ids"]) == 1
    assert not (tmp_path / "translated" / "style-guide.v1.json").exists()

    second = MockLLM()
    complete = _prepare(tmp_path, "terms", second)
    assert second.prescan_calls == 1
    term_base = json.loads((tmp_path / "translated" / "term-base.v1.json").read_text(encoding="utf-8"))
    assert term_base["complete"] is True
    assert term_base["extraction"]["reused_batch_count"] == term_base["extraction"]["batch_count"] - 1
    assert complete.identity() != partial.identity()


def test_style_guide_failure_falls_back_to_baseline(tmp_path: Path) -> None:
    preparation = _prepare(tmp_path, "terms+style", MockLLM(style_fails=True))
    style = json.loads((tmp_path / "translated" / "style-guide.v1.json").read_text(encoding="utf-8"))
    assert style["llm_status"] == "failed" and style["complete"] is False
    assert {rule["origin"] for rule in style["rules"]} == {"baseline"}
    assert "Figure 3.2 → 图 3.2" in preparation.style_guidance


def test_artifacts_only_generates_but_injects_nothing(tmp_path: Path) -> None:
    preparation = _prepare(tmp_path, "artifacts_only", MockLLM())
    assert (tmp_path / "translated" / "term-base.v1.json").exists()
    assert (tmp_path / "translated" / "style-guide.v1.json").exists()
    assert preparation.term_base_entries == []
    assert preparation.style_guidance == ""
    assert preparation.term_base_sha256 and preparation.style_guide_sha256


def test_terms_mode_does_not_build_a_style_guide(tmp_path: Path) -> None:
    llm = MockLLM()
    preparation = _prepare(tmp_path, "terms", llm)
    assert llm.style_calls == 0
    assert preparation.style_guidance == ""
    assert preparation.term_base_entries


# ---------------------------------------------------------------- 注入与缓存 key


def _policy():
    return build_translation_policy_config(
        mode="sci",
        math_mode="direct_typst",
        skip_title_translation=False,
        domain_context={"domain": "量子化学", "summary": "教材", "translation_guidance": "术语稳定。"},
        rule_profile_name="general_sci",
    )


ITEM = {"item_id": "p001-b0001", "source_text": "The harmonic oscillator vibrates.", "math_mode": "direct_typst"}
OTHER_ITEM = {"item_id": "p001-b0002", "source_text": "Nothing relevant here.", "math_mode": "direct_typst"}


def _key(context, item) -> str:
    scoped = context.scoped_to_item(item)
    return cache.cache_key_for_item(item, model=MODEL, base_url=BASE_URL, domain_guidance=scoped.cache_guidance, mode="sci")


def _system_prompt(context, item) -> str:
    scoped = context.scoped_to_item(item)
    return build_single_item_fallback_messages(item, domain_guidance=scoped.prompt_system_guidance, mode="sci")[0]["content"]


def test_default_context_guidance_is_byte_identical_to_the_pre_preparation_formula() -> None:
    """默认路径（不传新参数）的三段 guidance 与改动前的拼接公式逐字节相同。

    另外在 scratch 里用 a72b5449 的旧代码对样本任务做过一次逐项比对
    （prompt 消息、缓存 key、checkpoint 指纹），全部相同。
    """
    policy = _policy()
    glossary = normalize_glossary_entries([{"source": "harmonic oscillator", "target": "谐振子"}])
    context = build_translation_context_from_policy(policy, glossary_entries=glossary)
    explicit = build_translation_context_from_policy(
        policy, glossary_entries=glossary, style_guidance="", term_base_entries=None
    )

    def legacy_join(*parts: str) -> str:
        return "\n\n".join(part.strip() for part in parts if part and part.strip()).strip()

    scoped = context.scoped_to_item(ITEM)
    assert scoped.cache_guidance == legacy_join(
        scoped.domain_guidance, scoped.rule_guidance, scoped.terms_guidance, scoped.retrieval_guidance, scoped.extra_guidance
    )
    assert scoped.prompt_system_guidance == legacy_join(
        scoped.domain_guidance, scoped.rule_guidance, scoped.retrieval_guidance, scoped.extra_guidance
    )
    assert scoped.merged_guidance == scoped.cache_guidance
    for item in (ITEM, OTHER_ITEM):
        assert _key(context, item) == _key(explicit, item)
        assert _system_prompt(context, item) == _system_prompt(explicit, item)


def test_style_guidance_goes_into_system_prompt_and_changes_every_cache_key() -> None:
    policy = _policy()
    baseline = build_translation_context_from_policy(policy)
    style = "Style guide (frozen for this book; follow it in every block):\n- 年代统一写成「20 世纪 60 年代」。"
    styled = build_translation_context_from_policy(policy, style_guidance=style)
    for item in (ITEM, OTHER_ITEM):
        assert style in _system_prompt(styled, item)
        assert style not in _system_prompt(baseline, item)
        assert _key(styled, item) != _key(baseline, item)


def test_term_base_entries_are_injected_on_hit_and_keyed_precisely() -> None:
    policy = _policy()
    entries = term_base_glossary_entries(
        {"terms": [{"source": "harmonic oscillator", "target": "谐振子", "origin": "extracted"}]}
    )
    baseline = build_translation_context_from_policy(policy)
    with_terms = build_translation_context_from_policy(policy, term_base_entries=entries)

    hit = with_terms.scoped_to_item({**ITEM, "source_text": "The Harmonic oscillator vibrates."})
    assert '"target": "谐振子"' in hit.terms_guidance
    assert _key(with_terms, ITEM) != _key(baseline, ITEM)
    # 没命中的块 prompt 完全没变，缓存 key 也不该变。
    assert _key(with_terms, OTHER_ITEM) == _key(baseline, OTHER_ITEM)
    # 抽取术语不进用户 glossary_entries：不触发硬替换、审校 glossary_term_missing 和术语修复。
    assert hit.glossary_entries == []


def test_user_entries_keep_priority_when_both_match() -> None:
    policy = _policy()
    user = normalize_glossary_entries([{"source": "SCF", "target": "自洽场", "level": "canonical"}])
    entries = term_base_glossary_entries(
        {"terms": [{"source": "harmonic oscillator", "target": "谐振子", "origin": "extracted"}]}
    )
    context = build_translation_context_from_policy(policy, glossary_entries=user, term_base_entries=entries)
    scoped = context.scoped_to_item({**ITEM, "source_text": "SCF of the harmonic oscillator."})
    assert [entry.source for entry in scoped.glossary_entries] == ["SCF"]
    assert [entry.source for entry in scoped.term_base_entries] == ["harmonic oscillator"]


# ---------------------------------------------------------------- 执行计划 / 输入指纹 / 默认 off


def test_unknown_preparation_values_normalize_to_off() -> None:
    assert normalize_preparation_mode("") == "off"
    assert normalize_preparation_mode("TERMS+STYLE") == "terms+style"
    assert normalize_preparation_mode("terms_style") == "off"


def _request(tmp_path: Path, **overrides) -> TranslationExecutionRequest:
    return TranslationExecutionRequest(
        source_json_path=_write_document(tmp_path),
        output_dir=tmp_path / "attempt" / "translated",
        api_key="sk-test",
        model=MODEL,
        base_url=BASE_URL,
        mode="fast",
        **overrides,
    )


def _build_plan(request):
    (request.output_dir).mkdir(parents=True, exist_ok=True)
    plan = build_translation_execution_plan(request)
    plan.run_diagnostics.request_journal.close()
    return plan


def test_default_off_plan_has_no_preparation_and_unchanged_identity(tmp_path: Path) -> None:
    request = _request(tmp_path)
    assert request.preparation == "off"
    plan = _build_plan(request)
    assert plan.preparation is None
    assert not (request.output_dir / "term-base.v1.json").exists()
    assert not (request.output_dir / "style-guide.v1.json").exists()
    assert not (request.output_dir / "term-prescan.checkpoint.v1.json").exists()
    assert plan.translation_context.style_guidance == ""
    assert plan.translation_context.term_base_entries == []
    # 改动前的 plan 没有 preparation 属性；identity 必须与之相同。
    legacy_plan = SimpleNamespace(**{k: v for k, v in vars(plan).items() if k != "preparation"})
    assert build_translation_identity(request, plan) == build_translation_identity(request, legacy_plan)


def test_enabled_preparation_enters_the_input_fingerprint(tmp_path: Path, monkeypatch) -> None:
    llm = MockLLM()
    from retainpdf_pipeline.translate.services.preparation import runner

    monkeypatch.setattr(runner, "run_term_prescan", _with_request_fn(runner.run_term_prescan, llm))
    monkeypatch.setattr(runner, "request_document_style", _with_request_fn(runner.request_document_style, llm))
    off_request = _request(tmp_path)
    off_identity = build_translation_identity(off_request, _build_plan(off_request))

    on_request = _request(tmp_path, preparation="terms+style")
    plan = _build_plan(on_request)
    assert plan.preparation is not None and plan.preparation.mode == "terms+style"
    assert plan.translation_context.style_guidance.startswith("Style guide")
    assert {entry.source for entry in plan.translation_context.term_base_entries} == {"harmonic oscillator", "Max Planck"}
    on_identity = build_translation_identity(on_request, plan)
    assert on_identity["fingerprint"] != off_identity["fingerprint"]

    # 冻结产物换了，指纹跟着变（不能拿旧译文续跑）。
    term_base_path = on_request.output_dir / "term-base.v1.json"
    payload = json.loads(term_base_path.read_text(encoding="utf-8"))
    payload["terms"][0]["target"] = "改过的译法"
    term_base_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    replan = _build_plan(on_request)
    assert build_translation_identity(on_request, replan)["fingerprint"] != on_identity["fingerprint"]
    # 风格指南的输入里有术语库的关键术语，术语库变了它也要重新生成。
    assert llm.style_calls == 2


def _with_request_fn(function, llm):
    def wrapped(*args, **kwargs):
        kwargs["request_fn"] = llm
        return function(*args, **kwargs)

    return wrapped


# ---------------------------------------------------------------- reviewer 配置位


def test_reviewer_falls_back_to_translation_connection(tmp_path: Path) -> None:
    request = _request(tmp_path)
    reviewer = resolve_reviewer_connection(request)
    assert (reviewer.model, reviewer.base_url, reviewer.api_key, reviewer.inherited) == (MODEL, BASE_URL, "sk-test", True)


def test_reviewer_model_only_reuses_translation_endpoint_and_key(tmp_path: Path) -> None:
    reviewer = resolve_reviewer_connection(_request(tmp_path, reviewer_model="reviewer-large"))
    assert (reviewer.model, reviewer.base_url, reviewer.api_key, reviewer.inherited) == (
        "reviewer-large",
        BASE_URL,
        "sk-test",
        False,
    )


def test_reviewer_on_another_endpoint_never_receives_the_translation_key(tmp_path: Path) -> None:
    reviewer = resolve_reviewer_connection(_request(tmp_path, reviewer_base_url="https://other.invalid/v1"))
    assert reviewer.base_url == "https://other.invalid/v1"
    assert reviewer.api_key == ""
    explicit = resolve_reviewer_connection(
        _request(tmp_path, reviewer_base_url="https://other.invalid/v1", reviewer_api_key="sk-review")
    )
    assert explicit.api_key == "sk-review"


def _write_translate_spec(tmp_path: Path, extra_params: dict) -> Path:
    source_json = _write_document(tmp_path)
    source_pdf = tmp_path / "source.pdf"
    source_pdf.write_bytes(b"%PDF-1.4\n")
    spec = tmp_path / "translate.spec.json"
    spec.write_text(
        json.dumps(
            {
                "schema_version": "translate.stage.v1",
                "stage": "translate",
                "job": {"job_id": "job-1", "job_root": str(tmp_path), "workflow": "translate"},
                "inputs": {"source_json": str(source_json), "source_pdf": str(source_pdf), "layout_json": None},
                "params": {"model": MODEL, "base_url": BASE_URL, "credential_ref": "", **extra_params},
            }
        ),
        encoding="utf-8",
    )
    return spec


def test_stage_spec_defaults_when_new_keys_are_absent(tmp_path: Path) -> None:
    from retainpdf_pipeline.foundation.shared.stage_specs import TranslateStageSpec

    params = TranslateStageSpec.load(_write_translate_spec(tmp_path, {})).params
    assert (params.preparation, params.reviewer_model, params.reviewer_base_url, params.reviewer_credential_ref) == (
        "off",
        "",
        "",
        "",
    )


def test_stage_spec_passes_reviewer_through_credential_reference(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_pipeline.foundation.shared.stage_specs import TranslateStageSpec
    from retainpdf_pipeline.foundation.shared.stage_specs import resolve_credential_ref
    from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import _args_from_spec

    monkeypatch.setenv("RETAIN_REVIEWER_API_KEY", "sk-review-from-env")
    spec = TranslateStageSpec.load(
        _write_translate_spec(
            tmp_path,
            {
                "preparation": "Terms+Style",
                "reviewer_model": "reviewer-large",
                "reviewer_base_url": "https://review.invalid/v1",
                "reviewer_credential_ref": "env:RETAIN_REVIEWER_API_KEY",
            },
        )
    )
    assert spec.params.preparation == "terms+style"
    assert spec.params.reviewer_credential_ref == "env:RETAIN_REVIEWER_API_KEY"
    assert resolve_credential_ref(spec.params.reviewer_credential_ref) == "sk-review-from-env"
    args = _args_from_spec(spec)
    assert (args.preparation, args.reviewer_model, args.reviewer_base_url, args.reviewer_api_key) == (
        "terms+style",
        "reviewer-large",
        "https://review.invalid/v1",
        "sk-review-from-env",
    )


@pytest.fixture(autouse=True)
def _isolated_unit_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(cache.paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path / "unit-cache")
