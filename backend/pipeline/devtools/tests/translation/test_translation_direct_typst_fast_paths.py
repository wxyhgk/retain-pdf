import unittest
from dataclasses import replace
from importlib import import_module
from unittest import mock


def _translate_direct_typst_for_test(module, item: dict, *, context, request_label: str = "test"):
    direct_typst = import_module(
        "retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst"
    )
    return direct_typst.translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label=request_label,
        context=context,
        diagnostics=None,
        translator=module.translate_single_item_plain_text_with_retries,
        translate_plain_fn=module.translate_single_item_plain_text,
        translate_unstructured_fn=module.translate_single_item_plain_text_unstructured,
        sentence_level_fallback_fn=module._sentence_level_fallback,
        validate_batch_result_fn=module.validate_batch_result,
    )


class TranslationDirectTypstFastPathTests(unittest.TestCase):
    def setUp(self):
        # Content/windowing tests replace the remote translator, including its
        # ancillary DNS warmup; DNS behavior has dedicated transport tests.
        prewarm = mock.patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns")
        prewarm.start()
        self.addCleanup(prewarm.stop)

    def test_direct_typst_protocol_shell_degrades_for_cjk_body_text(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "p036-b015",
            "page_idx": 35,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "translation_unit_protected_source_text": (
                "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
            ),
            "protected_source_text": (
                "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
            ),
        }

        protocol_exc = module.TranslationProtocolError(
            "p036-b015",
            translated_text='{"translations":[{"item_id":"p036-b015","translated_text":"综上，本文系统综述了DFT计算在光催化领域中的广泛应用。"}]}',
        )
        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=protocol_exc,
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=protocol_exc,
        ):
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["p036-b015"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["final_status"], "translated")
        self.assertEqual(
            payload["translation_diagnostics"]["degradation_reason"],
            "protocol_shell_salvaged",
        )

    def test_direct_typst_short_empty_translation_uses_short_retry(self):
        retry_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst"
        )
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        short_retry_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.short_text_retry"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "p020-b012",
            "page_idx": 19,
            "block_type": "text",
            "block_kind": "text",
            "raw_block_type": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "translation_unit_protected_source_text": "We need only to diagonalize the matrix $ F' $",
            "protected_source_text": "We need only to diagonalize the matrix $ F' $",
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=module.EmptyTranslationError("p020-b012"),
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=module.EmptyTranslationError("p020-b012"),
        ), mock.patch.object(
            short_retry_module.provider_runtime,
            "request_chat_content",
            return_value="我们只需要对角化矩阵 $ F' $",
        ), mock.patch.object(retry_module, "time", wraps=retry_module.time) as retry_clock:
            # Keep the retry path and record its backoff without real sleeping.
            retry_clock.sleep.return_value = None
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["p020-b012"]
        self.assertEqual(retry_clock.sleep.call_args_list, [mock.call(2)])
        self.assertEqual(payload["translated_text"], "我们只需要对角化矩阵 $ F' $")
        self.assertEqual(payload["final_status"], "translated")
        self.assertEqual(
            payload["translation_diagnostics"]["degradation_reason"],
            "empty_translation_short_text_retry",
        )

    def test_direct_typst_long_text_is_split_before_remote_translation(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        long_source = " ".join(f"This is sentence {i} describing a long legal disclaimer." for i in range(1, 180))
        item = {
            "item_id": "__cg__:cg-long-001",
            "translation_unit_id": "__cg__:cg-long-001",
            "page_idx": 17,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "continuation_group": "cg-long-001",
            "translation_unit_protected_source_text": long_source,
            "protected_source_text": long_source,
        }

        def _fake_plain_text(chunk_item, **_kwargs):
            text = str(chunk_item.get("translation_unit_protected_source_text", "") or "")
            return {
                chunk_item["item_id"]: {
                    "decision": "translate",
                    "translated_text": f"已翻译:{text[:24]}",
                    "final_status": "translated",
                }
            }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=_fake_plain_text) as plain_mock:
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertGreater(plain_mock.call_count, 1)
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "direct_typst", "long_text_split"])

    def test_formula_english_residue_marks_failed_after_all_fallbacks_fail(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "p009-b067",
            "page_idx": 8,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "Olefins offer the unique benefit of starting from prochiral <f1-8fa/> carbons.",
            "translation_unit_protected_source_text": "Olefins offer the unique benefit of starting from prochiral <f1-8fa/> carbons.",
            "formula_map": [{"placeholder": "<f1-8fa/>"}],
            "translation_unit_formula_map": [{"placeholder": "<f1-8fa/>"}],
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )

        english_residue = module.EnglishResidueError("p009-b067")
        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", side_effect=english_residue):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )
        payload = result["p009-b067"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")

    def test_english_residue_after_raw_fallback_continues_to_sentence_level(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is the first sentence. This is the second sentence.",
            "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")
        sentence_payload = {
            "p001-b002": {
                "decision": "translate",
                "translated_text": "这是第一句。 第二句保留原文。",
                "final_status": "partially_translated",
            }
        }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", return_value=sentence_payload) as sentence_mock:
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )
        self.assertEqual(result, sentence_payload)
        sentence_mock.assert_called_once()

    def test_direct_typst_english_residue_does_not_enter_sentence_level_fallback(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is the first sentence. This is the second sentence.",
            "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "_sentence_level_fallback", side_effect=AssertionError("should not be called")):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        payload = result["p001-b002"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "direct_typst", "failed"])

    def test_direct_typst_body_protocol_failure_falls_back_to_sentence_level(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "p021-b005",
            "page_idx": 20,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "Conventional Context Parallelism partitions the sequence dimension, with each rank "
                "maintaining contiguous s tokens. This introduces two challenges to our compressed "
                "attention mechanisms."
            ),
            "translation_unit_protected_source_text": (
                "Conventional Context Parallelism partitions the sequence dimension, with each rank "
                "maintaining contiguous s tokens. This introduces two challenges to our compressed "
                "attention mechanisms."
            ),
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=False,
            ),
        )
        protocol_error = module.TranslationProtocolError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text='{"translated_text": ""}',
        )
        sentence_payload = {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "传统上下文并行将序列维度进行划分。",
                "final_status": "partially_translated",
                "translation_diagnostics": {
                    "route_path": ["block_level", "sentence_level"],
                    "fallback_to": "sentence_level",
                },
            }
        }

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=protocol_error):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=protocol_error):
                with mock.patch.object(module, "_sentence_level_fallback", return_value=sentence_payload) as sentence_mock:
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        sentence_mock.assert_called_once()
        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["final_status"], "partially_translated")
        self.assertIn("传统上下文并行", payload["translated_text"])

    def test_direct_typst_validation_failure_does_not_enter_tagged_placeholder_retry(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is body text with inline math x.",
            "translation_unit_protected_source_text": "This is body text with inline math x.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        context = replace(
            context,
            fallback_policy=replace(
                context.fallback_policy,
                plain_text_attempts=1,
                allow_tagged_placeholder_retry=True,
            ),
        )
        english_residue = module.EnglishResidueError("p001-b002")

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=english_residue):
            with mock.patch.object(module, "translate_single_item_plain_text_unstructured", side_effect=english_residue):
                with mock.patch.object(module, "translate_single_item_stable_placeholder_text", side_effect=AssertionError("should not be called")):
                    result = module.translate_single_item_plain_text_with_retries(
                        item,
                        api_key="",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test",
                        context=context,
                        diagnostics=None,
                    )

        self.assertEqual(result["p001-b002"]["decision"], "keep_origin")



