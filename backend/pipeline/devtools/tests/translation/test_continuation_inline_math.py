from retainpdf_pipeline.translate.services.continuation import state

from continuation_test_support import payload_item as _payload_item


def test_chunk_source_text_fallback_keeps_inline_math_atomic() -> None:
    from retainpdf_pipeline.translate.llm.shared.orchestration.common import chunk_source_text_fallback

    text = "h mode i of the excitation spectrum can be characterized by its dispersion relation $\\omega_i(Q)$ and lifetime $\\tau$."
    chunks = chunk_source_text_fallback(text, words_per_chunk=5)

    assert any("$\\omega_i(Q)$" in chunk for chunk in chunks)
    assert not any(chunk.endswith("$\\omega_i(Q)") or chunk.startswith("\\omega_i(Q)$") for chunk in chunks)


def test_group_translation_split_keeps_inline_math_atomic() -> None:
    from retainpdf_pipeline.translate.core.payload.parts.apply import _split_group_protected_translation

    items = [
        {"protected_source_text": "prev part"},
        {"protected_source_text": "next part"},
    ]
    translated = "激发谱的每个模式 i 可由其色散关系 $\\omega^i(\\mathbf{Q})$、寿命 $\\tau_{\\mathrm{SW}}^i$ 和强度 I_0 表征。"
    chunks = _split_group_protected_translation(translated, items)

    assert len(chunks) == 2
    assert sum("$\\omega^i(\\mathbf{Q})$" in chunk for chunk in chunks) == 1
    assert all(chunk.count("$") % 2 == 0 for chunk in chunks if chunk)


def test_unbalanced_inline_math_blocks_do_not_join_across_pages() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="The objective function is $a",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-math",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="+b $ and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-math",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == ""
    assert payload[1]["continuation_decision"] == ""
    assert payload[0]["continuation_group"] == ""
    assert payload[1]["continuation_group"] == ""

