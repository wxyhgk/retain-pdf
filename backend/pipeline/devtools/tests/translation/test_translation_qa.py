from __future__ import annotations

import json
from pathlib import Path
import re

import pytest

from retainpdf_pipeline.translate.services.quality.qa import TRANSLATION_QA_FILE_NAME
from retainpdf_pipeline.translate.services.quality.qa import build_translation_qa
from retainpdf_pipeline.translate.services.quality.qa import build_translation_qa_for_job
from retainpdf_pipeline.translate.services.quality.qa import translation_qa_enabled
from retainpdf_pipeline.translate.services.quality.qa import write_translation_qa_for_run
from retainpdf_pipeline.translate.services.quality.qa import report as qa_report


SCHEMA_PATH = (
    Path(__file__).resolve().parents[3]
    / "retainpdf_pipeline/translate/services/quality/qa/translation_qa.v1.schema.json"
)


def _item(
    item_id: str,
    source: str,
    translated: str,
    *,
    page_idx: int = 0,
    block_idx: int | None = None,
    block_class: str = "body",
    final_status: str = "translated",
    math_mode: str = "direct_typst",
    **extra,
) -> dict:
    payload = {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": block_idx if block_idx is not None else int(item_id.rsplit("b", 1)[-1]),
        "block_type": "formula" if block_class == "formula" else "text",
        "block_class": block_class,
        "source_text": source,
        "protected_source_text": source,
        "translated_text": translated,
        "protected_translated_text": translated,
        "final_status": final_status,
        "math_mode": math_mode,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
    }
    payload.update(extra)
    return payload


def _run(items: list[dict], **kwargs) -> dict:
    pages: dict[int, list[dict]] = {}
    for item in items:
        pages.setdefault(int(item["page_idx"]), []).append(item)
    return build_translation_qa(pages, **kwargs)


def _types(report: dict, check: str | None = None) -> list[str]:
    return [v["type"] for v in report["violations"] if check is None or v["check"] == check]


def _find(report: dict, violation_type: str) -> dict:
    return next(v for v in report["violations"] if v["type"] == violation_type)


# ---- 数字、单位、科学计数法 -------------------------------------------------------


def test_billion_must_become_shi_yi() -> None:
    ok = _run([_item("p001-b001", "The market reached 3 billion dollars.", "市场规模达到 30 亿美元。")])
    assert _types(ok, "numbers") == []

    wrong = _run([_item("p001-b001", "The market reached 3 billion dollars.", "市场规模达到 3 亿美元。")])
    violation = _find(wrong, "number_scale_mismatch")
    assert violation["severity"] == "critical"
    assert violation["evidence"]["expected_value"] == "3000000000"


def test_thousands_separator_is_equivalent() -> None:
    report = _run(
        [_item("p001-b001", "We sampled 1,000 molecules and 12,500 frames.", "我们采样了 1000 个分子和 12500 帧。")]
    )
    assert _types(report, "numbers") == []


def test_missing_and_extra_numbers() -> None:
    missing = _run([_item("p001-b001", "The bond length is 74.1 pm at 298 K.", "键长为 74.1 pm。")])
    violation = _find(missing, "number_missing")
    assert violation["severity"] == "critical"
    assert violation["evidence"]["missing"] == ["298"]

    extra = _run([_item("p001-b001", "The bond length is 74.1 pm.", "在 300 K 下键长为 74.1 pm。")])
    assert _find(extra, "number_extra")["severity"] == "major"


def test_small_numbers_written_in_chinese_are_not_missing() -> None:
    report = _run([_item("p001-b001", "There are 2 masses and 3 springs.", "共有两个质量和三根弹簧。")])
    assert _types(report, "numbers") == []


def test_percent_must_keep_percent_sign() -> None:
    ok = _run([_item("p001-b001", "Yield increased by 5%.", "产率提高了 5％。")])
    assert _types(ok, "numbers") == []
    dropped = _run([_item("p001-b001", "Yield increased by 5%.", "产率提高了 5。")])
    assert _find(dropped, "percent_dropped")["severity"] == "major"


def test_scientific_notation_sign_flip_is_critical() -> None:
    source = "The value is $ D_e = 7.61 \\times 10^{-19} $ J."
    ok = _run([_item("p001-b001", source, "其值为 $D_e = 7.61 \\times 10^{-19}$ J。")])
    assert _types(ok, "numbers") == []
    flipped = _run([_item("p001-b001", source, "其值为 $D_e = 7.61 \\times 10^{19}$ J。")])
    assert _find(flipped, "sci_notation_mismatch")["severity"] == "critical"


def test_ranges_keep_both_ends() -> None:
    report = _run([_item("p001-b001", "Temperatures of 5–10 K were used.", "使用了 5～10 K 的温度。")])
    assert _types(report, "numbers") == []