def test_long_text_split_partially_accepts_when_one_chunk_fails() -> None:
    from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
    from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_long_text import (
        translate_direct_typst_long_text_chunks,
    )

    sentence = "This is a long body sentence describing the experimental protocol in detail. "
    source = sentence * 70  # ~5500 字符,切成多块
    item = {
        "item_id": "p001-b001",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    calls = {"n": 0}

    def _translator(chunk_item, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("transient failure")
        return {chunk_item["item_id"]: {"decision": "translate", "translated_text": f"译文块{calls['n']}"}}

    result = translate_direct_typst_long_text_chunks(
        item,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="",
        context=build_translation_control_context(),
        diagnostics=None,
        translator=_translator,
    )
    assert result is not None
    payload = result["p001-b001"]
    diag = payload["translation_diagnostics"]
    # 单块失败不再作废整条:失败块保留原文,其余块保留译文
    assert diag["final_status"] == "partially_translated"
    assert diag["degradation_reason"] == "direct_typst_long_text_split_partial"
    assert diag["degraded_chunk_count"] == 1
    assert "译文块1" in payload["translated_text"]
    assert sentence.strip() in payload["translated_text"]


def test_long_text_split_still_fails_when_all_chunks_fail() -> None:
    from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
    from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_long_text import (
        translate_direct_typst_long_text_chunks,
    )

    sentence = "Another long body sentence describing the computational details thoroughly. "
    source = sentence * 70
    item = {
        "item_id": "p001-b002",
        "protected_source_text": source,
        "translation_unit_protected_source_text": source,
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }

    def _translator(chunk_item, **_kwargs):
        raise RuntimeError("hard failure")

    result = translate_direct_typst_long_text_chunks(
        item,
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="",
        context=build_translation_control_context(),
        diagnostics=None,
        translator=_translator,
    )
    payload = result["p001-b002"]
    assert payload["translation_diagnostics"]["degradation_reason"] == "direct_typst_long_text_split_chunk_failed"
