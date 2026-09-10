from importlib import import_module
import requests
import unittest
from unittest import mock


class TranslationTransportFallbackTests(unittest.TestCase):
    def test_single_item_transport_failure_marks_failed(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
        )
        control_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context",
        )
        context = control_module.build_translation_control_context()
        item = {
            "item_id": "p001-b002",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "protected_source_text": "The advancement of complex computer programs with faster computing power remains important.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs with faster computing power remains important.",
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=requests.ConnectionError("Read timed out"),
        ):
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="sk-test",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test transport",
                context=context,
            )

        self.assertEqual(result["p001-b002"]["decision"], "translate")
        self.assertEqual(result["p001-b002"]["final_status"], "failed")
        self.assertEqual(result["p001-b002"]["error_taxonomy"], "transport")
        self.assertEqual(
            result["p001-b002"]["translation_diagnostics"]["route_path"],
            ["block_level", "plain_text", "failed"],
        )

    def test_direct_typst_body_transport_failure_marks_failed_without_inline_sentence_fallback(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
        )
        control_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context",
        )
        context = control_module.build_translation_control_context()
        item = {
            "item_id": "p006-b001",
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "In amino coumarins, enhancing the nitrogen donation ability also leads to a red-shift "
                "in fluorescence. Formation of heterocycle 9 improves hyperconjugation."
            ),
            "translation_unit_protected_source_text": (
                "In amino coumarins, enhancing the nitrogen donation ability also leads to a red-shift "
                "in fluorescence. Formation of heterocycle 9 improves hyperconjugation."
            ),
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=requests.ConnectionError("Read timed out"),
        ), mock.patch.object(module, "_sentence_level_fallback") as sentence_fallback:
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="sk-test",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test direct typst transport",
                context=context,
            )

        sentence_fallback.assert_not_called()
        self.assertEqual(result["p006-b001"]["decision"], "translate")
        self.assertEqual(result["p006-b001"]["final_status"], "failed")
        self.assertEqual(result["p006-b001"]["error_taxonomy"], "transport")

    def test_direct_typst_transport_failure_does_not_run_sentence_level_degrade_path(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
        )
        control_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context",
        )
        context = control_module.build_translation_control_context()
        item = {
            "item_id": "p006-b002",
            "block_type": "text",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "protected_source_text": (
                "This direct typst body paragraph has enough English prose to be force translated "
                "even when the transport layer is unstable."
            ),
            "translation_unit_protected_source_text": (
                "This direct typst body paragraph has enough English prose to be force translated "
                "even when the transport layer is unstable."
            ),
        }

        with mock.patch.object(
            module,
            "translate_single_item_plain_text",
            side_effect=requests.ConnectionError("Read timed out"),
        ), mock.patch.object(
            module,
            "_sentence_level_fallback",
            side_effect=module.PlaceholderInventoryError(
                "p006-b002",
                [],
                [],
                source_text=item["translation_unit_protected_source_text"],
                translated_text="",
            ),
        ) as sentence_fallback:
            result = module.translate_single_item_plain_text_with_retries(
                item,
                api_key="sk-test",
                model="deepseek-chat",
                base_url="https://api.deepseek.com/v1",
                request_label="test direct typst transport keep origin",
                context=context,
            )

        sentence_fallback.assert_not_called()
        self.assertEqual(result["p006-b002"]["decision"], "translate")
        self.assertEqual(result["p006-b002"]["final_status"], "failed")
        self.assertEqual(result["p006-b002"]["error_taxonomy"], "transport")
        self.assertEqual(
            result["p006-b002"]["translation_diagnostics"]["route_path"],
            ["block_level", "direct_typst", "failed"],
        )

    def test_batched_transport_failure_queues_single_item_tail_retry(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
        )
        control_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context",
        )
        context = control_module.build_translation_control_context()
        batch = [
            {
                "item_id": "p001-b001",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "translation_unit_protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "_batched_plain_candidate": True,
            },
            {
                "item_id": "p001-b002",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This paragraph keeps enough content for translation even when the network request times out.",
                "translation_unit_protected_source_text": "This paragraph keeps enough content for translation even when the network request times out.",
                "_batched_plain_candidate": True,
            },
        ]

        with mock.patch.object(module, "split_cached_batch", return_value=({}, batch)), \
                mock.patch.object(module, "store_cached_batch") as store_mock:
            with mock.patch.object(
                module,
                "translate_batch_once",
                side_effect=requests.ConnectionError("Read timed out"),
            ):
                with mock.patch.object(
                    module,
                    "translate_single_item_plain_text_with_retries",
                    side_effect=[
                        {"p001-b001": {"decision": "translate", "translated_text": "第一条已翻译", "final_status": "translated"}},
                        {"p001-b002": {"decision": "translate", "translated_text": "第二条已翻译", "final_status": "translated"}},
                    ],
                ) as single_mock:
                    result = module.translate_items_plain_text(
                        batch,
                        api_key="sk-test",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test batch transport",
                        context=context,
                    )

        self.assertEqual(result, {})
        store_mock.assert_not_called()
        self.assertEqual(single_mock.call_count, 0)
        self.assertEqual(len(context.translation_tail_queue), 2)

    def test_batched_plain_suspicious_keep_origin_only_retries_flagged_items(self):
        module = import_module(
            "retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks",
        )
        control_module = import_module(
            "retainpdf_pipeline.translate.llm.shared.control_context",
        )
        placeholder_module = import_module(
            "retainpdf_pipeline.translate.llm.placeholder_guard",
        )
        context = control_module.build_translation_control_context()
        batch = [
            {
                "item_id": "p001-b001",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "translation_unit_protected_source_text": "This sentence describes antibacterial activity and provides enough body text for translation.",
                "_batched_plain_candidate": True,
            },
            {
                "item_id": "p001-b002",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
                "protected_source_text": "This paragraph should survive the batch response and must not be retried.",
                "translation_unit_protected_source_text": "This paragraph should survive the batch response and must not be retried.",
                "_batched_plain_candidate": True,
            },
        ]
        batch_result = {
            "p001-b001": {"decision": "keep_origin", "translated_text": "", "final_status": "kept_origin"},
            "p001-b002": {"decision": "translate", "translated_text": "这一段应该直接接受。", "final_status": "translated"},
        }
        suspicious_error = placeholder_module.SuspiciousKeepOriginError("p001-b001", batch_result)
        retried_items: list[str] = []

        def fake_single(item, **kwargs):
            retried_items.append(item["item_id"])
            return {
                item["item_id"]: {
                    "decision": "translate",
                    "translated_text": "这段通过单条补跑得到译文。",
                    "final_status": "translated",
                }
            }

        with mock.patch.object(module, "split_cached_batch", return_value=({}, batch)), \
                mock.patch.object(module, "store_cached_batch") as store_mock:
            with mock.patch.object(module, "translate_batch_once", side_effect=suspicious_error):
                with mock.patch.object(module, "translate_single_item_plain_text_with_retries", side_effect=fake_single):
                    result = module.translate_items_plain_text(
                        batch,
                        api_key="sk-test",
                        model="deepseek-chat",
                        base_url="https://api.deepseek.com/v1",
                        request_label="test suspicious batch",
                        context=context,
                    )

        self.assertEqual(retried_items, [])
        store_mock.assert_called_once()
        cached_items, cached_result = store_mock.call_args.args
        self.assertEqual([item["item_id"] for item in cached_items], ["p001-b002"])
        self.assertEqual(set(cached_result), {"p001-b002"})
        self.assertEqual(result["p001-b002"]["translated_text"], "这一段应该直接接受。")
        self.assertEqual(
            result["p001-b002"]["translation_diagnostics"]["route_path"],
            ["block_level", "batched_plain"],
        )
        self.assertNotIn("p001-b001", result)
        self.assertEqual(len(context.translation_tail_queue), 1)


if __name__ == "__main__":
    unittest.main()