def test_decades_prefer_century_form() -> None:
    ok = _run([_item("p001-b001", "This method was popular in the 1960s.", "该方法在 20 世纪 60 年代很流行。")])
    assert _types(ok, "numbers") == []
    style = _run([_item("p001-b001", "This method was popular in the 1960s.", "该方法在 1960 年代很流行。")])
    assert _find(style, "decade_style")["severity"] == "minor"


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("over 100M website views per year", "每年超过 1 亿次网站浏览量"),
        ("ca. 78 000 aryl bromides", "约 $78\\,000$ 种芳基溴化物"),
        ("23.9% vs 17.0%, p < 0.01", "23.9% vs 17.0%，$p < 0.01$"),
        ("TUBITAK Project No.112T503", "TUBITAK 项目编号 112T503"),
        ("toward dissociation⁵⁵ at long range", "在长程趋于解离$^{55}$"),
        ("observed across studies [113,114].", "多项研究观察到 $^{[113,114]}$。"),
        ("All tests were 2-sided.", "所有检验均为双侧检验。"),
        ("Received May 26, 1930", "1930年5月26日收稿"),
        ("rho = 0 . 2 5 here", "此处 $\\rho = 0.25$"),
    ],
)
def test_number_false_positives_seen_in_real_jobs(source: str, translated: str) -> None:
    report = _run([_item("p001-b001", source, translated)])
    assert _types(report, "numbers") == []


def test_ocr_noisy_source_downgrades_number_findings() -> None:
    report = _run(
        [_item("p001-b001", "decarboxylation at 4 0 8 \\mathrm { C } was complete", "脱羧在 40 °C 下完成")]
    )
    violation = _find(report, "number_missing")
    assert violation["severity"] == "major"
    assert violation["evidence"]["source_ocr_suspect"] is True


# ---- 交叉引用、文献引用、占位符 ---------------------------------------------------


def test_reference_enumeration_stops_at_compound_numbers() -> None:
    report = _run(
        [
            _item(
                "p001-b001",
                "High yields were obtained (Table 5A, 49, 50, 53−61).",
                "获得了较高产率（表 5A，$\\mathbf{49}$、$\\mathbf{50}$）。",
            )
        ]
    )
    assert _types(report, "references") == []


def test_superscript_citations_inside_math_are_found() -> None:
    report = _run([_item("p001-b001", "as reported.<sup>[6,7]</sup> Next", "如文献所述 $^{[6,7]}$。接着")])
    assert _types(report, "references") == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("As shown in Figure 3.2, the curve rises.", "如图 3.2 所示，曲线上升。"),
        ("Substituting Eq. (5) gives the result.", "代入式(5)即得结果。"),
        ("See Section 2.3 for details.", "详见 2.3 节。"),
        ("See Section 2.3 for details.", "详见第 2.3 节。"),
        ("Equations 5.22 and 5.23 are coupled.", "式 5.22 和式 5.23 是耦合的。"),
        ("This is discussed in Problems 5–6 and 5–7.", "这在习题 5–6 和 5–7 中讨论。"),
        ("EXAMPLE5-1", "例5-1"),
    ],
)
def test_cross_references_preserved(source: str, translated: str) -> None:
    report = _run([_item("p001-b001", source, translated)])
    assert _types(report, "references") == []
    assert _types(report, "numbers") == []


def test_cross_reference_number_changed_is_major() -> None:
    report = _run([_item("p001-b001", "As shown in Figure 3.2, the curve rises.", "如图 3.3 所示，曲线上升。")])
    violation = _find(report, "ref_number_missing")
    assert violation["severity"] == "major"
    assert violation["evidence"]["ref_number"] == "3.2"


def test_cross_reference_kind_mismatch_and_untranslated_label() -> None:
    mismatch = _run([_item("p001-b001", "As shown in Figure 3.2, the curve rises.", "如表 3.2 所示，曲线上升。")])
    assert _find(mismatch, "ref_kind_mismatch")["severity"] == "major"
    untranslated = _run([_item("p001-b001", "As shown in Figure 3.2, the curve rises.", "如 Figure 3.2 所示，曲线上升。")])
    assert _find(untranslated, "ref_label_untranslated")["severity"] == "minor"


def test_citation_brackets_must_survive() -> None:
    ok = _run([_item("p001-b001", "Prior work [12] used this.", "先前的工作[12]使用了该方法。")])
    assert _types(ok, "references") == []
    missing = _run([_item("p001-b001", "Prior work [12] used this.", "先前的工作使用了该方法。")])
    assert _find(missing, "ref_citation_missing")["severity"] == "major"


