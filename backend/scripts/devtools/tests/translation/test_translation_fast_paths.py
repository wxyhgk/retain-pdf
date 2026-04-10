import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path


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
