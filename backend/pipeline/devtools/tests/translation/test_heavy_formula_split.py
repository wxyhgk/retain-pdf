import json
import sys
import unittest
from dataclasses import replace
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.shared.orchestration.heavy_formula import heavy_formula_split_reason
from retainpdf_pipeline.translate.llm.shared.orchestration.heavy_formula import translate_heavy_formula_block
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import should_store_translation_result
from retainpdf_pipeline.translate.llm.shared.orchestration.sentence_level import sentence_level_fallback
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import DeferredTransportRetry


from retrying_translator_test_support import load_retrying_translator


def make_formula_item(formula_count: int) -> dict:
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


def make_small_formula_inline_item() -> dict:
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


def make_fragmented_formula_item(formula_count: int = 5) -> dict:
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


def make_prose_heavy_formula_item() -> dict:
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


def make_formula_dense_prose_item() -> dict:
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

class HeavyFormulaSplitTests(unittest.TestCase):
    def test_heavy_formula_split_skips_formula_dense_prose_blocks(self):
        load_retrying_translator()
        from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context

        item = make_formula_dense_prose_item()
        expanded = item["translation_unit_protected_source_text"] + " " + item["translation_unit_protected_source_text"] + " " + item["translation_unit_protected_source_text"]
        item["protected_source_text"] = expanded
        item["translation_unit_protected_source_text"] = expanded

        self.assertEqual(
            heavy_formula_split_reason(
                item,
                context=build_translation_control_context(mode="sci"),
            ),
            "",
        )

    def test_heavy_formula_block_is_split_before_windowed_route(self):
        load_retrying_translator()
        from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context

        item = {
            "item_id": "heavy-formula-1",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "translation_unit_protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "protected_map": [{"token_tag": f"<f{i}-a7c/>", "token_type": "formula", "checksum": "a7c"} for i in range(1, 17)],
            "formula_map": [{"placeholder": f"<f{i}-a7c/>"} for i in range(1, 17)],
        }
        seen_chunks: list[str] = []

        def fake_translate(chunk_item, **kwargs):
            seen_chunks.append(chunk_item["translation_unit_protected_source_text"])
            return {item["item_id"]: result_entry("translate", f"已翻译块{len(seen_chunks)}")}

        result = translate_heavy_formula_block(
            item,
            api_key="",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            request_label="unit",
            context=build_translation_control_context(),
            diagnostics=None,
            split_reason="heavy_formula_segment_count",
            translate_single_item_fn=fake_translate,
            deferred_transport_retry_type=DeferredTransportRetry,
        )

        self.assertIsNotNone(result)
        self.assertGreater(len(seen_chunks), 1)
        self.assertEqual(result[item["item_id"]]["translated_text"], "已翻译块1 已翻译块2")

    def test_heavy_formula_split_empty_chunk_marks_block_failed(self):
        load_retrying_translator()
        from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context

        item = {
            "item_id": "heavy-formula-empty-1",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "translation_unit_protected_source_text": (
                "Sentence one <f1-a7c/> explains the first case. "
                "Sentence two <f2-b2d/> compares the second case. "
                "Sentence three <f3-c3e/> links another conclusion. "
                "Sentence four <f4-d4f/> extends the argument. "
                "Sentence five <f5-e5a/> adds evidence. "
                "Sentence six <f6-f6b/> adds evidence. "
                "Sentence seven <f7-a1b/> adds evidence. "
                "Sentence eight <f8-b1c/> adds evidence. "
                "Sentence nine <f9-c1d/> adds evidence. "
                "Sentence ten <f10-d1e/> adds evidence. "
                "Sentence eleven <f11-e1f/> adds evidence. "
                "Sentence twelve <f12-f1a/> adds evidence. "
                "Sentence thirteen <f13-a2b/> adds evidence. "
                "Sentence fourteen <f14-b2c/> adds evidence. "
                "Sentence fifteen <f15-c2d/> adds evidence. "
                "Sentence sixteen <f16-d2e/> closes the section."
            ),
            "protected_map": [{"token_tag": f"<f{i}-a7c/>", "token_type": "formula", "checksum": "a7c"} for i in range(1, 17)],
            "formula_map": [{"placeholder": f"<f{i}-a7c/>"} for i in range(1, 17)],
        }
        seen_chunks: list[str] = []

        def fake_translate(chunk_item, **kwargs):
            seen_chunks.append(chunk_item["translation_unit_protected_source_text"])
            if len(seen_chunks) == 2:
                return {item["item_id"]: result_entry("translate", "")}
            return {item["item_id"]: result_entry("translate", f"已翻译块{len(seen_chunks)}")}

        result = translate_heavy_formula_block(
            item,
            api_key="",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            request_label="unit",
            context=build_translation_control_context(),
            diagnostics=None,
            split_reason="heavy_formula_segment_count",
            translate_single_item_fn=fake_translate,
            deferred_transport_retry_type=DeferredTransportRetry,
        )

        self.assertIsNotNone(result)
        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degraded_chunk_count"], 1)
        self.assertEqual(payload["translation_diagnostics"]["fallback_to"], "retry_required")
        self.assertNotIn("Sentence", payload["translated_text"])