def test_reference_label_variants_are_summarised() -> None:
    items = [
        _item(f"p001-b{index:03d}", f"Equation 5.{index} holds.", f"{label} 5.{index} 成立。")
        for index, label in enumerate(["式", "式", "式", "方程", "方程"], start=1)
    ]
    report = _run(items)
    assert report["summary"]["reference_label_variants"]["equation"] == {"式": 3, "方程": 2}
    violation = _find(report, "ref_label_inconsistent")
    assert violation["scope"] == "document"
    assert violation["severity"] == "minor"


def test_placeholders_reuse_review_function_outside_direct_math() -> None:
    item = _item(
        "p001-b001",
        "Let <f1-a1b/> be the energy.",
        "令能量为。",
        math_mode="placeholder",
    )
    report = _run([item])
    assert "placeholder_inventory_mismatch" in _types(report, "placeholders")
    assert report["checks"]["placeholders"]["status"] == "ok"
    direct = _run([_item("p001-b001", "Let $E$ be the energy.", "令 $E$ 为能量。")])
    assert direct["checks"]["placeholders"]["status"] == "skipped"


# ---- 续接组 -----------------------------------------------------------------------


def _group(members: list[tuple[str, str, str]], *, group_id: str = "cg-1") -> list[dict]:
    ids = [member[0] for member in members]
    return [
        _item(
            item_id,
            source,
            translated,
            page_idx=int(item_id[1:4]) - 1,
            translation_unit_id=f"__cg__:{group_id}",
            translation_unit_kind="group",
            translation_unit_member_ids=ids,
            continuation_group=group_id,
        )
        for item_id, source, translated in members
    ]


def test_continuation_group_is_compared_as_a_whole() -> None:
    # 整组译文分配时把大部分内容放到了第一个成员；按成员单独比会误报漏译 / 缺数字，
    # 按整组比是干净的。
    long_tail = (
        "and the remaining energy of 42 units is distributed between the kinetic and potential "
        "terms so that the total is conserved throughout the oscillation, as Figure 5.3 shows."
    )
    items = _group(
        [
            (
                "p004-b025",
                "Both T and V are plotted here. The total energy is",
                "$T$ 和 $V$ 均绘于此处。总能量为，其余 42 个单位的能量在动能项与势能项之间分配，"
                "因此在整个振动过程中总能量守恒，如图 5.3 所示。",
            ),
            ("p005-b005", long_tail, "。"),
        ]
    )
    report = _run(items)
    assert _types(report, "omission") == []
    assert _types(report, "numbers") == []
    assert _types(report, "references") == []
    assert report["summary"]["group_unit_count"] == 1


def test_group_level_omission_is_still_detected() -> None:
    items = _group(
        [
            ("p001-b001", "The first part of a long paragraph describes the classical oscillator in detail.", "第一部分"),
            (
                "p001-b002",
                "The second part then derives the quantum mechanical energies and compares them with experiment.",
                "",
            ),
        ]
    )
    report = _run(items)
    violation = next(v for v in report["violations"] if v["check"] == "omission")
    assert violation["location"]["item_ids"] == ["p001-b001", "p001-b002"]


# ---- 术语、首现括注 --------------------------------------------------------------


def test_term_base_is_optional(tmp_path: Path) -> None:
    report = _run(
        [_item("p001-b001", "A harmonic oscillator.", "谐振子。")],
        term_base_path=tmp_path / "term-base.v1.json",
    )
    assert report["inputs"]["term_base"]["status"] == "missing"
    assert report["summary"]["term_consistency"]["locked"]["occurrences"] == 0


def test_term_base_violation_and_consistency_rate(tmp_path: Path) -> None:
    term_base = tmp_path / "term-base.v1.json"
    term_base.write_text(
        json.dumps({"terms": [{"source": "reduced mass", "target": "约化质量", "frequency": 3}]}, ensure_ascii=False),
        encoding="utf-8",
    )
    items = [
        _item("p001-b001", "The reduced mass is defined here.", "此处定义约化质量（reduced mass）。"),
        _item("p001-b002", "Using the reduced mass we obtain.", "利用约化质量可得。"),
        _item("p001-b003", "The Reduced Mass appears again.", "折合质量再次出现。"),
    ]
    report = _run(items, term_base_path=term_base)
    assert report["inputs"]["term_base"]["status"] == "loaded"
    locked = report["summary"]["term_consistency"]["locked"]
    assert (locked["occurrences"], locked["hits"]) == (3, 2)
    assert locked["consistency_rate"] == pytest.approx(0.6667)
    violation = _find(report, "term_violation")
    assert violation["severity"] == "major"
    assert violation["location"]["item_id"] == "p001-b003"
    row = next(row for row in report["terms"] if row["source"] == "reduced mass")
    assert row["missed_item_ids"] == ["p001-b003"]


