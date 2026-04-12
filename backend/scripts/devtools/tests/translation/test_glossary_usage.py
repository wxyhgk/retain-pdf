import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.terms.usage import summarize_glossary_usage


def test_summarize_glossary_usage_counts_hits_and_unapplied_terms() -> None:
    summary = summarize_glossary_usage(
        entries=[
            {"source": "band gap", "target": "带隙", "note": ""},
            {"source": "density of states", "target": "态密度", "note": "physics", "level": "preferred"},
            {"source": "photocatalyst", "target": "光催化剂", "note": "", "level": "canonical"},
        ],
        translated_pages_map={
            0: [
                {
                    "source_text": "The band gap and density of states were calculated.",
                    "translated_text": "计算了带隙和 DOS。",
                }
            ],
            1: [
                {
                    "translation_unit_protected_source_text": "The sample is a photocatalyst.",
                    "translated_text": "该样品是一种催化剂。",
                }
            ],
        },
        glossary_id="glossary-123",
        glossary_name="materials",
        resource_entry_count=2,
        inline_entry_count=1,
        overridden_entry_count=1,
    )

    assert summary["enabled"] is True
    assert summary["glossary_id"] == "glossary-123"
    assert summary["glossary_name"] == "materials"
    assert summary["entry_count"] == 3
    assert summary["resource_entry_count"] == 2
    assert summary["inline_entry_count"] == 1
    assert summary["overridden_entry_count"] == 1
    assert summary["source_hit_entry_count"] == 3
    assert summary["target_hit_entry_count"] == 1
    assert summary["unused_entry_count"] == 0
    assert summary["unapplied_source_hit_entry_count"] == 2
    assert summary["level_counts"] == {"preserve": 0, "canonical": 1, "preferred": 2}
    assert summary["preferred_hit_entry_count"] == 1
    assert summary["preferred_adoption_rate"] == 0.5
