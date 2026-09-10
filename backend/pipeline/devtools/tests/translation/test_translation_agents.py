import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.agents import TerminologyAgent
from retainpdf_pipeline.translate.services.agents import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents import ConsistencyReviewerAgent
from retainpdf_pipeline.translate.llm.shared.control_context import GlossaryEntry
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


def _body_item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": source_text,
    }
    item.update(overrides)
    return item


def test_terminology_agent_matches_only_terms_present_in_source_texts() -> None:
    agent = TerminologyAgent(
        [
            GlossaryEntry(source="Hartree-Fock", target="Hartree-Fock", level="preserve", match_mode="case_insensitive"),
            GlossaryEntry(source="SCF", target="自洽场", level="preferred"),
            GlossaryEntry(source="DFTB", target="密度泛函紧束缚", level="preferred"),
        ]
    )

    result = agent.match_source_texts(["The SCF cycle starts from Hartree-Fock orbitals."])

    assert [entry.source for entry in result.entries] == ["Hartree-Fock", "SCF"]
    assert result.matched_entry_count == 2
    assert '"source": "SCF"' in result.guidance
    assert '"target": "自洽场"' in result.guidance
    assert "DFTB" not in result.guidance


def test_translation_agent_coordinator_scopes_control_context_terms() -> None:
    context = build_translation_control_context(
        glossary_entries=[
            GlossaryEntry(source="SCF", target="自洽场", level="preferred"),
            GlossaryEntry(source="DFTB", target="密度泛函紧束缚", level="preferred"),
        ]
    )

    scoped = TranslationAgentCoordinator.from_control_context(context).scope_context_to_source_texts(
        context,
        ["The DFTB Hamiltonian is evaluated for each structure."],
    )

    assert [entry.source for entry in scoped.glossary_entries] == ["DFTB"]
    assert '"source": "DFTB"' in scoped.merged_guidance
    assert '"target": "密度泛函紧束缚"' in scoped.merged_guidance
    assert "SCF" not in scoped.merged_guidance


def test_consistency_reviewer_reports_placeholder_and_english_issues_without_raising() -> None:
    item = _body_item(
        "p001-b001",
        (
            "The self-consistent field procedure computes the molecular orbitals <f1-abc/> before "
            "the final energy is evaluated for the system."
        ),
    )
    reviewer = ConsistencyReviewerAgent()

    review = reviewer.review_batch(
        [item],
        {
            "p001-b001": {
                "decision": "translate",
                "translated_text": (
                    "The self-consistent field procedure computes the molecular orbitals <f2-def/> before "
                    "the final energy is evaluated for the system."
                ),
            }
        },
    )

    kinds = {issue.kind for issue in review.issues}
    assert review.has_errors
    assert "english_residue" in kinds
    assert "unexpected_placeholder" in kinds
    assert "placeholder_inventory_mismatch" in kinds


def test_consistency_reviewer_reports_glossary_term_missing() -> None:
    item = _body_item(
        "p002-b003",
        "The SCF cycle is initialized from Hartree-Fock orbitals and then iterated.",
    )
    reviewer = ConsistencyReviewerAgent(
        [
            GlossaryEntry(source="SCF", target="自洽场", level="preferred"),
            GlossaryEntry(source="Hartree-Fock", target="Hartree-Fock", level="preserve", match_mode="case_insensitive"),
        ]
    )

    review = reviewer.review_item(
        item,
        {
            "decision": "translate",
            "translated_text": "该循环由轨道初始化，然后迭代。",
        },
    )

    glossary_issues = [issue for issue in review.issues if issue.kind == "glossary_term_missing"]
    assert [issue.details["source"] for issue in glossary_issues] == ["Hartree-Fock", "SCF"]


def test_translation_agent_coordinator_exposes_reviewer() -> None:
    context = build_translation_control_context(
        glossary_entries=[GlossaryEntry(source="SCF", target="自洽场", level="preferred")]
    )
    item = _body_item("p003-b004", "The SCF cycle is converged before the energy is evaluated.")

    review = TranslationAgentCoordinator.from_control_context(context).review_batch(
        [item],
        {"p003-b004": {"decision": "translate", "translated_text": "该循环在计算能量前收敛。"}},
    )

    assert any(issue.kind == "glossary_term_missing" for issue in review.issues)
