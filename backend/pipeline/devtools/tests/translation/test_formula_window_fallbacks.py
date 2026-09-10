import json
import sys
import unittest
import time
from types import SimpleNamespace
from unittest.mock import Mock, patch
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

class FormulaWindowFallbacksTests(unittest.TestCase):
    def test_single_segmented_failure_falls_back_to_plain_text(self):
        module = load_retrying_translator()
        import retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks as fallbacks
        from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context

        item = make_fragmented_formula_item()
        calls: list[str] = []

        def fake_single(*args, **kwargs):
            calls.append("single")
            raise ValueError("single failed")

        def fake_plain(*args, **kwargs):
            calls.append("plain")
            return {item["item_id"]: result_entry("translate", "普通结果 [[FORMULA_1]]")}

        original_single = fallbacks.translate_single_item_formula_segment_text_with_retries
        original_plain = fallbacks.translate_single_item_plain_text
        try:
            fallbacks.translate_single_item_formula_segment_text_with_retries = fake_single
            fallbacks.translate_single_item_plain_text = fake_plain
            result = fallbacks.translate_single_item_plain_text_with_retries(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="unit",
                context=build_translation_control_context(mode="sci"),
                diagnostics=None,
            )
        finally:
            fallbacks.translate_single_item_formula_segment_text_with_retries = original_single
            fallbacks.translate_single_item_plain_text = original_plain

        self.assertEqual(calls, ["single", "plain"])
        self.assertEqual(result[item["item_id"]]["decision"], "translate")

    def test_windowed_formula_translation_failed_window_marks_block_failed(self):
        load_retrying_translator()
        import retainpdf_pipeline.translate.llm.providers.deepseek.client as deepseek_client
        import retainpdf_pipeline.translate.llm.shared.orchestration.segment_routing as segment_routing
        import retainpdf_pipeline.translate.llm.shared.orchestration.segment_windows as segment_windows

        sleep = Mock()
        self.enterContext(patch.object(segment_windows, "time", SimpleNamespace(perf_counter=time.perf_counter, sleep=sleep)))

        item = make_formula_item(20)
        calls: list[list[str]] = []

        def fake_request(messages, **kwargs):
            payload = json.loads(messages[-1]["content"])
            segment_ids = [segment["segment_id"] for segment in payload["segments"]]
            calls.append(segment_ids)
            if segment_ids[0] == "9":
                return "\n".join(
                    f"<<<SEG id={segment['segment_id']}>>>\n中文片段{segment['segment_id']}\n<<<END>>>"
                    for segment in payload["segments"][:-1]
                )
            return "\n".join(
                f"<<<SEG id={segment['segment_id']}>>>\n中文片段{segment['segment_id']}\n<<<END>>>"
                for segment in payload["segments"]
            )

        original_request = segment_routing.request_chat_content
        original_deepseek_request = deepseek_client.request_chat_content
        try:
            segment_routing.request_chat_content = fake_request
            deepseek_client.request_chat_content = fake_request
            result = segment_routing.translate_single_item_formula_segment_windows_with_retries(item, request_label="unit")
        finally:
            segment_routing.request_chat_content = original_request
            deepseek_client.request_chat_content = original_deepseek_request

        # Each of four failed attempts tries tagged output and then JSON.
        self.assertEqual([ids[0] for ids in calls], ["1"] + ["9"] * 8)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [2, 4, 6])
        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "formula_window_translation_failed")
        self.assertEqual(payload["translation_diagnostics"]["segment_range"], "9-16")