def test_user_glossary_takes_priority_over_term_base(tmp_path: Path) -> None:
    term_base = tmp_path / "term-base.v1.json"
    term_base.write_text(json.dumps([{"source": "reduced mass", "target": "折合质量"}]), encoding="utf-8")
    report = _run(
        [_item("p001-b001", "The reduced mass is defined here.", "此处定义约化质量（reduced mass）。")],
        term_base_path=term_base,
        glossary_entries=[{"source": "reduced mass", "target": "约化质量", "level": "canonical"}],
    )
    assert _types(report, "terms") == []
    assert [row["origin"] for row in report["terms"]] == ["glossary"]


def test_first_occurrence_annotation_checks() -> None:
    items = [
        _item("p001-b001", "A convolutional neural network is used.", "使用卷积神经网络。"),
        _item(
            "p001-b002",
            "The convolutional neural network (CNN) is trained.",
            "对卷积神经网络（convolutional neural network，CNN）进行训练。",
        ),
        _item(
            "p001-b003",
            "Again the convolutional neural network is used.",
            "再次使用卷积神经网络（convolutional neural network）。",
        ),
    ]
    report = _run(items)
    late = _find(report, "annotation_not_at_first_occurrence")
    assert late["location"]["item_id"] == "p001-b001"
    duplicate = _find(report, "annotation_duplicate")
    assert duplicate["location"]["item_id"] == "p001-b003"
    summary = report["summary"]["first_occurrence_annotation"]
    assert summary["annotated_term_count"] == 1
    assert summary["duplicate_annotation_count"] == 1


def test_annotation_at_first_occurrence_is_clean() -> None:
    items = [
        _item(
            "p001-b001",
            "A convolutional neural network is used.",
            "使用卷积神经网络（convolutional neural network，CNN）。",
        ),
        _item("p001-b002", "The convolutional neural network is trained.", "对卷积神经网络进行训练。"),
    ]
    report = _run(items)
    assert _types(report, "annotations") == []
    assert report["summary"]["first_occurrence_annotation"]["annotation_first_occurrence_rate"] == 1.0


def test_annotation_copied_from_source_counts_as_first_and_is_not_duplicate() -> None:
    items = [
        _item(
            "p001-b001",
            "The World Health Organization (WHO) estimates the burden.",
            "世界卫生组织（WHO）估计了负担。",
        ),
        _item(
            "p001-b002",
            "Diagnosis followed the World Health Organization (WHO) criteria.",
            "诊断采用世界卫生组织（WHO）标准。",
        ),
        _item("p001-b003", "WHO data were used.", "使用了世界卫生组织（WHO）的数据。"),
    ]
    report = _run(items)
    assert "annotation_not_at_first_occurrence" not in _types(report)
    duplicates = [v for v in report["violations"] if v["type"] == "annotation_duplicate"]
    assert [v["location"]["item_id"] for v in duplicates] == ["p001-b003"]


def test_derived_names_joined_by_and_count_as_kept() -> None:
    items = [
        _item("p001-b001", "as shown by Zwanziger and Grant earlier.", "如 Zwanziger 和 Grant 先前所示。"),
        _item("p001-b002", "Zwanziger and Grant also noted this.", "Zwanziger and Grant 也注意到这一点。"),
    ]
    assert _types(_run(items), "terms") == []


def test_known_term_annotation_coverage(tmp_path: Path) -> None:
    term_base = tmp_path / "term-base.v1.json"
    term_base.write_text(json.dumps({"terms": [{"source": "reduced mass", "target": "约化质量"}]}), encoding="utf-8")
    report = _run(
        [_item("p001-b001", "The reduced mass is defined here.", "此处定义约化质量。")],
        term_base_path=term_base,
    )
    assert _find(report, "annotation_missing")["severity"] == "minor"
    assert report["summary"]["first_occurrence_annotation"]["known_term_coverage_rate"] == 0.0


def test_derived_inconsistent_rendering() -> None:
    items = [
        _item("p001-b001", "Hermite polynomials appear.", "出现了厄米多项式。"),
        _item("p001-b002", "The Hermite polynomials are listed.", "列出了厄米多项式。"),
        _item("p001-b003", "Using Hermite polynomials we find.", "利用 Hermite 多项式可得。"),
    ]
    report = _run(items)
    violation = _find(report, "term_inconsistent_rendering")
    assert violation["location"]["item_id"] == "p001-b003"
    derived = report["summary"]["term_consistency"]["derived"]
    assert derived["inconsistent_term_count"] == 1


# ---- 残留英文、漏译、标点 --------------------------------------------------------


def test_residual_english_sentence() -> None:
    report = _run(
        [
            _item(
                "p001-b001",
                "The force is proportional to the displacement. We now consider the energy of the system as a whole.",
                "力与位移成正比。We now consider the energy of the system as a whole.",
            )
        ]
    )
    violation = _find(report, "english_sentence_residue")
    assert violation["severity"] == "minor"


