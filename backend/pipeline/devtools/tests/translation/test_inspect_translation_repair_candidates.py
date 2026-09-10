import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.inspect_translation_repair_candidates import inspect_repair_candidates


def _write_page(path: Path, payload: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _item(item_id: str, source_text: str, translated_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "translation_unit_protected_source_text": source_text,
        "protected_translated_text": translated_text,
        "translated_text": translated_text,
        "should_translate": True,
        "policy_translate": True,
        "structure_role": "body",
        "protected_map": [],
        "formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_formula_map": [],
    }
    item.update(overrides)
    return item


def test_inspect_translation_repair_candidates_counts_repairable_and_blocking(tmp_path: Path) -> None:
    translated_dir = tmp_path / "translated"
    _write_page(
        translated_dir / "page-001-deepseek.json",
        [
            _item(
                "p001-b001",
                (
                    "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                    "before the final energy is evaluated for the system."
                ),
                (
                    "The self-consistent field procedure computes the molecular orbitals <f1-abc/> "
                    "before the final energy is evaluated for the system."
                ),
            ),
            _item(
                "p001-b002",
                "The final energy <f1-abc/> is reported.",
                "最终能量 <f9-bad/> 被报告。",
            ),
            _item(
                "p001-b003",
                "Figure caption",
                "",
                should_translate=False,
                policy_translate=False,
                final_status="kept_origin",
            ),
        ],
    )

    summary = inspect_repair_candidates(translated_dir=translated_dir)

    assert summary["page_payload_count"] == 1
    assert summary["counts"]["items"] == 3
    assert summary["counts"]["not_should_translate"] == 1
    assert summary["counts"]["reviewed_items"] == 2
    assert summary["counts"]["repairable_items"] == 1
    assert summary["counts"]["blocking_items"] == 1
    assert summary["repairable_issue_counts"]["english_residue"] == 1
    assert summary["blocking_issue_counts"]["unexpected_placeholder"] == 1
