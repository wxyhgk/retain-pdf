from __future__ import annotations

from retainpdf_pipeline.translate.services.context import TranslationDocumentContext
from retainpdf_pipeline.translate.services.context import build_unit_context
from retainpdf_pipeline.translate.services.context import build_unit_contexts
from retainpdf_pipeline.translate.services.context.windows import annotate_translation_context_windows
from retainpdf_pipeline.translate.services.context.windows import build_translation_context_windows


def test_build_unit_context_carries_document_item_and_neighbor_context() -> None:
    item = {
        "item_id": "p005-b002",
        "page_idx": 4,
        "block_idx": 2,
        "block_type": "text",
        "block_kind": "text",
        "source_text": "and nuclear attraction elements",
        "protected_source_text": "and nuclear attraction elements",
        "translation_context_before": "The matrix contains one-electron kinetic",
        "translation_context_after": "that are used to build the Fock operator.",
    }
    document_context = TranslationDocumentContext(
        mode="sci",
        target_language="zh-CN",
        domain_guidance="量子化学手册",
        rule_guidance="保留变量和公式",
        glossary_guidance="Hamiltonian=哈密顿量",
    )

    unit_context = build_unit_context(
        item,
        document_context=document_context,
        order=7,
        memory_guidance="SCF=自洽场",
    )

    assert unit_context.document is document_context
    assert unit_context.item.item_id == "p005-b002"
    assert unit_context.item.order == 7
    assert unit_context.prompt_context_before() == "The matrix contains one-electron kinetic"
    assert unit_context.prompt_context_after() == "that are used to build the Fock operator."
    assert unit_context.prompt_guidance_parts() == [
        "量子化学手册",
        "保留变量和公式",
        "Hamiltonian=哈密顿量",
        "SCF=自洽场",
    ]


def test_build_unit_contexts_preserves_payload_order() -> None:
    payload = [
        {"item_id": "a", "source_text": "First", "protected_source_text": "First"},
        {"item_id": "b", "source_text": "Second", "protected_source_text": "Second"},
    ]

    contexts = build_unit_contexts(payload)

    assert [context.item.item_id for context in contexts] == ["a", "b"]
    assert [context.item.order for context in contexts] == [1, 2]


def test_build_translation_context_windows_returns_data_without_mutating_payload() -> None:
    page_payloads = {
        1: [
            {"item_id": "a", "page_idx": 1, "block_idx": 1, "block_type": "text", "source_text": "Alpha context"},
            {"item_id": "b", "page_idx": 1, "block_idx": 2, "block_type": "text", "source_text": "Beta target"},
            {"item_id": "c", "page_idx": 1, "block_idx": 3, "block_type": "text", "source_text": "Gamma context"},
        ]
    }

    windows = build_translation_context_windows(page_payloads, neighbors=1, text_limit=100)

    assert windows["b"].before == "Alpha context"
    assert windows["b"].after == "Gamma context"
    assert "translation_context_before" not in page_payloads[1][1]
    assert "translation_context_after" not in page_payloads[1][1]


def test_translation_context_windows_attach_neighbor_text() -> None:
    page_payloads = {
        4: [
            {
                "item_id": "p005-b001",
                "page_idx": 4,
                "block_idx": 1,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "The matrix contains one-electron kinetic",
            },
            {
                "item_id": "p005-b002",
                "page_idx": 4,
                "block_idx": 2,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "and nuclear attraction elements",
            },
            {
                "item_id": "p005-b003",
                "page_idx": 4,
                "block_idx": 3,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "that are used to build the Fock operator.",
            },
        ]
    }

    updates = annotate_translation_context_windows(page_payloads, neighbors=1)

    middle = page_payloads[4][1]
    assert updates >= 2
    assert middle["translation_context_before"] == "The matrix contains one-electron kinetic"
    assert middle["translation_context_after"] == "that are used to build the Fock operator."


