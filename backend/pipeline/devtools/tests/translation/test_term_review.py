"""术语专员审定：分类决定术语怎么被注入、怎么被质检。全部离线。"""
from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.translate.services.preparation.segments import PrescanSegment
from retainpdf_pipeline.translate.services.preparation.term_base import term_base_glossary_entries
from retainpdf_pipeline.translate.services.preparation.term_review import parse_term_review_response
from retainpdf_pipeline.translate.services.preparation.term_review import review_term_base
from retainpdf_pipeline.translate.services.quality.qa.terms import build_term_specs
from retainpdf_pipeline.translate.services.quality.qa.terms import load_term_base


def _term(source: str, target: str, kind: str = "domain_term", item_id: str = "s1") -> dict:
    return {
        "source": source,
        "target": target,
        "frequency": 3,
        "first_occurrence": {"page_index": 0, "page_number": 1, "item_id": item_id},
        "conflict_candidates": [],
        "origin": "extracted",
        "votes": 2,
        "kind": kind,
        "level": "preferred",
    }


def _payload() -> dict:
    return {
        "schema": "term_base_v1",
        "terms": [
            _term("virial theorem", "维里定理"),
            _term("Lowe", "洛", kind="proper_noun", item_id="s2"),
            _term("J. Chem. Phys.", "《化学物理杂志》", kind="proper_noun", item_id="s2"),
            _term("wave function", "波函数"),
            _term("result", "结果"),
            _term("Fock matrix", "福克矩阵"),
        ],
    }


SEGMENTS = [
    PrescanSegment("s1", 0, 0, "The virial theorem relates kinetic and potential energy of the wave function."),
    PrescanSegment("s2", 9, 0, "J. P. Lowe and K. Peterson, J. Chem. Phys. 45, 1234 (1966)."),
]


def _reviewer(calls: list):
    def request(messages, **kwargs):
        calls.append(json.loads(messages[1]["content"]))
        return json.dumps({"terms": [
            {"source": "virial theorem", "category": "technical", "target": "位力定理", "annotate": True},
            {"source": "Lowe", "category": "person", "target": "Lowe", "annotate": False},
            {"source": "J. Chem. Phys.", "category": "publication", "target": "J. Chem. Phys.", "annotate": False},
            {"source": "wave function", "category": "technical", "target": "波函数", "annotate": False},
            {"source": "result", "category": "common", "target": "结果", "annotate": False},
            # Fock matrix 漏回：保持预扫时的行为。
        ]}, ensure_ascii=False)
    return request


def _review(payload: dict, request) -> dict:
    return review_term_base(
        payload,
        segments=SEGMENTS,
        api_key="",
        model="m",
        base_url="https://x.invalid/v1",
        workers=1,
        domain="量子化学",
        target_lang="zh-CN",
        target_language_name="简体中文",
        request_fn=request,
    )


def test_review_sends_context_and_classifies_every_term() -> None:
    calls: list = []
    payload = _review(_payload(), _reviewer(calls))
    sent = {row["source"]: row for row in calls[0]["terms"]}
    assert "J. P. Lowe and K. Peterson" in sent["Lowe"]["context"], "首次出现处的原文作为上下文"
    terms = {term["source"]: term for term in payload["terms"]}

    assert terms["virial theorem"]["target"] == "位力定理", "专业术语的译名可以被改正"
    assert terms["virial theorem"]["prescan_target"] == "维里定理"
    assert (terms["virial theorem"]["treatment"], terms["virial theorem"]["annotate"]) == ("lock", True)
    assert terms["wave function"]["annotate"] is False, "基础概念不要求括注"
    assert terms["Lowe"]["treatment"] == "free"
    assert (terms["J. Chem. Phys."]["treatment"], terms["J. Chem. Phys."]["target"]) == ("keep_original", "J. Chem. Phys.")
    assert terms["result"]["treatment"] == "drop"
    assert terms["Fock matrix"]["review_status"] == "unreviewed"
    assert "treatment" not in terms["Fock matrix"], "漏回的条目保持预扫时的行为"
    review = payload["review"]
    assert review["status"] == "completed"
    assert review["unreviewed_count"] == 1
    assert review["by_category"] == {"common": 1, "person": 1, "publication": 1, "technical": 2}


def test_injected_entries_follow_the_treatment() -> None:
    entries = {entry.source: entry for entry in term_base_glossary_entries(_review(_payload(), _reviewer([])))}
    assert set(entries) == {"virial theorem", "J. Chem. Phys.", "wave function", "Fock matrix"}
    assert (entries["J. Chem. Phys."].level, entries["J. Chem. Phys."].target) == ("preserve", "J. Chem. Phys.")
    assert entries["virial theorem"].target == "位力定理"


def test_qa_skips_free_and_dropped_terms_and_only_glosses_flagged_ones(tmp_path: Path) -> None:
    path = tmp_path / "term-base.v1.json"
    path.write_text(json.dumps(_review(_payload(), _reviewer([])), ensure_ascii=False), encoding="utf-8")
    _meta, entries = load_term_base(path)
    specs = {spec.source: spec for spec in build_term_specs([], entries)}
    assert "Lowe" not in specs and "result" not in specs
    assert specs["J. Chem. Phys."].expected == "J. Chem. Phys."
    assert specs["J. Chem. Phys."].expects_annotation is False
    assert specs["virial theorem"].expects_annotation is True
    assert specs["wave function"].expects_annotation is False
    assert specs["Fock matrix"].expects_annotation is True, "没审过的条目照旧要求括注"


def test_unknown_categories_are_ignored_and_annotate_needs_technical() -> None:
    decisions = parse_term_review_response(json.dumps({"terms": [
        {"source": "X", "category": "galaxy", "target": "x", "annotate": True},
        {"source": "Y", "category": "person", "target": "Y", "annotate": True},
    ]}))
    assert "x" not in decisions
    assert decisions["y"]["annotate"] is False


def test_harmonize_unifies_variants_and_makes_compounds_follow_the_short_term() -> None:
    from retainpdf_pipeline.translate.services.preparation.term_review import harmonize_term_base

    def term(source, target, votes=1, conflicts=()):
        row = _term(source, target)
        row.update(votes=votes, treatment="lock", conflict_candidates=[{"target": t, "votes": v} for t, v in conflicts])
        return row

    payload = {"terms": [
        term("virial theorem", "位力定理", votes=4, conflicts=[("维里定理", 3)]),
        term("quantum-mechanical virial theorem", "量子力学维里定理"),
        term("hypervirial theorem", "超维里定理"),
        term("Cartesian coordinates", "笛卡儿坐标", votes=3, conflicts=[("笛卡尔坐标", 1)]),
        term("Cartesian coordinate", "笛卡尔坐标", votes=1),
        {**term("Max Planck", "普朗克"), "treatment": "free"},
    ]}
    changes = harmonize_term_base(payload)
    targets = {row["source"]: row["target"] for row in payload["terms"]}

    assert targets["quantum-mechanical virial theorem"] == "量子力学位力定理"
    assert targets["hypervirial theorem"] == "超维里定理", "hypervirial 不是 virial theorem 的扩展，不动"
    assert targets["Cartesian coordinate"] == targets["Cartesian coordinates"] == "笛卡儿坐标"
    assert {(row["source"], row["reason"]) for row in changes} == {
        ("quantum-mechanical virial theorem", "compound:virial theorem"),
        ("Cartesian coordinate", "variant"),
    }
    assert payload["terms"][1]["harmonized_from"] == "量子力学维里定理"
