import json
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.diagnostics.debug_index import build_translation_debug_index
from devtools.replay_translation_item import replay_translation_case_artifact
from devtools.replay_translation_item import replay_translation_item


def test_build_translation_debug_index_keeps_core_item_fields() -> None:
    payload = {
        0: [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_idx": 1,
                "block_type": "text",
                "math_mode": "direct_typst",
                "continuation_group": "cg-1",
                "classification_label": "translate_literal",
                "should_translate": True,
                "skip_reason": "",
                "final_status": "translated",
                "source_text": "This is a long English source sentence.",
                "translated_text": "这是一句中文翻译。",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst"],
                    "fallback_to": "",
                    "degradation_reason": "",
                    "error_trace": [{"type": "validation", "code": "TEST"}],
                    "final_status": "translated",
                },
            }
        ]
    }

    index = build_translation_debug_index(payload)

    assert index["schema"] == "translation_debug_index_v1"
    assert len(index["items"]) == 1
    assert index["items"][0]["item_id"] == "p001-b001"
    assert index["items"][0]["route_path"] == ["block_level", "direct_typst"]
    assert index["items"][0]["error_types"] == ["validation"]
    assert index["items"][0]["source_preview"].startswith("This is a long English")


def test_replay_translation_item_returns_result_without_mutating_payload(monkeypatch) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "test-key")
        job_root = Path(tmp)
        (job_root / "specs").mkdir(parents=True, exist_ok=True)
        (job_root / "translated").mkdir(parents=True, exist_ok=True)
        source_json = job_root / "ocr" / "normalized" / "document.v1.json"
        source_json.parent.mkdir(parents=True, exist_ok=True)
        source_json.write_text('{"pages":[]}', encoding="utf-8")
        source_pdf = job_root / "source" / "input.pdf"
        source_pdf.parent.mkdir(parents=True, exist_ok=True)
        source_pdf.write_bytes(b"%PDF-1.4\n")

        spec_path = job_root / "specs" / "translate.spec.json"
        spec_path.write_text(
            json.dumps(
                {
                    "schema_version": "translate.stage.v1",
                    "stage": "translate",
                    "job": {
                        "job_id": "job-1",
                        "job_root": str(job_root),
                        "workflow": "translate",
                    },
                    "inputs": {
                        "source_json": str(source_json),
                        "source_pdf": str(source_pdf),
                        "layout_json": str(source_json),
                    },
                    "params": {
                        "start_page": 0,
                        "end_page": 0,
                        "batch_size": 1,
                        "workers": 1,
                        "mode": "sci",
                        "math_mode": "placeholder",
                        "skip_title_translation": False,
                        "classify_batch_size": 12,
                        "rule_profile_name": "general_sci",
                        "custom_rules_text": "",
                        "glossary_id": "",
                        "glossary_name": "",
                        "glossary_resource_entry_count": 0,
                        "glossary_inline_entry_count": 0,
                        "glossary_overridden_entry_count": 0,
                        "glossary_entries": [],
                        "model": "deepseek-chat",
                        "base_url": "https://api.deepseek.com/v1",
                        "credential_ref": "",
                    },
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        page_payload = [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_idx": 1,
                "block_type": "text",
                "source_text": "This is a test paragraph for replay.",
                "protected_source_text": "This is a test paragraph for replay.",
                "metadata": {"structure_role": "body"},
                "classification_label": "",
                "should_translate": True,
                "skip_reason": "",
                "translation_unit_kind": "single",
                "translation_unit_protected_source_text": "This is a test paragraph for replay.",
                "translation_unit_formula_map": [],
                "formula_map": [],
                "mixed_original_protected_source_text": "This is a test paragraph for replay.",
                "translation_unit_protected_translated_text": "",
                "translation_unit_translated_text": "",
                "protected_translated_text": "",
                "translated_text": "",
                "group_protected_translated_text": "",
                "group_translated_text": "",
                "final_status": "",
                "translation_diagnostics": {},
                "continuation_group": "",
                "math_mode": "placeholder",
                "layout_zone": "",
            }
        ]
        payload_path = job_root / "translated" / "page-001-deepseek.json"
        payload_path.write_text(json.dumps(page_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest_path = job_root / "translated" / "translation-manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "schema": "translation_manifest_v1",
                    "schema_version": 1,
                    "pages": [{"page_index": 0, "page_number": 1, "path": "page-001-deepseek.json"}],
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        import devtools.replay_translation_item as replay_module

        def _fake_translate_batch(batch, **_kwargs):
            item = batch[0]
            return {
                item["item_id"]: {
                    "decision": "translate",
                    "translated_text": "这是重放后的翻译。",
                    "final_status": "translated",
                    "translation_diagnostics": {
                        "route_path": ["block_level"],
                        "final_status": "translated",
                    },
                }
            }

        monkeypatch.setattr(replay_module, "translate_batch", _fake_translate_batch)

        result = replay_translation_item(job_root, "p001-b001")

        assert result["job_id"] == "job-1"
        assert result["item_id"] == "p001-b001"
        assert result["policy_after"]["should_translate"] is True
        assert result["replay_result"]["translated_text"] == "这是重放后的翻译。"
        assert result["replay_error"] is None
        reloaded = json.loads(payload_path.read_text(encoding="utf-8"))
        assert reloaded[0]["translated_text"] == ""


def test_replay_translation_item_redirects_pipeline_stdout_to_stderr(
    monkeypatch, capsys
) -> None:
    import devtools.replay_translation_item as replay_module
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "test-key")

    def _fake_load_spec(_job_root):
        return type(
            "Spec",
            (),
            {
                "job": type("Job", (), {"job_id": "job-stdout"})(),
                "params": type(
                    "Params",
                    (),
                    {
                        "mode": "sci",
                        "math_mode": "direct_typst",
                        "skip_title_translation": False,
                        "rule_profile_name": "general_sci",
                        "custom_rules_text": "",
                        "classify_batch_size": 4,
                        "workers": 1,
                        "model": "deepseek-chat",
                        "base_url": "https://api.deepseek.com/v1",
                        "glossary_entries": [],
                        "credential_ref": "",
                    },
                )(),
            },
        )()

    saved_item = {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "source_text": "A noisy replay item.",
        "should_translate": True,
        "translation_diagnostics": {},
    }

    def _fake_find_item_payload(_job_root, _item_id):
        return 0, Path("/tmp/page-001.json"), [saved_item], saved_item

    def _fake_build_translation_policy_config(**_kwargs):
        return object()

    def _fake_apply_translation_policies(**kwargs):
        print("noisy policy log")
        kwargs["payload"][0]["should_translate"] = True

    def _fake_build_translation_context_from_policy(*_args, **_kwargs):
        return object()

    def _fake_translate_batch(batch, **_kwargs):
        print("noisy translate log")
        return {
            batch[0]["item_id"]: {
                "decision": "translate",
                "translated_text": "重放结果",
                "final_status": "translated",
            }
        }

    monkeypatch.setattr(replay_module, "_load_translate_spec", _fake_load_spec)
    monkeypatch.setattr(replay_module, "_find_item_payload", _fake_find_item_payload)
    monkeypatch.setattr(
        replay_module,
        "build_translation_policy_config",
        _fake_build_translation_policy_config,
    )
    monkeypatch.setattr(
        replay_module, "apply_translation_policies", _fake_apply_translation_policies
    )
    monkeypatch.setattr(
        replay_module,
        "build_translation_context_from_policy",
        _fake_build_translation_context_from_policy,
    )
    monkeypatch.setattr(replay_module, "translate_batch", _fake_translate_batch)

    with redirect_stdout(sys.stdout):
        result = replay_module.replay_translation_item(Path("/tmp/job"), "p001-b001")

    captured = capsys.readouterr()
    assert result["replay_result"]["translated_text"] == "重放结果"
    assert captured.out == ""
    assert "noisy policy log" in captured.err
    assert "noisy translate log" in captured.err


def test_replay_translation_item_recovers_env_api_key_from_job_db(monkeypatch) -> None:
    import devtools.replay_translation_item as replay_module

    monkeypatch.delenv("RETAIN_TRANSLATION_API_KEY", raising=False)

    def _fake_load_spec(_job_root):
        return type(
            "Spec",
            (),
            {
                "job": type("Job", (), {"job_id": "job-db-key"})(),
                "params": type(
                    "Params",
                    (),
                    {
                        "mode": "sci",
                        "math_mode": "direct_typst",
                        "skip_title_translation": False,
                        "rule_profile_name": "general_sci",
                        "custom_rules_text": "",
                        "classify_batch_size": 4,
                        "workers": 1,
                        "model": "deepseek-chat",
                        "base_url": "https://api.deepseek.com/v1",
                        "glossary_entries": [],
                        "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
                    },
                )(),
            },
        )()

    saved_item = {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "source_text": "A replay item with recovered key.",
        "should_translate": True,
        "translation_diagnostics": {},
    }

    def _fake_find_item_payload(_job_root, _item_id):
        return 0, Path("/tmp/page-001.json"), [saved_item], saved_item

    def _fake_build_translation_policy_config(**_kwargs):
        return object()

    def _fake_apply_translation_policies(**kwargs):
        kwargs["payload"][0]["should_translate"] = True

    def _fake_build_translation_context_from_policy(*_args, **_kwargs):
        return object()

    seen = {}

    def _fake_translate_batch(_batch, **kwargs):
        seen["api_key"] = kwargs.get("api_key")
        return {
            "p001-b001": {
                "decision": "translate",
                "translated_text": "恢复了数据库里的 key。",
                "final_status": "translated",
            }
        }

    monkeypatch.setattr(replay_module, "_load_translate_spec", _fake_load_spec)
    monkeypatch.setattr(replay_module, "_find_item_payload", _fake_find_item_payload)
    monkeypatch.setattr(
        replay_module,
        "build_translation_policy_config",
        _fake_build_translation_policy_config,
    )
    monkeypatch.setattr(
        replay_module, "apply_translation_policies", _fake_apply_translation_policies
    )
    monkeypatch.setattr(
        replay_module,
        "build_translation_context_from_policy",
        _fake_build_translation_context_from_policy,
    )
    monkeypatch.setattr(
        replay_module,
        "_load_translation_api_key_from_job_db",
        lambda _job_id: "db-recovered-key",
    )
    monkeypatch.setattr(replay_module, "translate_batch", _fake_translate_batch)

    result = replay_module.replay_translation_item(Path("/tmp/job"), "p001-b001")

    assert seen["api_key"] == "db-recovered-key"
    assert result["replay_result"]["translated_text"] == "恢复了数据库里的 key。"


def test_replay_translation_case_artifact_uses_frozen_page_payload(monkeypatch) -> None:
    import devtools.replay_translation_item as replay_module

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "case.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "fixture": {
                        "job_root": "job-artifact",
                        "item_id": "p001-b001",
                    },
                    "replay_input": {
                        "job_root": "job-artifact",
                        "job_id": "job-artifact",
                        "item_id": "p001-b001",
                        "page_idx": 0,
                        "page_path": "translated/page-001.json",
                        "spec": {
                            "mode": "sci",
                            "math_mode": "direct_typst",
                            "skip_title_translation": False,
                            "rule_profile_name": "general_sci",
                            "custom_rules_text": "",
                            "classify_batch_size": 4,
                            "workers": 1,
                            "model": "deepseek-chat",
                            "base_url": "https://api.deepseek.com/v1",
                            "glossary_entries": [],
                            "credential_ref": "",
                        },
                        "page_payload": [
                            {
                                "item_id": "p001-b001",
                                "page_idx": 0,
                                "block_idx": 1,
                                "block_type": "text",
                                "source_text": "Artifact replay source.",
                                "protected_source_text": "Artifact replay source.",
                                "metadata": {"structure_role": "body"},
                                "classification_label": "",
                                "should_translate": True,
                                "skip_reason": "",
                                "translation_unit_kind": "single",
                                "translation_unit_protected_source_text": "Artifact replay source.",
                                "translation_unit_formula_map": [],
                                "formula_map": [],
                                "mixed_original_protected_source_text": "Artifact replay source.",
                                "translation_unit_protected_translated_text": "",
                                "translation_unit_translated_text": "",
                                "protected_translated_text": "",
                                "translated_text": "",
                                "group_protected_translated_text": "",
                                "group_translated_text": "",
                                "final_status": "",
                                "translation_diagnostics": {},
                                "continuation_group": "",
                                "math_mode": "direct_typst",
                                "layout_zone": "",
                            }
                        ],
                    },
                    "replay": {
                        "policy_before": {
                            "item_id": "p001-b001",
                            "should_translate": False,
                            "skip_reason": "skip_model_keep_origin",
                        }
                    },
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "artifact-key")

        def _fake_build_translation_policy_config(**_kwargs):
            return object()

        def _fake_apply_translation_policies(**kwargs):
            kwargs["payload"][0]["should_translate"] = True

        def _fake_build_translation_context_from_policy(*_args, **_kwargs):
            return object()

        seen = {}

        def _fake_translate_batch(batch, **kwargs):
            seen["api_key"] = kwargs.get("api_key")
            seen["item_id"] = batch[0]["item_id"]
            return {
                batch[0]["item_id"]: {
                    "decision": "translate",
                    "translated_text": "冻结输入回放成功。",
                    "final_status": "translated",
                }
            }

        monkeypatch.setattr(
            replay_module,
            "build_translation_policy_config",
            _fake_build_translation_policy_config,
        )
        monkeypatch.setattr(
            replay_module, "apply_translation_policies", _fake_apply_translation_policies
        )
        monkeypatch.setattr(
            replay_module,
            "build_translation_context_from_policy",
            _fake_build_translation_context_from_policy,
        )
        monkeypatch.setattr(replay_module, "translate_batch", _fake_translate_batch)

        result = replay_translation_case_artifact(artifact_path)

        assert seen["api_key"] == "artifact-key"
        assert seen["item_id"] == "p001-b001"
        assert result["job_id"] == "job-artifact"
        assert result["replay_result"]["translated_text"] == "冻结输入回放成功。"