def test_translation_context_windows_skip_complete_body_paragraph_by_default() -> None:
    page_payloads = {
        4: [
            {
                "item_id": "p005-b001",
                "page_idx": 4,
                "block_idx": 1,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "The matrix contains one-electron kinetic elements.",
            },
            {
                "item_id": "p005-b002",
                "page_idx": 4,
                "block_idx": 2,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "The Fock operator is built from these terms.",
            },
            {
                "item_id": "p005-b003",
                "page_idx": 4,
                "block_idx": 3,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "source_text": "The resulting matrix is diagonalized.",
            },
        ]
    }

    updates = annotate_translation_context_windows(page_payloads, neighbors=1)

    middle = page_payloads[4][1]
    assert updates == 0
    assert middle["translation_context_before"] == ""
    assert middle["translation_context_after"] == ""


def test_translation_context_windows_all_mode_keeps_legacy_neighbor_context() -> None:
    page_payloads = {
        4: [
            {"item_id": "a", "page_idx": 4, "block_idx": 1, "block_type": "text", "source_text": "Alpha sentence."},
            {"item_id": "b", "page_idx": 4, "block_idx": 2, "block_type": "text", "source_text": "Beta sentence."},
            {"item_id": "c", "page_idx": 4, "block_idx": 3, "block_type": "text", "source_text": "Gamma sentence."},
        ]
    }

    updates = annotate_translation_context_windows(page_payloads, neighbors=1, mode="all")

    assert updates >= 2
    assert page_payloads[4][1]["translation_context_before"] == "Alpha sentence."
    assert page_payloads[4][1]["translation_context_after"] == "Gamma sentence."


def test_translation_context_windows_off_mode_clears_context() -> None:
    page_payloads = {
        4: [
            {"item_id": "a", "page_idx": 4, "block_idx": 1, "block_type": "text", "source_text": "Alpha context"},
            {"item_id": "b", "page_idx": 4, "block_idx": 2, "block_type": "text", "source_text": "and beta fragment"},
            {"item_id": "c", "page_idx": 4, "block_idx": 3, "block_type": "text", "source_text": "Gamma context"},
        ]
    }

    updates = annotate_translation_context_windows(page_payloads, neighbors=1, mode="off")

    assert updates == 0
    assert page_payloads[4][1]["translation_context_before"] == ""
    assert page_payloads[4][1]["translation_context_after"] == ""
    assert page_payloads[4][1]["translation_context_mode"] == "off"


def test_context_mode_off_suppresses_continuation_prompt_context() -> None:
    from retainpdf_pipeline.translate.core.context import build_item_context

    item = {
        "item_id": "p006-b056",
        "block_type": "text",
        "source_text": "and the next fragment",
        "protected_source_text": "and the next fragment",
        "continuation_prev_text": "previous sentence",
        "continuation_next_text": "following sentence",
        "translation_context_mode": "off",
    }

    context = build_item_context(item)

    assert context.context_before_for_prompt() == ""
    assert context.context_after_for_prompt() == ""


def test_batch_payload_includes_needed_context_without_continuation_group() -> None:
    from retainpdf_pipeline.translate.core.context import build_item_context

    item = {
        "item_id": "p005-b002",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "source_text": "and nuclear attraction elements",
        "protected_source_text": "and nuclear attraction elements",
        "translation_context_before": "The matrix contains one-electron kinetic",
        "translation_context_after": "that are used to build the Fock operator.",
    }

    payload = build_item_context(item).as_batch_payload()

    assert payload["context_before"] == "仅供理解，禁止翻译进输出：The matrix contains one-electron kinetic"
    assert payload["context_after"] == "仅供理解，禁止翻译进输出：that are used to build the Fock operator."


def test_prompt_building_uses_translation_context_windows() -> None:
    from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages

    item = {
        "item_id": "p005-b002",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "source_text": "and nuclear attraction elements",
        "protected_source_text": "and nuclear attraction elements",
        "translation_context_before": "The matrix contains one-electron kinetic",
        "translation_context_after": "that are used to build the Fock operator.",
        "math_mode": "direct_typst",
    }

    messages = build_single_item_fallback_messages(
        item,
        domain_guidance="",
        mode="sci",
        response_style="plain_text",
    )

    user_content = messages[-1]["content"]
    assert "前文上下文（仅供理解，禁止翻译进输出）：The matrix contains one-electron kinetic" in user_content
    assert "当前原文是不完整片段；译文必须保持同等不完整，不要用后文上下文补全。" in user_content
    assert "后文上下文（仅供理解，禁止翻译进输出）：that are used to build the Fock operator." in user_content