def test_residue_excludes_terms_code_and_references() -> None:
    clean = _run(
        [
            _item(
                "p001-b001",
                "We used PyTorch Lightning with the ImageNet Large Scale Visual Recognition dataset.",
                "我们使用 PyTorch Lightning 与 ImageNet Large Scale Visual Recognition 数据集，调用 model.fit_transform(x)。",
            )
        ]
    )
    assert _types(clean, "english_residue") == []
    reference = _run(
        [
            _item(
                "p001-b001",
                "[1] Smith, J. and Doe, A. The theory of the harmonic oscillator. J. Chem. Phys. 12, 3 (1990).",
                "[1] Smith, J. and Doe, A. The theory of the harmonic oscillator in the limit of the small. J. Chem. Phys.",
                block_class="reference_entry",
            )
        ]
    )
    assert _types(reference, "english_residue") == []


def test_untranslated_block_is_critical() -> None:
    text = "The vibration of a diatomic molecule can be described by a harmonic oscillator in this chapter."
    report = _run([_item("p001-b001", text, text)])
    assert _find(report, "untranslated_block")["severity"] == "critical"


def test_omission_thresholds_are_conservative_and_reported() -> None:
    normal = _run(
        [
            _item(
                "p001-b001",
                "The vibration of a diatomic molecule can be described by a harmonic oscillator. "
                "We shall first study a classical harmonic oscillator.",
                "双原子分子的振动可用谐振子描述。我们首先研究经典谐振子。",
            )
        ]
    )
    assert _types(normal, "omission") == []
    short = _run(
        [
            _item(
                "p001-b001",
                "5–30. Show that the eigenfunctions and eigenvalues of a three-dimensional harmonic oscillator whose potential energy is",
                "5–30. 证明势能为",
            )
        ]
    )
    assert _find(short, "length_ratio_low")["severity"] == "major"
    thresholds = short["config"]["thresholds"]["omission"]
    assert thresholds["length_ratio_major"] == pytest.approx(0.18)


@pytest.mark.parametrize(
    ("translated", "expected"),
    [
        ("解:证明此式", "halfwidth_punctuation"),
        ("结果如下(见附录)。", "halfwidth_parentheses"),
        ("共有３个分子。", "fullwidth_alnum"),
        ("依此类推...", "ellipsis_style"),
        ("依此类推…", "ellipsis_style"),
        ("这一点—正如前述—很重要。", "dash_style"),
        ("约翰•史密斯提出了该方法。", "name_separator"),
        ("所谓\"简正坐标\"是指。", "straight_quotes"),
        ("因此 ，我们得到结果。", "fullwidth_punctuation_spacing"),
    ],
)
def test_punctuation_rules_positive(translated: str, expected: str) -> None:
    report = _run([_item("p001-b001", "Some source text here.", translated)])
    assert expected in _types(report, "punctuation")


def test_punctuation_rules_negative() -> None:
    report = _run(
        [
            _item(
                "p001-b001",
                "Some source text here.",
                "约翰·史密斯指出——正如前述——本征值为 0, 1, 2, ...，依此类推……因此， $x$ 为位移；见习题 $5$–$12$。"
                "反应物–产物对由 2-(4-氟苯基)氧杂环丁烷与(2-苯基)(苯基)甲酮给出。",
            )
        ]
    )
    assert _types(report, "punctuation") == []


# ---- fit 报告、开关、产物 --------------------------------------------------------


def test_fit_report_missing_is_skipped() -> None:
    report = _run([_item("p001-b001", "Text.", "文本。")])
    assert report["checks"]["layout_fit"]["status"] == "skipped"
    assert report["summary"]["layout_fit"]["status"] == "skipped"


def test_fit_report_overflow_and_emergency(tmp_path: Path) -> None:
    fit_path = tmp_path / "fit_report.v1.json"
    fit_path.write_text(
        json.dumps(
            {
                "items": [
                    {"item_id": "p001-b001", "page": 1, "final_font_size": 6.0, "base_font_size": 10.0,
                     "scale": 0.6, "emergency_tier": False, "overflow": True, "overflow_chars_estimate": 12},
                    {"item_id": "p001-b002", "page": 1, "final_font_size": 4.5, "base_font_size": 10.0,
                     "scale": 0.45, "emergency_tier": True, "overflow": False, "overflow_chars_estimate": 0},
                    {"item_id": "p001-b003", "page": 1, "final_font_size": 10.0, "base_font_size": 10.0,
                     "scale": 1.0, "emergency_tier": False, "overflow": False, "overflow_chars_estimate": 0},
                ]
            }
        ),
        encoding="utf-8",
    )
    items = [_item(f"p001-b00{index}", "Text.", "文本。") for index in (1, 2, 3)]
    report = _run(items, fit_report_path=fit_path)
    assert _find(report, "layout_overflow")["severity"] == "major"
    assert _find(report, "layout_emergency_tier")["severity"] == "minor"
    assert report["summary"]["layout_fit"]["overflow_count"] == 1
    assert report["summary"]["layout_fit"]["emergency_tier_count"] == 1


