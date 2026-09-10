import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.shared.orchestration import segment_routing


def _formula_item(formula_count: int) -> dict:
    parts = []
    for index in range(1, formula_count + 1):
        parts.append(f"clause {index} explaining the result")
        parts.append(f"[[FORMULA_{index}]]")
    parts.append("final discussion sentence")
    source = " ".join(parts)
    return {
        "item_id": f"formula-{formula_count}",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def _small_formula_inline_item() -> dict:
    source = (
        "The work function <f1-6a9/> which is also abbreviated as <f2-ef6/> "
        "of a catalyst can be defined as the minimum energy required to extract one electron."
    )
    return {
        "item_id": "small-inline-1",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def _fragmented_formula_item(formula_count: int = 5) -> dict:
    parts = []
    for index in range(1, formula_count + 1):
        parts.append(f"the catalyst <f{index}-a7c/> and")
    parts.append("shows stable activity in experiments.")
    source = " ".join(parts)
    return {
        "item_id": f"fragmented-{formula_count}",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def _prose_heavy_formula_item() -> dict:
    source = (
        "This discussion explains the catalytic pathway in prose and compares several prior studies while keeping "
        "only a few inline markers such as <f1-a7c/>, <f2-b2d/>, and <f3-c3e/> for notation. "
        "The surrounding paragraph remains long, narrative, and context heavy so the model should usually translate "
        "it as a normal body block instead of entering segmented formula mode."
    )
    return {
        "item_id": "prose-heavy-formula-1",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def _formula_dense_prose_item() -> dict:
    source = (
        "For the diffusion process, the transition matrix <f1-a11/> governs how tokens evolve in each step, "
        "while the marginal probability <f2-b22/> controls the expected corruption level. "
        "The hidden state <f3-c33/> is then related to the masking distribution <f4-d44/>, "
        "and the posterior estimator <f5-e55/> is combined with the score term <f6-f66/> to stabilize training. "
        "Although these markers appear frequently, the paragraph is still ordinary explanatory prose rather than a pure formula block."
    )
    return {
        "item_id": "formula-dense-prose-1",
        "block_type": "text",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "formula_map": {"dummy": "dummy"},
    }


def test_formula_segment_messages_default_to_tagged_protocol() -> None:
    item = _formula_item(2)
    skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
    messages = segment_routing.build_formula_segment_messages(item, skeleton, segments)

    assert "<<<SEG id=1>>>" in messages[0]["content"]
    assert '{"segments"' not in messages[0]["content"]


def test_long_formula_block_stays_plain_route() -> None:
    item = _formula_item(20)
    assert segment_routing.formula_segment_translation_route(item) == "none"


def test_small_formula_inline_stays_plain_route() -> None:
    item = _small_formula_inline_item()
    assert segment_routing.formula_segment_translation_route(item) == "none"


def test_small_formula_inline_uses_risk_score_not_single_phrase_only() -> None:
    source = (
        "The parameter <f1-a7c/> is expressed as <f2-b2d/> "
        "and can be used to describe the catalyst surface."
    )

    assert segment_routing.small_formula_risk_score(source) >= 4


def test_fragmented_formula_segments_can_use_segmented_route_when_risk_threshold_is_met() -> None:
    item = _fragmented_formula_item()
    skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])

    assert len(segments) > 4
    assert segment_routing.effective_formula_segment_count(segments) <= 4
    assert segment_routing.formula_segment_translation_route(item) == "single"


def test_prose_heavy_low_density_formula_block_prefers_plain_route() -> None:
    item = _prose_heavy_formula_item()
    assert segment_routing.formula_segment_translation_route(item) == "none"


def test_formula_dense_prose_prefers_plain_route() -> None:
    item = _formula_dense_prose_item()
    assert segment_routing.formula_segment_translation_route(item) == "none"


def test_real_short_words_are_not_dropped_as_micro_segments() -> None:
    assert not segment_routing.is_micro_formula_segment("Information")
    assert not segment_routing.is_micro_formula_segment("energy")
    assert segment_routing.is_micro_formula_segment("of")


def test_segment_parser_rejects_empty_connector_segment() -> None:
    expected_segments = [
        {"segment_id": "1", "source_text": "Transfer of a proton and an electron would lead to isobutyronitrile"},
        {"segment_id": "2", "source_text": "by"},
        {"segment_id": "3", "source_text": "NMR spectroscopy, and the main product is the radical homocoupling product"},
    ]
    content = json.dumps(
        {
            "segments": [
                {"segment_id": "1", "translated_text": "转移一个质子和一个电子会生成异丁腈"},
                {"segment_id": "2", "translated_text": ""},
                {"segment_id": "3", "translated_text": "通过核磁共振波谱检测，主要产物是自由基均偶联产物"},
            ]
        },
        ensure_ascii=False,
    )

    try:
        segment_routing.parse_segment_translation_payload(content, expected_segments=expected_segments)
    except segment_routing.SegmentTranslationSemanticError:
        return
    raise AssertionError("empty connector segment should be rejected")


def test_segment_parser_rejects_empty_of_segment() -> None:
    expected_segments = [{"segment_id": "1", "source_text": "of"}]
    content = json.dumps({"segments": [{"segment_id": "1", "translated_text": ""}]}, ensure_ascii=False)

    try:
        segment_routing.parse_segment_translation_payload(content, expected_segments=expected_segments)
    except segment_routing.SegmentTranslationSemanticError:
        return
    raise AssertionError("empty 'of' segment should be rejected")


def test_segment_parser_rejects_empty_non_connector_segment() -> None:
    expected_segments = [
        {"segment_id": "1", "source_text": "Experimentally Testing Concerted versus Stepwise PCET to a Model Alkyl Radical"},
    ]
    content = json.dumps({"segments": [{"segment_id": "1", "translated_text": ""}]}, ensure_ascii=False)

    try:
        segment_routing.parse_segment_translation_payload(content, expected_segments=expected_segments)
    except segment_routing.SegmentTranslationFormatError:
        return
    raise AssertionError("empty non-connector segment should be rejected")


def test_segment_translation_requests_tagged_then_json_fallback() -> None:
    item = _formula_item(2)
    skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
    seen = []

    def fake_request(messages, **kwargs):
        seen.append(kwargs.get("response_format"))
        if kwargs.get("response_format") is None:
            return "bad tagged payload"
        return json.dumps(
            {
                "segments": [
                    {"segment_id": segment["segment_id"], "translated_text": f"片段{segment['segment_id']}"}
                    for segment in segments
                ]
            },
            ensure_ascii=False,
        )

    original_request = segment_routing.request_chat_content
    try:
        segment_routing.request_chat_content = fake_request
        translated = segment_routing._request_formula_segment_translation(
            item,
            skeleton,
            segments,
            api_key="",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            domain_guidance="",
            timeout_s=30,
            request_label="unit",
        )
    finally:
        segment_routing.request_chat_content = original_request

    assert seen[0] is None
    assert seen[1] is not None
    assert set(translated) == {segment["segment_id"] for segment in segments}


def test_segment_translation_skips_json_fallback_on_semantic_tagged_failure() -> None:
    item = _formula_item(2)
    skeleton, segments = segment_routing.build_formula_segment_plan(item["translation_unit_protected_source_text"])
    seen = []

    def fake_request(messages, **kwargs):
        seen.append(kwargs.get("response_format"))
        return "\n".join(
            [
                "<<<SEG id=1>>>",
                "",
                "<<<END>>>",
                "<<<SEG id=2>>>",
                "片段2",
                "<<<END>>>",
                "<<<SEG id=3>>>",
                "片段3",
                "<<<END>>>",
            ]
        )

    original_request = segment_routing.request_chat_content
    try:
        segment_routing.request_chat_content = fake_request
        try:
            segment_routing._request_formula_segment_translation(
                item,
                skeleton,
                segments,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                domain_guidance="",
                timeout_s=30,
                request_label="unit",
            )
        except segment_routing.SegmentTranslationSemanticError:
            pass
        else:
            raise AssertionError("semantic tagged failure should not fall back to JSON")
    finally:
        segment_routing.request_chat_content = original_request

    assert seen == [None]
