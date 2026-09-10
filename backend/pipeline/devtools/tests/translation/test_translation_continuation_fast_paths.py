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


class TranslationContinuationFastPathTests(unittest.TestCase):
    def setUp(self):
        # These cases test content recovery, not provider DNS warmup. Keep the
        # transport seam fake for every case, independent of DNS cache/order.
        prewarm = mock.patch("retainpdf_pipeline.translate.llm.providers.deepseek.client._prewarm_dns")
        prewarm.start()
        self.addCleanup(prewarm.stop)

    def test_continuation_group_protocol_shell_degrades_to_keep_origin(self):
        retry_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.plain_text_retry"
        )
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "__cg__:cg-028-037",
            "translation_unit_id": "__cg__:cg-028-037",
            "page_idx": 27,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "placeholder",
            "continuation_group": "cg-028-037",
            "translation_unit_protected_source_text": (
                "Among the conversion reactions containing nitrogen, the oxidation of nitric oxide (NO) "
                "has received extensive attention in photocatalysis based on theoretical investigations as well."
            ),
            "protected_source_text": (
                "Among the conversion reactions containing nitrogen, the oxidation of nitric oxide (NO) "
                "has received extensive attention in photocatalysis based on theoretical investigations as well."
            ),
        }

        with mock.patch.object(
            module,
            "translate_continuation_group_members",
            side_effect=module.TranslationProtocolError("__cg__:cg-028-037"),
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=module.TranslationProtocolError("__cg__:cg-028-037"),
        ), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=module.TranslationProtocolError("__cg__:cg-028-037"),
        ), mock.patch.object(
            module,
            "_sentence_level_fallback",
            side_effect=module.TranslationProtocolError("__cg__:cg-028-037"),
        ) as sentence_mock, mock.patch.object(retry_module, "time", wraps=retry_module.time) as retry_clock:
            # Exercise retries without waiting or patching the process-wide clock.
            retry_clock.sleep.return_value = None
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test",
                context=context,
                diagnostics=None,
            )

        payload = result["__cg__:cg-028-037"]
        sentence_mock.assert_not_called()
        self.assertEqual(retry_clock.sleep.call_args_list, [mock.call(2)])
        self.assertEqual(payload["decision"], "keep_origin")
        self.assertEqual(payload["final_status"], "kept_origin")
        self.assertEqual(
            payload["translation_diagnostics"]["degradation_reason"],
            "protocol_shell_repeated",
        )

    def test_continuation_group_prefers_structured_member_route(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "__cg__:cg-010-001",
            "translation_unit_id": "__cg__:cg-010-001",
            "translation_unit_member_ids": ["p010-b001", "p010-b002"],
            "page_idx": 10,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "placeholder",
            "continuation_group": "cg-010-001",
            "translation_unit_protected_source_text": "This sentence starts and continues.",
            "protected_source_text": "This sentence starts and continues.",
        }

        with mock.patch.object(
            module,
            "translate_continuation_group_members",
            return_value={
                "__cg__:cg-010-001": {
                    "decision": "translate",
                    "translated_text": "这句话开始并继续。",
                    "final_status": "translated",
                    "member_translations": [
                        {"item_id": "p010-b001", "translated_text": "这句话开始"},
                        {"item_id": "p010-b002", "translated_text": "并继续。"},
                    ],
                }
            },
        ) as group_mock, mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=AssertionError("legacy route should not run"),
        ):
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test",
                context=context,
                diagnostics=None,
            )

        payload = result["__cg__:cg-010-001"]
        group_mock.assert_called_once()
        self.assertEqual(payload["translated_text"], "这句话开始并继续。")
        self.assertEqual(payload["member_translations"][0]["item_id"], "p010-b001")
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "continuation_group_members"])
        self.assertEqual(payload["translation_diagnostics"]["output_mode_path"], ["json", "member_translations"])

    def test_abstract_aggregate_group_uses_one_full_text_translation(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "__cg__:abstract:p001-b015",
            "translation_unit_id": "__cg__:abstract:p001-b015",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["p001-b015", "p001-b019"],
            "translation_group_id": "abstract:p001-b015",
            "translation_group_kind": "abstract",
            "translation_group_strategy": "aggregate_geometry",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "abstract",
            "structure_role": "body",
            "math_mode": "placeholder",
            "protected_source_text": "The complete abstract is translated as one coherent passage.",
            "translation_unit_protected_source_text": (
                "The complete abstract is translated as one coherent passage."
            ),
        }
        aggregate_result = {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "完整摘要作为一段连贯文本进行翻译。",
                "final_status": "translated",
            }
        }

        with mock.patch.object(
            module,
            "translate_continuation_group_members",
            side_effect=AssertionError("abstract groups must not request member translations"),
        ) as group_mock, mock.patch.object(
            module,
            "translate_single_item_plain_text",
            return_value=aggregate_result,
        ) as plain_mock:
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test",
                context=context,
                diagnostics=None,
            )

        group_mock.assert_not_called()
        plain_mock.assert_called_once()
        self.assertEqual(result[item["item_id"]]["translated_text"], "完整摘要作为一段连贯文本进行翻译。")

    def test_direct_typst_continuation_group_protocol_shell_is_salvaged(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "__cg__:cg-007-003",
            "translation_unit_id": "__cg__:cg-007-003",
            "page_idx": 6,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "continuation_group": "cg-007-003",
            "translation_unit_protected_source_text": (
                "Anthropic and OpenAI: Conversely, the clear message was that the AI model providers were grabbing more enterprise wallet share."
            ),
            "protected_source_text": (
                "Anthropic and OpenAI: Conversely, the clear message was that the AI model providers were grabbing more enterprise wallet share."
            ),
        }
        protocol_exc = module.TranslationProtocolError(
            "__cg__:cg-007-003",
            translated_text=(
                '{"translations":[{"item_id":"__cg__:cg-007-003","translated_text":"Anthropic与OpenAI：相反，一个明确的信息是，AI模型提供商正在攫取更多的企业钱包份额。"}]}'
            ),
        )

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=protocol_exc), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=protocol_exc,
        ):
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["__cg__:cg-007-003"]
        self.assertEqual(payload["decision"], "translate")
        self.assertIn("Anthropic与OpenAI", payload["translated_text"])
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "protocol_shell_salvaged")

    def test_direct_typst_continuation_group_protocol_shell_partial_accepts_body_text(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        context_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        context = context_module.build_translation_control_context(mode="sci")
        item = {
            "item_id": "__cg__:cg-008-004",
            "translation_unit_id": "__cg__:cg-008-004",
            "page_idx": 7,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "math_mode": "direct_typst",
            "continuation_group": "cg-008-004",
            "translation_unit_protected_source_text": "COBOL Code Modernization: It was just one data point so we’re highlighting it last.",
            "protected_source_text": "COBOL Code Modernization: It was just one data point so we’re highlighting it last.",
        }
        protocol_exc = module.TranslationProtocolError(
            "__cg__:cg-008-004",
            translated_text=(
                '{"translations":[{"item_id":"wrong-id","translated_text":"COBOL代码现代化：这只是一个数据点，因此我们最后才重点提及。"}]}'
            ),
        )

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=protocol_exc), mock.patch.object(
            module,
            "translate_single_item_plain_text_unstructured",
            side_effect=protocol_exc,
        ), mock.patch.object(
            module,
            "validate_batch_result",
            side_effect=module.TranslationProtocolError(
                "__cg__:cg-008-004",
                translated_text="COBOL代码现代化：这只是一个数据点，因此我们最后才重点提及。",
            ),
        ):
            result = _translate_direct_typst_for_test(module, item, context=context)

        payload = result["__cg__:cg-008-004"]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "protocol_shell_partial_accept")

    def test_continuation_group_english_residue_does_not_enter_sentence_level_fallback(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "__cg__:cg-001-001",
            "translation_unit_id": "__cg__:cg-001-001",
            "page_idx": 0,
            "block_type": "text",
            "continuation_group": "cg-001-001",
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
        english_residue = module.EnglishResidueError(item["item_id"])

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

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")

    def test_continuation_group_english_residue_with_partial_chinese_is_salvaged(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "__cg__:cg-001-002",
            "translation_unit_id": "__cg__:cg-001-002",
            "page_idx": 0,
            "block_type": "text",
            "continuation_group": "cg-001-002",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This is the first sentence. This is the second sentence with reaction details.",
            "translation_unit_protected_source_text": "This is the first sentence. This is the second sentence with reaction details.",
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
        english_residue = module.EnglishResidueError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text="这是第一句话。This is the second sentence with reaction details.",
        )

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

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertIn("这是第一句话", payload["translated_text"])
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_partial_accept")
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "english_residue_salvage"])

    def test_continuation_group_english_residue_salvage_rejected_on_placeholder_mismatch(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        source_text = (
            "This is the first sentence <f1-abc/>. This is the second sentence with reaction details."
        )
        item = {
            "item_id": "__cg__:cg-001-003",
            "translation_unit_id": "__cg__:cg-001-003",
            "page_idx": 0,
            "block_type": "text",
            "continuation_group": "cg-001-003",
            "metadata": {"structure_role": "body"},
            "protected_source_text": source_text,
            "translation_unit_protected_source_text": source_text,
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
        # Same partial-Chinese English-residue shape as the salvage-accepted test
        # above, except the formula placeholder present in the source was dropped
        # from the translated output. The salvage must reject this rather than
        # ship a block whose formula placeholder inventory no longer matches the
        # source (which would corrupt formula restoration downstream).
        english_residue = module.EnglishResidueError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text="这是第一句话。This is the second sentence with reaction details.",
        )

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

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertEqual(payload["translated_text"], "")
        self.assertEqual(payload["final_status"], "failed")
        self.assertEqual(payload["translation_diagnostics"]["degradation_reason"], "english_residue_repeated")
        self.assertEqual(
            payload["translation_diagnostics"]["error_trace"],
            [{"type": "validation", "code": "ENGLISH_RESIDUE"}],
        )

    def test_protocol_shell_unwrap_salvages_continuation_group_without_sentence_fallback(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "__cg__:cg-005-007",
            "translation_unit_id": "__cg__:cg-005-007",
            "page_idx": 4,
            "block_type": "text",
            "continuation_group": "cg-005-007",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "Orbital interactions provide only one of several factors. The transition state is significantly stabilized by electrostatic interactions.",
            "translation_unit_protected_source_text": "Orbital interactions provide only one of several factors. The transition state is significantly stabilized by electrostatic interactions.",
        }
        context = control_context.build_translation_control_context(mode="sci")
        shell_exc = module.TranslationProtocolError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text='{"translations":[{"item_id":"__cg__:cg-005-007","translated_text":"轨道相互作用仅是若干因素之一。该反应的过渡态因静电相互作用而显著稳定。"}]}',
        )

        with mock.patch.object(module, "translate_single_item_plain_text", side_effect=shell_exc):
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

        payload = result[item["item_id"]]
        self.assertEqual(payload["decision"], "translate")
        self.assertIn("轨道相互作用仅是若干因素之一", payload["translated_text"])
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level", "protocol_shell_unwrap"])

    def test_continuation_group_with_placeholders_uses_plain_path_first(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks"
        )
        control_context = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context"
        )
        item = {
            "item_id": "__cg__:cg-009-013",
            "translation_unit_id": "__cg__:cg-009-013",
            "page_idx": 8,
            "block_type": "text",
            "continuation_group": "cg-009-013",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "This continuation group mentions <f1-c1b/> and <f2-a77/> inside a long body paragraph.",
            "translation_unit_protected_source_text": "This continuation group mentions <f1-c1b/> and <f2-a77/> inside a long body paragraph.",
            "formula_map": [{"placeholder": "<f1-c1b/>"}, {"placeholder": "<f2-a77/>"}],
            "translation_unit_formula_map": [{"placeholder": "<f1-c1b/>"}, {"placeholder": "<f2-a77/>"}],
        }
        context = control_context.build_translation_control_context(mode="sci")

        with mock.patch.object(
            module,
            "translate_single_item_stable_placeholder_text",
            side_effect=AssertionError("tagged-first should not run"),
        ) as tagged_mock:
            with mock.patch.object(module, "translate_single_item_plain_text") as plain_mock:
                plain_mock.return_value = {
                    item["item_id"]: {
                        "decision": "translate",
                        "translated_text": "该连续段落提到 <f1-c1b/> 与 <f2-a77/>。",
                        "final_status": "translated",
                    }
                }
                result = module.translate_single_item_plain_text_with_retries(
                    item,
                    api_key="",
                    model="deepseek-chat",
                    base_url="https://api.deepseek.com/v1",
                    request_label="test",
                    context=context,
                    diagnostics=None,
                )
        tagged_mock.assert_not_called()
        plain_mock.assert_called_once()
        payload = result[item["item_id"]]
        self.assertEqual(payload["translation_diagnostics"]["route_path"], ["block_level"])
        self.assertEqual(payload["translation_diagnostics"]["output_mode_path"], ["plain_text"])

if __name__ == "__main__":
    unittest.main()