def test_review_kinds_are_attached_not_recomputed() -> None:
    review = {
        "schema": "translation_review_v1",
        "issue_count": 1,
        "issue_summary": {"truncated_translation": 1},
        "severity_summary": {"error": 1},
        "issues": [{"item_id": "p001-b001", "kind": "truncated_translation", "severity": "error"}],
    }
    report = _run([_item("p001-b001", "Text here.", "解:文本。")], translation_review=review)
    assert report["inputs"]["translation_review"]["issue_summary"] == {"truncated_translation": 1}
    violation = _find(report, "halfwidth_punctuation")
    assert violation["translation_review_kinds"] == ["truncated_translation"]


def test_skipped_items_are_counted() -> None:
    report = _run(
        [
            _item("p001-b001", "x = 1", "x = 1", block_class="formula", final_status="kept_origin"),
            _item("p001-b002", "Body text.", "Body text.", final_status="kept_origin"),
            _item("p001-b003", "Body text.", "正文。"),
        ]
    )
    summary = report["summary"]
    assert summary["checked_item_count"] == 1
    assert summary["skipped_by_reason"] == {"final_status:kept_origin": 1, "formula_block": 1}


def test_switch_env() -> None:
    assert translation_qa_enabled({}) is True
    assert translation_qa_enabled({"RETAIN_TRANSLATION_QA": "1"}) is True
    for value in ("0", "off", "false", "OFF"):
        assert translation_qa_enabled({"RETAIN_TRANSLATION_QA": value}) is False


def test_inline_writer_respects_switch_and_never_raises(tmp_path: Path, monkeypatch) -> None:
    translations_dir = tmp_path / "job" / "translated"
    translations_dir.mkdir(parents=True)
    pages = {0: [_item("p001-b001", "Body text.", "正文。")]}

    monkeypatch.setenv("RETAIN_TRANSLATION_QA", "off")
    assert write_translation_qa_for_run(translations_dir=translations_dir, translated_pages_map=pages) is None
    assert not (tmp_path / "job" / "artifacts" / TRANSLATION_QA_FILE_NAME).exists()

    monkeypatch.delenv("RETAIN_TRANSLATION_QA")
    path = write_translation_qa_for_run(translations_dir=translations_dir, translated_pages_map=pages)
    assert path == tmp_path / "job" / "artifacts" / TRANSLATION_QA_FILE_NAME
    assert json.loads(path.read_text(encoding="utf-8"))["generator"]["mode"] == "inline"

    def boom(*_args, **_kwargs):
        raise ValueError("boom")

    monkeypatch.setattr(qa_report, "build_translation_qa", boom)
    assert write_translation_qa_for_run(translations_dir=translations_dir, translated_pages_map=pages) is None


def test_offline_job_recompute_and_cli(tmp_path: Path) -> None:
    job_root = tmp_path / "job"
    translated = job_root / "translated"
    translated.mkdir(parents=True)
    (job_root / "artifacts").mkdir()
    (job_root / "specs").mkdir()
    page = [_item("p001-b001", "The reduced mass is used in Figure 5.4.", "使用了折合质量，见图 5.4。")]
    (translated / "page-001-deepseek.json").write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
    (translated / "translation-manifest.json").write_text(
        json.dumps(
            {
                "schema": "translation_manifest_v1",
                "schema_version": 1,
                "pages": [{"page_index": 0, "page_number": 1, "path": "page-001-deepseek.json"}],
            }
        ),
        encoding="utf-8",
    )
    (job_root / "specs" / "translate.spec.json").write_text(
        json.dumps({"params": {"glossary_entries": [{"source": "reduced mass", "target": "约化质量", "level": "canonical"}]}}),
        encoding="utf-8",
    )
    (job_root / "artifacts" / "translation_review.json").write_text(
        json.dumps({"schema": "translation_review_v1", "issue_count": 0, "issues": []}), encoding="utf-8"
    )
    report = build_translation_qa_for_job(job_root)
    assert report["generator"]["mode"] == "offline"
    assert report["inputs"]["glossary_entry_count"] == 1
    assert report["inputs"]["translation_review"]["status"] == "artifact"
    assert "term_violation" in _types(report, "terms")

    from devtools import run_translation_qa

    output = tmp_path / "out" / "qa.json"
    assert run_translation_qa.main(["--job-root", str(job_root), "--output", str(output)]) == 0
    assert json.loads(output.read_text(encoding="utf-8"))["schema"] == "translation_qa.v1"


# ---- 产物 schema ----------------------------------------------------------------


