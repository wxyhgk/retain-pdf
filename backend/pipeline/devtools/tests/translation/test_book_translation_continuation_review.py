import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.continuation.orchestrator import review_candidate_continuation_pairs


def test_continuation_review_uses_default_wide_batches(monkeypatch) -> None:
    page_payloads = {0: []}
    for index in range(14):
        page_payloads[0].append(
            {
                "item_id": f"p001-b{index:03d}",
                "page_idx": 0,
                "block_idx": index,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [0, index * 20, 200, index * 20 + 12],
                "source_text": f"Continuation fragment {index}",
                "protected_source_text": f"Continuation fragment {index}",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "single",
                "layout_zone": "single_column",
                "layout_boundary_role": "tail" if index % 2 == 0 else "head",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": f"p001-b{index:03d}",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": [f"p001-b{index:03d}"],
                "translation_unit_protected_source_text": f"Continuation fragment {index}",
                "translation_unit_formula_map": [],
            }
        )

    fake_pairs = [
        {"prev_item_id": f"p001-b{index:03d}", "next_item_id": f"p001-b{index + 1:03d}"}
        for index in range(13)
    ]
    batch_sizes: list[int] = []

    monkeypatch.setattr(
        "retainpdf_pipeline.translate.services.continuation.orchestrator.candidate_continuation_pairs",
        lambda _payload: fake_pairs,
    )
    monkeypatch.setattr(
        "retainpdf_pipeline.translate.services.continuation.orchestrator.pair_join_score",
        lambda _prev, _next: 0,
    )
    monkeypatch.setattr(
        "retainpdf_pipeline.translate.services.continuation.orchestrator.pair_break_score",
        lambda _prev, _next: 0,
    )

    def _fake_review(batch_pairs, **_kwargs):
        batch_sizes.append(len(batch_pairs))
        return {pair["pair_id"]: "break" for pair in batch_pairs}

    monkeypatch.setattr(
        "retainpdf_pipeline.translate.services.continuation.orchestrator.review_candidate_pairs",
        _fake_review,
    )

    review_candidate_continuation_pairs(
        page_payloads=page_payloads,
        translation_paths={},
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        workers=4,
        save_pages_fn=lambda *_args, **_kwargs: None,
        request_chat_content_fn=lambda *_args, **_kwargs: "{}",
    )

    assert batch_sizes == [13]


def test_continuation_review_keeps_cross_page_middle_landing() -> None:
    page_payloads = {
        0: [
            {
                "item_id": "p011-b014",
                "page_idx": 10,
                "block_idx": 14,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [320, 650, 560, 730],
                "source_text": "The paragraph continues with",
                "protected_source_text": "The paragraph continues with",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_zone": "right_column",
                "layout_boundary_role": "tail",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "candidate_break",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "p012-b006",
            }
        ],
        1: [
            {
                "item_id": "p012-b006",
                "page_idx": 11,
                "block_idx": 6,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [60, 260, 300, 320],
                "source_text": "term. In fact, this is a later paragraph.",
                "protected_source_text": "term. In fact, this is a later paragraph.",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_zone": "left_column",
                "layout_boundary_role": "middle",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "candidate_break",
                "continuation_candidate_prev_id": "p011-b014",
                "continuation_candidate_next_id": "",
            }
        ],
    }

    applied = review_candidate_continuation_pairs(
        page_payloads=page_payloads,
        translation_paths={},
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        workers=1,
        save_pages_fn=lambda *_args, **_kwargs: None,
        request_chat_content_fn=lambda *_args, **_kwargs: "{}",
    )

    assert applied == 2
