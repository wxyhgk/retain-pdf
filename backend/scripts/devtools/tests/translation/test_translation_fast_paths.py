import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _ensure_package_stubs():
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.llm": REPO_SCRIPTS_ROOT / "services" / "translation" / "llm",
        "services.translation.orchestration": REPO_SCRIPTS_ROOT / "services" / "translation" / "orchestration",
        "services.translation.continuation": REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module


def _load_module(name: str, path: Path):
    _ensure_package_stubs()
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _load_continuation_package():
    return _load_module(
        "services.translation.continuation",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "__init__.py",
    )


def _install_minimal_continuation_stub():
    rules_module = _load_module(
        "services.translation.continuation.rules",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "rules.py",
    )
    pairs_module = _load_module(
        "services.translation.continuation.pairs",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "pairs.py",
    )
    module = types.ModuleType("services.translation.continuation")
    module.apply_candidate_pair_joins = pairs_module.apply_candidate_pair_joins
    module.candidate_continuation_pairs = pairs_module.candidate_continuation_pairs
    module.pair_break_score = rules_module.pair_break_score
    module.pair_join_score = rules_module.pair_join_score
    module.review_candidate_pairs = lambda *args, **kwargs: {}
    sys.modules["services.translation.continuation"] = module
    return module


class TranslationFastPathTests(unittest.TestCase):
    def test_editorial_metadata_token_is_treated_as_nontranslatable(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertTrue(
            module.looks_like_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "CrossMark",
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 0,
                    "lines": [{"spans": [{"content": "CrossMark"}]}],
                }
            )
        )

    def test_short_first_page_header_fragment_is_treated_as_nontranslatable(self):
        module = _load_module(
            "services.translation.policy.metadata_filter",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "metadata_filter.py",
        )
        self.assertTrue(
            module.looks_like_nontranslatable_metadata(
                {
                    "block_type": "text",
                    "source_text": "Energy property",
                    "should_translate": True,
                    "metadata": {"structure_role": "body"},
                    "page_idx": 0,
                    "bbox": [48, 421, 105, 431],
                    "lines": [{"spans": [{"content": "Energy property"}]}],
                }
            )
        )

    def test_short_non_body_empty_translation_degrades_to_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        payload = module._keep_origin_payload_for_empty_translation(
            {
                "item_id": "p012-b022",
                "page_idx": 11,
                "block_type": "image_caption",
                "layout_zone": "non_flow",
                "metadata": {"structure_role": "caption"},
            }
        )
        self.assertEqual(payload["p012-b022"]["decision"], "keep_origin")
        self.assertEqual(payload["p012-b022"]["final_status"], "kept_origin")
        self.assertEqual(
            payload["p012-b022"]["translation_diagnostics"]["degradation_reason"],
            "empty_translation_non_body_label",
        )

    def test_repeated_empty_translation_degrades_to_keep_origin(self):
        module = _load_module(
            "services.translation.llm.fallbacks",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "fallbacks.py",
        )
        payload = module._keep_origin_payload_for_repeated_empty_translation(
            {
                "item_id": "p001-b017",
                "page_idx": 0,
                "block_type": "text",
            }
        )
        self.assertEqual(payload["p001-b017"]["decision"], "keep_origin")
        self.assertEqual(payload["p001-b017"]["final_status"], "kept_origin")
        self.assertEqual(
            payload["p001-b017"]["translation_diagnostics"]["degradation_reason"],
            "empty_translation_repeated",
        )

    def test_single_item_extractor_returns_plain_text_when_not_json(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        self.assertEqual(
            module.extract_single_item_translation_text("这是直接返回的中文译文。", "p001-b019"),
            "这是直接返回的中文译文。",
        )

    def test_english_residue_detector_rejects_long_body_that_stays_english(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        item = {
            "item_id": "p002-b001",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": (
                "The advancement of complex computer programs with faster computing power and material simulation methods "
                "has become an important tool for material researchers, because it explains many properties."
            ),
        }
        self.assertTrue(
            module.looks_like_untranslated_english_output(
                item,
                "The advancement of complex computer programs with faster computing power and material simulation methods remains important.",
            )
        )

    def test_structured_output_repairs_trailing_commas_and_unquoted_keys(self):
        module = _load_module(
            "services.translation.llm.structured_output",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_output.py",
        )
        payload = module.parse_structured_json(
            """
            ```json
            {domain: "chemistry", summary: "ok", translation_guidance: "keep terms",}
            ```
            """
        )
        self.assertEqual(payload["domain"], "chemistry")
        self.assertEqual(payload["summary"], "ok")

    def test_domain_context_parser_accepts_line_key_value_fallback(self):
        module = _load_module(
            "services.translation.llm.structured_parsers",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_parsers.py",
        )
        result = module.parse_domain_context_response(
            "DOMAIN: materials science\nSUMMARY: photocatalysis paper\nTRANSLATION_GUIDANCE: preserve formulas",
            preview_text="preview",
        )
        self.assertEqual(result["domain"], "materials science")
        self.assertEqual(result["summary"], "photocatalysis paper")
        self.assertEqual(result["translation_guidance"], "preserve formulas")

    def test_single_item_extractor_unwraps_nested_batch_json_shell(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        nested = {
            "translated_text": json.dumps(
                {
                    "translations": [
                        {
                            "item_id": "p030-b010",
                            "translated_text": "计算效率、成本与精度。",
                        }
                    ]
                },
                ensure_ascii=False,
            )
        }
        self.assertEqual(
            module.extract_single_item_translation_text(json.dumps(nested, ensure_ascii=False), "p030-b010"),
            "计算效率、成本与精度。",
        )

    def test_placeholder_guard_canonicalizes_nested_json_shell(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        result = module.canonicalize_batch_result(
            [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
            {
                "p030-b010": {
                    "decision": "translate",
                    "translated_text": json.dumps(
                        {
                            "translations": [
                                {
                                    "item_id": "p030-b010",
                                    "translated_text": "计算效率、成本与精度。",
                                }
                            ]
                        },
                        ensure_ascii=False,
                    ),
                }
            },
        )
        self.assertEqual(result["p030-b010"]["translated_text"], "计算效率、成本与精度。")

    def test_placeholder_guard_rejects_protocol_shell_output(self):
        module = _load_module(
            "services.translation.llm.placeholder_guard",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "placeholder_guard.py",
        )
        with self.assertRaises(module.TranslationProtocolError):
            module.validate_batch_result(
                [{"item_id": "p030-b010", "translation_unit_protected_source_text": "Computational efficiency."}],
                {
                    "p030-b010": {
                        "decision": "translate",
                        "translated_text": '{ "translations": [{"item_id":"p030-b010","translated_text":"计算效率"}] }',
                    }
                },
            )

    def test_translate_single_item_plain_text_uses_plain_text_protocol(self):
        module = _load_module(
            "services.translation.llm.translation_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "translation_client.py",
        )
        item = {
            "item_id": "p001-b001",
            "protected_source_text": "The advancement of complex computer programs.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        }
        captured: dict[str, object] = {}

        def _fake_messages(*args, **kwargs):
            captured["response_style"] = kwargs.get("response_style")
            return [{"role": "system", "content": "stub"}]

        def _fake_request(messages, **kwargs):
            captured["messages"] = messages
            captured["response_format"] = kwargs.get("response_format")
            return "复杂计算机程序的发展。"

        with mock.patch.object(module, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
            module, "request_chat_content", side_effect=_fake_request
        ):
            result = module.translate_single_item_plain_text(item)

        self.assertEqual(captured["response_style"], "plain_text")
        self.assertIsNone(captured["response_format"])
        self.assertEqual(result["p001-b001"]["translated_text"], "复杂计算机程序的发展。")

    def test_translate_batch_once_uses_tagged_protocol_without_schema(self):
        module = _load_module(
            "services.translation.llm.translation_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "translation_client.py",
        )
        batch = [
            {
                "item_id": "p001-b001",
                "protected_source_text": "The advancement of complex computer programs.",
                "translation_unit_protected_source_text": "The advancement of complex computer programs.",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            },
            {
                "item_id": "p001-b002",
                "protected_source_text": "Faster computing power improves simulation.",
                "translation_unit_protected_source_text": "Faster computing power improves simulation.",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            },
        ]
        captured: dict[str, object] = {}

        def _fake_messages(*args, **kwargs):
            captured["response_style"] = kwargs.get("response_style")
            return [{"role": "system", "content": "stub"}]

        def _fake_request(messages, **kwargs):
            captured["messages"] = messages
            captured["response_format"] = kwargs.get("response_format")
            return (
                "<<<ITEM item_id=p001-b001>>>\n复杂计算机程序的发展。\n<<<END>>>\n"
                "<<<ITEM item_id=p001-b002>>>\n更快的算力提升了模拟能力。\n<<<END>>>"
            )

        with mock.patch.object(module, "build_messages", side_effect=_fake_messages), mock.patch.object(
            module, "request_chat_content", side_effect=_fake_request
        ):
            result = module.translate_batch_once(batch, mode="fast")

        self.assertEqual(captured["response_style"], "tagged")
        self.assertIsNone(captured["response_format"])
        self.assertEqual(result["p001-b001"]["translated_text"], "复杂计算机程序的发展。")
        self.assertEqual(result["p001-b002"]["translated_text"], "更快的算力提升了模拟能力。")

    def test_build_messages_sci_tagged_requires_decision_attribute(self):
        module = _load_module(
            "services.translation.llm.deepseek_client",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "deepseek_client.py",
        )
        messages = module.build_messages(
            [
                {
                    "item_id": "p001-b001",
                    "protected_source_text": "Experimentally test the mechanism.",
                    "metadata": {"structure_role": "body"},
                }
            ],
            mode="sci",
            response_style="tagged",
        )
        self.assertIn("<<<ITEM item_id=ITEM_ID decision=translate>>>", messages[0]["content"])

    def test_domain_context_parser_salvages_fields_from_malformed_json(self):
        module = _load_module(
            "services.translation.llm.structured_parsers",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_parsers.py",
        )
        content = """
        Here is the result:
        {
          "domain": "computational chemistry",
          "summary": "A materials-modeling paper with equation-heavy prose."
          "translation_guidance": "保留术语、缩写和公式记号，不要意译。"
        }
        """
        result = module.parse_domain_context_response(content, preview_text="preview")
        self.assertEqual(result["domain"], "computational chemistry")
        self.assertEqual(result["summary"], "A materials-modeling paper with equation-heavy prose.")
        self.assertEqual(result["translation_guidance"], "保留术语、缩写和公式记号，不要意译。")

    def test_continuation_review_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.continuation.review",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "review.py",
        )
        schema = module.CONTINUATION_REVIEW_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(schema["json_schema"]["schema"]["required"], ["decisions"])

    def test_domain_context_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        schema = module.DOMAIN_CONTEXT_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(
            schema["json_schema"]["schema"]["required"],
            ["domain", "summary", "translation_guidance"],
        )

    def test_garbled_reconstruction_uses_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.postprocess.garbled_reconstruction",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "postprocess" / "garbled_reconstruction.py",
        )
        schema = module.GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
        self.assertEqual(schema["type"], "json_schema")
        self.assertTrue(schema["json_schema"]["strict"])
        self.assertEqual(schema["json_schema"]["schema"]["required"], ["translated_text"])

    def test_translation_and_formula_outputs_use_strict_json_schema_format(self):
        module = _load_module(
            "services.translation.llm.structured_models",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "structured_models.py",
        )
        for schema in [
            module.TRANSLATION_BATCH_RESPONSE_SCHEMA,
            module.TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA,
            module.TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA,
            module.FORMULA_SEGMENT_RESPONSE_SCHEMA,
        ]:
            self.assertEqual(schema["type"], "json_schema")
            self.assertTrue(schema["json_schema"]["strict"])

    def test_formula_segment_parser_accepts_schema_json_payload(self):
        module = _load_module(
            "services.translation.llm.segment_routing",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "segment_routing.py",
        )
        result = module.parse_segment_translation_payload(
            '{"segments":[{"segment_id":"1","translated_text":"第一段"},{"segment_id":"2","translated_text":"第二段"}]}',
            expected_segments=[
                {"segment_id": "1", "source_text": "first"},
                {"segment_id": "2", "source_text": "second"},
            ],
        )
        self.assertEqual(result, {"1": "第一段", "2": "第二段"})

    def test_domain_context_cache_round_trip(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            payload = {
                "domain": "chemistry",
                "summary": "cached",
                "translation_guidance": "guidance",
                "preview_text": "preview",
            }
            module.save_domain_context(output_dir, payload)
            loaded = module.load_cached_domain_context(output_dir)
            self.assertEqual(loaded, payload)

    def test_domain_context_raw_response_round_trip(self):
        module = _load_module(
            "services.translation.llm.domain_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "domain_context.py",
        )
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            path = module.save_domain_context_raw(output_dir, "raw model response")
            self.assertEqual(path.read_text(encoding="utf-8"), "raw model response")

    def test_translation_control_context_merges_terms_retrieval_and_extra_guidance(self):
        module = _load_module(
            "services.translation.llm.control_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "control_context.py",
        )
        context = module.build_translation_control_context(
            mode="sci",
            domain_guidance="domain-guidance",
            rule_guidance="rule-guidance",
            extra_guidance="extra-guidance",
            glossary_entries=[module.GlossaryEntry(source="Engram", target="Engram")],
            retrieval_entries=[module.RetrievalEvidence(source="rag-1", content="Retrieved note")],
        )
        merged = context.merged_guidance
        self.assertIn("domain-guidance", merged)
        self.assertIn("rule-guidance", merged)
        self.assertIn("Glossary preferences:", merged)
        self.assertIn("Retrieved reference context:", merged)
        self.assertIn("extra-guidance", merged)

    def test_build_translation_context_from_policy_uses_policy_guidance(self):
        _load_module(
            "services.translation.policy",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "__init__.py",
        )
        module = _load_module(
            "services.translation.session_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "session_context.py",
        )

        class _Policy:
            mode = "sci"
            domain_context = {"translation_guidance": "domain-guidance"}
            rule_guidance = "rule-guidance"

        context = module.build_translation_context_from_policy(
            _Policy(),
            extra_guidance="extra-guidance",
            retrieval_entries=[module.RetrievalEvidence(source="rag", content="snippet")],
        )
        self.assertEqual(context.mode, "sci")
        self.assertIn("domain-guidance", context.merged_guidance)
        self.assertIn("rule-guidance", context.merged_guidance)
        self.assertIn("extra-guidance", context.merged_guidance)
        self.assertIn("snippet", context.merged_guidance)
        self.assertEqual(context.engine_profile_name, "balanced")
        self.assertEqual(context.batch_policy.plain_batch_size, 4)

    def test_build_translation_context_uses_model_profile_overrides(self):
        _load_module(
            "services.translation.policy",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "policy" / "__init__.py",
        )
        module = _load_module(
            "services.translation.session_context",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "session_context.py",
        )

        class _Policy:
            mode = "sci"
            domain_context = {"translation_guidance": "domain-guidance"}
            rule_guidance = "rule-guidance"

        context = module.build_translation_context_from_policy(
            _Policy(),
            model="qwen35-9b-q4km",
            base_url="http://example.com/v1",
        )
        self.assertEqual(context.engine_profile_name, "qwen35_low_concurrency_fast")
        self.assertEqual(context.fallback_policy.formula_segment_attempts, 2)
        self.assertEqual(context.segmentation_policy.prefer_plain_when_segment_count_leq, 6)

    def test_formula_segment_route_prefers_plain_for_small_segment_count(self):
        module = _load_module(
            "services.translation.llm.segment_routing",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "llm" / "segment_routing.py",
        )
        item = {
            "item_id": "p001-b001",
            "protected_source_text": "After <f1-a7c/> hours, activity increased and <f2-b2d/> remained stable.",
        }
        policy = module.SegmentationPolicy(
            prefer_plain_when_segment_count_leq=6,
            small_formula_inline_enabled=False,
        )
        self.assertEqual(module.formula_segment_translation_route(item, policy=policy), "none")

    def test_continuation_review_short_circuits_high_confidence_pairs(self):
        _install_minimal_continuation_stub()
        module = _load_module(
            "services.translation.orchestration.document_orchestrator",
            REPO_SCRIPTS_ROOT / "services" / "translation" / "orchestration" / "document_orchestrator.py",
        )
        flat_payload = [
            {
                "item_id": "a",
                "page_idx": 0,
                "block_type": "text",
                "protected_source_text": "This sentence continues with",
                "bbox": [10, 10, 200, 30],
            },
            {
                "item_id": "b",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "and additional evidence from the experiment.",
                "bbox": [10, 10, 200, 30],
            },
            {
                "item_id": "c",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "Conclusion.",
                "bbox": [220, 10, 320, 30],
            },
            {
                "item_id": "d",
                "page_idx": 1,
                "block_type": "text",
                "protected_source_text": "Methods",
                "bbox": [10, 50, 120, 70],
            },
        ]
        pairs = [
            {"prev_item_id": "a", "next_item_id": "b"},
            {"prev_item_id": "c", "next_item_id": "d"},
        ]
        auto_join, review = module._split_high_confidence_continuation_pairs(flat_payload, pairs)
        self.assertEqual(auto_join, [("a", "b")])
        self.assertEqual(review, [])


if __name__ == "__main__":
    unittest.main()
