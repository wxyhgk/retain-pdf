"""确定性 QA 报告：artifacts/translation_qa.v1.json。

零 LLM 成本、全书 100% 覆盖、只出报告不改译文。与 translation_review 是并列产物：
- 占位符：直接复用 review_placeholders；
- 术语命中：与 glossary_term_missing 同一套匹配（matched_glossary_entries）与期望译法；
- 公式命令丢失、协议壳、上下文串入、空译等 review 已经在查的项，QA 不重算，
  只在汇总里引用 review 的结论，并在每条违规上附同一块的 review 结论（translation_review_kinds）。
两边范围不同的地方只有一处：QA 对续接组按整组比，review 按单块比。

开关：环境变量 RETAIN_TRANSLATION_QA（默认开启；设为 0 / off / false 关闭）。
生成失败只打日志，不影响翻译任务。
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime
from datetime import timezone
import json
import os
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.config.output_layout import ARTIFACTS_DIR_NAME
from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic
from retainpdf_pipeline.translate.core.payload.manifest import load_translation_manifest
from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.quality.qa.fit import CHECK_LAYOUT_FIT
from retainpdf_pipeline.translate.services.quality.qa.fit import check_fit_report
from retainpdf_pipeline.translate.services.quality.qa.fit import locate_fit_report
from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_CRITICAL
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_DEFINITIONS
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_ORDER
from retainpdf_pipeline.translate.services.quality.qa.models import TRANSLATION_QA_FILE_NAME
from retainpdf_pipeline.translate.services.quality.qa.models import TRANSLATION_QA_SCHEMA
from retainpdf_pipeline.translate.services.quality.qa.models import TRANSLATION_QA_SCHEMA_VERSION
from retainpdf_pipeline.translate.services.quality.qa.numerics import CHECK_NUMBERS
from retainpdf_pipeline.translate.services.quality.qa.numerics import NumberChecker
from retainpdf_pipeline.translate.services.quality.qa.omission import CHECK_OMISSION
from retainpdf_pipeline.translate.services.quality.qa.omission import OMISSION_THRESHOLDS
from retainpdf_pipeline.translate.services.quality.qa.omission import check_unit_omission
from retainpdf_pipeline.translate.services.quality.qa.references import CHECK_PLACEHOLDERS
from retainpdf_pipeline.translate.services.quality.qa.references import CHECK_REFERENCES
from retainpdf_pipeline.translate.services.quality.qa.references import ReferenceChecker
from retainpdf_pipeline.translate.services.quality.qa.references import check_unit_placeholders
from retainpdf_pipeline.translate.services.quality.qa.style import CHECK_PUNCTUATION
from retainpdf_pipeline.translate.services.quality.qa.style import CHECK_RESIDUE
from retainpdf_pipeline.translate.services.quality.qa.style import PUNCTUATION_RULE_NAMES
from retainpdf_pipeline.translate.services.quality.qa.style import RESIDUE_MAJOR_WORDS
from retainpdf_pipeline.translate.services.quality.qa.style import RESIDUE_MIN_FUNCTION_WORDS
from retainpdf_pipeline.translate.services.quality.qa.style import RESIDUE_MIN_WORDS
from retainpdf_pipeline.translate.services.quality.qa.style import check_item_punctuation
from retainpdf_pipeline.translate.services.quality.qa.style import check_item_residue
from retainpdf_pipeline.translate.services.quality.qa.terms import CHECK_ANNOTATIONS
from retainpdf_pipeline.translate.services.quality.qa.terms import CHECK_TERMS
from retainpdf_pipeline.translate.services.quality.qa.terms import FIRST_MENTION_GLOSS_RULE_ID
from retainpdf_pipeline.translate.services.quality.qa.terms import STYLE_GUIDE_FILE_NAME
from retainpdf_pipeline.translate.services.quality.qa.terms import TERM_BASE_FILE_NAME
from retainpdf_pipeline.translate.services.quality.qa.terms import load_style_guide_qa_rules
from retainpdf_pipeline.translate.services.quality.qa.terms import TermChecker
from retainpdf_pipeline.translate.services.quality.qa.units import build_qa_items
from retainpdf_pipeline.translate.services.quality.qa.units import build_qa_units


TRANSLATION_QA_ENV = "RETAIN_TRANSLATION_QA"
REF_LABEL_MINORITY_SHARE = 0.1
TRANSLATION_REVIEW_FILE_NAME = "translation_review.json"
TRANSLATE_STAGE_SPEC_RELATIVE = Path("specs") / "translate.spec.json"

CHECK_ORDER: tuple[str, ...] = (
    CHECK_NUMBERS,
    CHECK_REFERENCES,
    CHECK_PLACEHOLDERS,
    CHECK_TERMS,
    CHECK_ANNOTATIONS,
    CHECK_RESIDUE,
    CHECK_OMISSION,
    CHECK_PUNCTUATION,
    CHECK_LAYOUT_FIT,
)

# 与 translation_review 的分工。写进报告，前端和人工审校都能看到哪些结论在哪边。
REVIEW_RELATIONSHIP: dict[str, Any] = {
    "reused_functions": {
        CHECK_PLACEHOLDERS: "llm.validation.quality.review_placeholders（同一函数，按整组比较）",
        CHECK_TERMS: "core.terms.matched_glossary_entries（与 glossary_term_missing 同口径，按整组比较）",
    },
    "parallel_checks": {
        CHECK_RESIDUE: "review 的 english_residue / mixed_english_residue 判整块；QA 只抓整句级残留",
        CHECK_OMISSION: "review 的 truncated_translation 是极端短译；QA 是按整组比较的保守粗筛",
    },
    "referenced_only": [
        "empty_translation",
        "formula_commands_dropped",
        "math_delimiter_unbalanced",
        "protocol_shell_output",
        "context_bleed",
        "context_borrow",
        "keep_origin_degraded",
        "missing_result",
        "unexpected_result",
    ],
}


def translation_qa_enabled(environ: dict[str, str] | None = None) -> bool:
    value = str((environ if environ is not None else os.environ).get(TRANSLATION_QA_ENV, "") or "").strip().lower()
    return value not in {"0", "off", "false", "no", "disabled"}


def _review_summary(translation_review: dict[str, Any] | None, source: str) -> dict[str, Any]:
    if not isinstance(translation_review, dict) or not translation_review:
        return {"status": "missing"}
    return {
        "status": source,
        "schema": translation_review.get("schema", ""),
        "issue_count": int(translation_review.get("issue_count", 0) or 0),
        "has_errors": bool(translation_review.get("has_errors", False)),
        "issue_summary": dict(translation_review.get("issue_summary") or {}),
        "severity_summary": dict(translation_review.get("severity_summary") or {}),
    }


def _review_kinds_by_item(translation_review: dict[str, Any] | None) -> dict[str, set[str]]:
    kinds: dict[str, set[str]] = {}
    if not isinstance(translation_review, dict):
        return kinds
    for issue in translation_review.get("issues") or []:
        if not isinstance(issue, dict):
            continue
        item_id = str(issue.get("item_id", "") or "")
        kind = str(issue.get("kind", "") or "")
        if item_id and kind:
            kinds.setdefault(item_id, set()).add(kind)
    return kinds


def build_translation_qa(
    translated_pages_map: dict[int, list[dict]],
    *,
    glossary_entries: list[GlossaryEntry | dict] | None = None,
    term_base_path: Path | None = None,
    style_guide_path: Path | None = None,
    fit_report_path: Path | None = None,
    translation_review: dict[str, Any] | None = None,
    translation_review_source: str = "inline",
    mode: str = "inline",
    job_root: Path | None = None,
) -> dict[str, Any]:
    style_guide = load_style_guide_qa_rules(style_guide_path)
    qa_rule_ids = {str(rule.get("id", "")) for rule in style_guide.get("qa_rules", [])}
    items = build_qa_items(translated_pages_map)
    units = build_qa_units(items)
    items_by_id = {item.item_id: item for item in items}

    numbers = NumberChecker()
    references = ReferenceChecker()
    terms = TermChecker(
        glossary_entries=glossary_entries,
        term_base_path=term_base_path,
        annotation_rule_id=FIRST_MENTION_GLOSS_RULE_ID if FIRST_MENTION_GLOSS_RULE_ID in qa_rule_ids else "",
    )
    violations: list[QaViolation] = []
    checked_units = [unit for unit in units if unit.checked]
    for unit in checked_units:
        violations.extend(numbers.check_unit(unit))
        violations.extend(references.check_unit(unit))
        violations.extend(check_unit_placeholders(unit))
        violations.extend(terms.check_unit(unit))
        violations.extend(check_unit_omission(unit))
    checked_items = [item for item in items if item.checked]
    for item in checked_items:
        violations.extend(check_item_residue(item))
        violations.extend(check_item_punctuation(item))

    term_violations, term_consistency, annotation_summary, term_rows = terms.finalize()
    violations.extend(term_violations)
    label_variants, label_violations = references.label_consistency(minority_share=REF_LABEL_MINORITY_SHARE)
    violations.extend(label_violations)
    fit_summary, fit_violations = check_fit_report(fit_report_path, items_by_id)
    violations.extend(fit_violations)

    review_kinds = _review_kinds_by_item(translation_review)
    violations.sort(key=lambda violation: violation.sort_key())
    violation_payloads = []
    for index, violation in enumerate(violations, start=1):
        kinds = sorted({kind for item_id in violation.item_ids for kind in review_kinds.get(item_id, set())})
        violation_payloads.append(violation.as_dict(f"qa-{index:05d}", kinds))

    all_direct_math = bool(checked_units) and all(unit.direct_math for unit in checked_units)
    checks: dict[str, dict[str, Any]] = {}
    by_check = Counter(violation.check for violation in violations)
    for check in CHECK_ORDER:
        entry: dict[str, Any] = {"status": "ok", "violation_count": by_check.get(check, 0)}
        if check == CHECK_PLACEHOLDERS and all_direct_math:
            entry = {"status": "skipped", "reason": "direct_typst 模式不使用占位符", "violation_count": 0}
        if check == CHECK_TERMS and term_consistency.get("term_base_complete") is False:
            entry["note"] = term_consistency["sources"]["term_base"].get("note", "术语表不完整")
        if check == CHECK_LAYOUT_FIT and fit_summary.get("status") == "skipped":
            entry = {"status": "skipped", "reason": fit_summary.get("reason", ""), "violation_count": 0}
        checks[check] = entry

    blocking = [violation for violation in violations if violation.severity in {SEVERITY_CRITICAL, SEVERITY_MAJOR}]
    blocking_units = {violation.unit_id or violation.item_ids[0] for violation in blocking if violation.item_ids}
    clean_units = sum(1 for unit in checked_units if unit.unit_id not in blocking_units)
    skipped_reasons = Counter(item.skip_reason for item in items if not item.checked)
    summary = {
        "item_count": len(items),
        "checked_item_count": len(checked_items),
        "skipped_item_count": len(items) - len(checked_items),
        "skipped_by_reason": dict(sorted(skipped_reasons.items())),
        "unit_count": len(units),
        "checked_unit_count": len(checked_units),
        "group_unit_count": sum(1 for unit in checked_units if unit.kind == "group"),
        "violation_count": len(violations),
        "by_severity": {severity: sum(1 for v in violations if v.severity == severity) for severity in SEVERITY_ORDER},
        "by_check": {check: by_check.get(check, 0) for check in CHECK_ORDER},
        "by_type": dict(sorted(Counter(violation.type for violation in violations).items())),
        "items_with_violations": len({item_id for violation in violations for item_id in violation.item_ids}),
        "units_without_critical_or_major": clean_units,
        "clean_unit_rate": round(clean_units / len(checked_units), 4) if checked_units else None,
        "numbers_checked": numbers.checked_number_count,
        "references_checked": references.checked_ref_count,
        "term_consistency": term_consistency,
        "first_occurrence_annotation": annotation_summary,
        "reference_label_variants": label_variants,
        "layout_fit": fit_summary,
    }
    return {
        "schema": TRANSLATION_QA_SCHEMA,
        "schema_version": TRANSLATION_QA_SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": {"mode": mode, "job_root": str(job_root) if job_root else ""},
        "config": {
            "switch_env": TRANSLATION_QA_ENV,
            "severity_definitions": SEVERITY_DEFINITIONS,
            "thresholds": {
                CHECK_OMISSION: OMISSION_THRESHOLDS,
                CHECK_RESIDUE: {
                    "min_words": RESIDUE_MIN_WORDS,
                    "major_words": RESIDUE_MAJOR_WORDS,
                    "min_function_words": RESIDUE_MIN_FUNCTION_WORDS,
                },
                CHECK_REFERENCES: {"label_inconsistent_minority_share": REF_LABEL_MINORITY_SHARE},
                CHECK_PUNCTUATION: {"rules": list(PUNCTUATION_RULE_NAMES)},
            },
            "continuation_groups": "内容保真类检查按整组比较（成员自己的原文、译文按顺序拼接），标点与残留英文按块检查",
        },
        "inputs": {
            "term_base": term_consistency["sources"]["term_base"],
            "glossary_entry_count": term_consistency["sources"]["glossary_entry_count"],
            "style_guide": style_guide,
            "fit_report": {key: fit_summary.get(key) for key in ("status", "path", "reason") if key in fit_summary},
            "translation_review": _review_summary(translation_review, translation_review_source),
            "translation_review_relationship": REVIEW_RELATIONSHIP,
        },
        "checks": checks,
        "summary": summary,
        "terms": term_rows,
        "violations": violation_payloads,
    }


def write_translation_qa(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    save_json_atomic(path, payload)
    return payload


def _log_summary(path: Path, payload: dict[str, Any]) -> None:
    summary = payload.get("summary") or {}
    severity = summary.get("by_severity") or {}
    print(
        "translation qa: "
        f"units={summary.get('checked_unit_count', 0)} violations={summary.get('violation_count', 0)} "
        f"critical={severity.get('critical', 0)} major={severity.get('major', 0)} minor={severity.get('minor', 0)} "
        f"-> {path}",
        flush=True,
    )


def write_translation_qa_for_run(
    *,
    translations_dir: Path,
    translated_pages_map: dict[int, list[dict]],
    glossary_entries: list[GlossaryEntry | dict] | None = None,
    translation_review: dict[str, Any] | None = None,
) -> Path | None:
    """翻译阶段收尾时调用。任何异常都只记日志，绝不影响翻译任务本身。"""
    if not translation_qa_enabled():
        print(f"translation qa: disabled by {TRANSLATION_QA_ENV}", flush=True)
        return None
    try:
        translations_dir = Path(translations_dir)
        job_root = translations_dir.parent
        output_path = job_root / ARTIFACTS_DIR_NAME / TRANSLATION_QA_FILE_NAME
        payload = build_translation_qa(
            translated_pages_map,
            glossary_entries=glossary_entries,
            term_base_path=translations_dir / TERM_BASE_FILE_NAME,
            style_guide_path=translations_dir / STYLE_GUIDE_FILE_NAME,
            fit_report_path=locate_fit_report(job_root),
            translation_review=translation_review,
            translation_review_source="inline",
            mode="inline",
            job_root=job_root,
        )
        write_translation_qa(output_path, payload)
        _log_summary(output_path, payload)
        return output_path
    except Exception as exc:  # noqa: BLE001 - QA 只是报告，失败不能拖垮翻译
        print(f"translation qa: skipped after error {type(exc).__name__}: {exc}", flush=True)
        return None


# ---- 离线重算（devtools/run_translation_qa.py）---------------------------------


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_translated_pages_for_qa(translations_dir: Path) -> dict[int, list[dict]]:
    try:
        page_paths = load_translation_manifest(translations_dir)
    except (OSError, RuntimeError, ValueError):
        page_paths = {index: path for index, path in enumerate(sorted(translations_dir.glob("page-*.json")))}
    pages: dict[int, list[dict]] = {}
    for page_idx, path in sorted(page_paths.items()):
        payload = _load_json(path)
        pages[int(page_idx)] = payload if isinstance(payload, list) else list(payload.get("items") or [])
    return pages


def load_job_glossary_entries(job_root: Path) -> list[dict]:
    spec_path = job_root / TRANSLATE_STAGE_SPEC_RELATIVE
    if not spec_path.is_file():
        return []
    try:
        entries = (_load_json(spec_path).get("params") or {}).get("glossary_entries") or []
    except (OSError, ValueError, AttributeError):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def build_translation_qa_for_job(job_root: Path, *, translations_dir: Path | None = None) -> dict[str, Any]:
    job_root = Path(job_root)
    translations_dir = Path(translations_dir) if translations_dir else job_root / "translated"
    review_path = job_root / ARTIFACTS_DIR_NAME / TRANSLATION_REVIEW_FILE_NAME
    translation_review = _load_json(review_path) if review_path.is_file() else None
    return build_translation_qa(
        load_translated_pages_for_qa(translations_dir),
        glossary_entries=load_job_glossary_entries(job_root),
        term_base_path=translations_dir / TERM_BASE_FILE_NAME,
        style_guide_path=translations_dir / STYLE_GUIDE_FILE_NAME,
        fit_report_path=locate_fit_report(job_root),
        translation_review=translation_review,
        translation_review_source="artifact",
        mode="offline",
        job_root=job_root,
    )


def default_translation_qa_path(job_root: Path) -> Path:
    return Path(job_root) / ARTIFACTS_DIR_NAME / TRANSLATION_QA_FILE_NAME


__all__ = [
    "REVIEW_RELATIONSHIP",
    "TRANSLATION_QA_ENV",
    "build_translation_qa",
    "build_translation_qa_for_job",
    "default_translation_qa_path",
    "load_job_glossary_entries",
    "load_translated_pages_for_qa",
    "translation_qa_enabled",
    "write_translation_qa",
    "write_translation_qa_for_run",
]