def _validate(instance, schema: dict, path: str = "$") -> list[str]:
    """只覆盖本 schema 用到的那一小撮关键字：type/required/properties/enum/const/pattern/items/minimum。"""
    errors: list[str] = []
    expected_type = schema.get("type")
    type_map = {"object": dict, "array": list, "string": str, "integer": int, "number": (int, float), "null": type(None)}
    if expected_type:
        types = expected_type if isinstance(expected_type, list) else [expected_type]
        if not any(isinstance(instance, type_map[name]) and not (name in {"integer", "number"} and isinstance(instance, bool)) for name in types):
            return [f"{path}: expected {types}, got {type(instance).__name__}"]
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: expected const {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: {instance!r} not in {schema['enum']}")
    if "pattern" in schema and isinstance(instance, str) and not re.search(schema["pattern"], instance):
        errors.append(f"{path}: {instance!r} does not match {schema['pattern']}")
    if "minimum" in schema and isinstance(instance, (int, float)) and instance < schema["minimum"]:
        errors.append(f"{path}: below minimum")
    if isinstance(instance, dict):
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing {key}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            if key in properties:
                errors.extend(_validate(value, properties[key], f"{path}.{key}"))
            elif isinstance(schema.get("additionalProperties"), dict):
                errors.extend(_validate(value, schema["additionalProperties"], f"{path}.{key}"))
    if isinstance(instance, list) and isinstance(schema.get("items"), dict):
        for index, value in enumerate(instance):
            errors.extend(_validate(value, schema["items"], f"{path}[{index}]"))
    return errors


def test_report_matches_schema(tmp_path: Path) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    fit_path = tmp_path / "fit_report.v1.json"
    fit_path.write_text(json.dumps([{"item_id": "p001-b002", "overflow": True}]), encoding="utf-8")
    items = [
        _item("p001-b001", "The market reached 3 billion dollars in Figure 3.2.", "如表 3.2，市场规模达到 3 亿美元..."),
        _item("p001-b002", "Hermite polynomials appear.", "出现了厄米多项式。"),
        _item("p001-b003", "Hermite polynomials appear again.", "再次出现 Hermite 多项式。"),
    ]
    report = _run(items, fit_report_path=fit_path)
    assert report["violations"]
    assert _validate(json.loads(json.dumps(report, ensure_ascii=False)), schema) == []


# ---- 翻译阶段收尾的调用点 ---------------------------------------------------------


def test_execution_runner_writes_qa_after_commit(tmp_path: Path, monkeypatch) -> None:
    from devtools.tests.translation.test_translation_checkpoint_commit import _install_execution_stubs
    from devtools.tests.translation.test_translation_checkpoint_commit import _plan
    from devtools.tests.translation.test_translation_checkpoint_commit import _request
    from retainpdf_pipeline.translate.workflow import execution_runner

    request = _request(tmp_path)
    _install_execution_stubs(monkeypatch, translated_text="译文")
    monkeypatch.setattr(execution_runner, "blocking_untranslated_items", lambda _pages: [])
    monkeypatch.delenv("RETAIN_TRANSLATION_QA", raising=False)
    execution_runner.run_translation_execution_plan(request, _plan())
    qa_path = request.output_dir.parent / "artifacts" / TRANSLATION_QA_FILE_NAME
    assert json.loads(qa_path.read_text(encoding="utf-8"))["summary"]["item_count"] == 1


def test_execution_runner_survives_qa_failure(tmp_path: Path, monkeypatch) -> None:
    from devtools.tests.translation.test_translation_checkpoint_commit import _install_execution_stubs
    from devtools.tests.translation.test_translation_checkpoint_commit import _plan
    from devtools.tests.translation.test_translation_checkpoint_commit import _request
    from retainpdf_pipeline.translate.workflow import execution_runner

    def boom(*_args, **_kwargs):
        raise RuntimeError("qa exploded")

    request = _request(tmp_path)
    _install_execution_stubs(monkeypatch, translated_text="译文")
    monkeypatch.setattr(execution_runner, "blocking_untranslated_items", lambda _pages: [])
    monkeypatch.setattr(qa_report, "build_translation_qa", boom)
    result = execution_runner.run_translation_execution_plan(request, _plan())
    assert result["translated_items"] == 1
    assert (request.output_dir / "translation-manifest.json").exists()
    assert not (request.output_dir.parent / "artifacts" / TRANSLATION_QA_FILE_NAME).exists()


# ---- 与【3】【5】产物的实际格式对齐 ------------------------------------------------


def _term_base_v1(path: Path, *, complete: bool, level: str = "preferred") -> None:
    path.write_text(
        json.dumps(
            {
                "schema": "term_base_v1",
                "schema_version": 1,
                "preparation_mode": "terms+style",
                "complete": complete,
                "summary": {"term_count": 1},
                "terms": [
                    {
                        "source": "harmonic oscillator",
                        "target": "谐振子",
                        "frequency": 2,
                        "first_occurrence": {"page_index": 0, "page_number": 1, "item_id": "p001-b001"},
                        "conflict_candidates": [{"target": "简谐振子", "votes": 1}],
                        "origin": "extracted",
                        "votes": 2,
                        "kind": "domain_term",
                        "level": level,
                    }
                ],
                "conflicts": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def test_term_base_v1_levels_and_incomplete_flag(tmp_path: Path) -> None:
    term_base = tmp_path / "term-base.v1.json"
    items = [
        _item("p001-b001", "A harmonic oscillator is studied.", "研究谐振子（harmonic oscillator）。"),
        _item("p001-b002", "The Harmonic Oscillator again.", "简振子再次出现。"),
    ]
    _term_base_v1(term_base, complete=False)
    report = _run(items, term_base_path=term_base)
    assert report["inputs"]["term_base"]["complete"] is False
    assert "不完整" in report["checks"]["terms"]["note"]
    assert _find(report, "term_preferred_missing")["severity"] == "minor"
    assert report["summary"]["term_consistency"]["preferred"]["consistency_rate"] == 0.5

    _term_base_v1(term_base, complete=True, level="canonical")
    locked = _run(items, term_base_path=term_base)
    assert "note" not in locked["checks"]["terms"]
    assert _find(locked, "term_violation")["severity"] == "major"


def test_style_guide_qa_rule_is_referenced(tmp_path: Path) -> None:
    style_guide = tmp_path / "style-guide.v1.json"
    style_guide.write_text(
        json.dumps(
            {
                "rules": [
                    {"id": "first_mention_gloss", "category": "terms", "rule": "首现括注", "example": "", "apply": "qa"},
                    {"id": "tone", "category": "style", "rule": "正式", "example": "", "apply": "prompt"},
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    items = [
        _item("p001-b001", "A convolutional neural network is used.", "使用卷积神经网络。"),
        _item(
            "p001-b002",
            "The convolutional neural network is trained.",
            "对卷积神经网络（convolutional neural network）进行训练。",
        ),
    ]
    report = _run(items, style_guide_path=style_guide)
    assert [rule["id"] for rule in report["inputs"]["style_guide"]["qa_rules"]] == ["first_mention_gloss"]
    assert _find(report, "annotation_not_at_first_occurrence")["evidence"]["style_rule_id"] == "first_mention_gloss"
    assert report["summary"]["first_occurrence_annotation"]["style_rule_id"] == "first_mention_gloss"
    without = _run(items, style_guide_path=tmp_path / "missing.json")
    assert without["inputs"]["style_guide"]["status"] == "missing"
    assert "style_rule_id" not in _find(without, "annotation_not_at_first_occurrence")["evidence"]


def test_fit_report_v1_status_and_measured(tmp_path: Path) -> None:
    fit_path = tmp_path / "fit_report.v1.json"
    blocks = [
        {"item_id": "p001-b001", "page": 1, "final_font_size": 7.0, "base_font_size": 10.0, "scale": 0.7,
         "emergency_tier": False, "tier": "shrink", "overflow": True, "overflow_chars_estimate": 8,
         "overflow_pt": 3.2, "measured": True},
        {"item_id": "p001-b002", "page": 1, "final_font_size": 4.2, "base_font_size": 10.0, "scale": 0.42,
         "emergency_tier": True, "tier": "emergency", "overflow": False, "overflow_chars_estimate": 0,
         "overflow_pt": 0, "measured": True},
        {"item_id": "p001-b003", "page": 1, "final_font_size": 10.0, "base_font_size": 10.0, "scale": 1.0,
         "emergency_tier": False, "tier": "base", "overflow": True, "overflow_chars_estimate": 5,
         "overflow_pt": 1.0, "measured": False},
    ]
    items = [_item(f"p001-b00{index}", "Text.", "文本。") for index in (1, 2, 3)]
    fit_path.write_text(json.dumps({"status": "ok", "blocks": blocks, "summary": {}}), encoding="utf-8")
    report = _run(items, fit_report_path=fit_path)
    assert [v["location"]["item_id"] for v in report["violations"] if v["type"] == "layout_overflow"] == ["p001-b001"]
    assert _find(report, "layout_emergency_tier")["location"]["item_id"] == "p001-b002"

    fit_path.write_text(json.dumps({"status": "unavailable", "blocks": blocks}), encoding="utf-8")
    skipped = _run(items, fit_report_path=fit_path)
    assert skipped["checks"]["layout_fit"]["status"] == "skipped"
    assert "unavailable" in skipped["checks"]["layout_fit"]["reason"]
    assert _types(skipped, "layout_fit") == []
