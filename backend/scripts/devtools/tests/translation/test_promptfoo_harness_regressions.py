import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


import devtools.promptfoo.provider as promptfoo_provider
import devtools.promptfoo.tests as promptfoo_tests
from services.translation.payload.parts.policy_mutations import apply_ref_text_skip


def test_generate_tests_omits_none_vars_and_blank_math_expectations(monkeypatch) -> None:
    monkeypatch.setattr(
        promptfoo_tests,
        "read_fixture_rows",
        lambda _path: [
            {
                "enabled": True,
                "job_root": "job-1",
                "item_id": "p001-b001",
                "description": "blank optional vars",
                "source_excerpt": "",
                "expected_contains": [],
                "required_terms": [],
                "forbidden_substrings": [],
                "require_cjk": True,
                "min_cjk_chars": 1,
                "min_output_chars": None,
                "expected_inline_math_count": None,
                "expected_block_math_count": None,
                "notes": "",
            }
        ],
    )
    monkeypatch.setattr(
        promptfoo_tests,
        "load_saved_translation_item",
        lambda *_args, **_kwargs: {
            "source_text": "This paragraph mentions \\mathrm{nm} but has no dollar-delimited math.",
            "translated_text": "",
        },
    )

    tests = promptfoo_tests.generate_tests()

    assert len(tests) == 1
    vars_payload = tests[0]["vars"]
    assert "min_output_chars" not in vars_payload
    assert "expected_inline_math_count" not in vars_payload
    assert "expected_block_math_count" not in vars_payload


def test_apply_ref_text_skip_keeps_numbered_bibliography_skipped_without_year() -> None:
    source_text = (
        "1. Smith John Fluorescence tuning in coumarin derivatives for dye design "
        "Journal of Organic Luminescence volume issue pages."
    )
    payload = [
        {
            "item_id": "p001-b001",
            "block_type": "ref_text",
            "source_text": source_text,
            "protected_source_text": source_text,
            "should_translate": True,
            "classification_label": "",
            "skip_reason": "",
            "translated_text": "",
            "metadata": {},
        }
    ]

    skipped = apply_ref_text_skip(payload)

    assert skipped == 1
    assert payload[0]["should_translate"] is False
    assert payload[0]["classification_label"] == "skip_ref_text"
    assert payload[0]["skip_reason"] == "skip_ref_text"


def test_promptfoo_provider_suppresses_success_stderr(monkeypatch, capsys) -> None:
    def _fake_replay_translation_item(_job_root, _item_id):
        print("replay cache hit", file=sys.stderr)
        return {
            "replay_result": {
                "translated_text": "这是一条回放翻译。",
                "final_status": "translated",
            },
            "replay_error": None,
            "saved_item": {
                "translated_text": "",
                "source_text": "source",
            },
        }

    monkeypatch.setattr(
        promptfoo_provider,
        "replay_translation_item",
        _fake_replay_translation_item,
    )
    monkeypatch.setattr(
        promptfoo_provider,
        "resolve_job_root",
        lambda _value: Path("/tmp"),
    )

    result = promptfoo_provider.call_api(
        "",
        context={"vars": {"job_root": "job-1", "item_id": "p001-b001"}},
    )

    captured = capsys.readouterr()
    assert captured.err == ""
    assert result["output"] == "这是一条回放翻译。"
    assert "replay_logs" in result["metadata"]
    assert "replay cache hit" in result["metadata"]["replay_logs"]


def test_promptfoo_provider_replays_from_case_artifact_when_job_root_missing(monkeypatch, capsys) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "case.json"
        artifact_path.write_text("{}", encoding="utf-8")

        def _fake_replay_translation_case_artifact(_path, _item_id):
            print("artifact replay log", file=sys.stderr)
            return {
                "replay_result": {
                    "translated_text": "来自 artifact 的翻译。",
                    "final_status": "translated",
                },
                "replay_error": None,
                "saved_item": {
                    "translated_text": "",
                    "source_text": "source",
                },
            }

        monkeypatch.setattr(
            promptfoo_provider,
            "resolve_job_root",
            lambda value: Path("/nonexistent") / value,
        )
        monkeypatch.setattr(
            promptfoo_provider,
            "resolve_case_artifact_path",
            lambda *_args, **_kwargs: artifact_path,
        )
        monkeypatch.setattr(
            promptfoo_provider,
            "replay_translation_case_artifact",
            _fake_replay_translation_case_artifact,
        )

        result = promptfoo_provider.call_api(
            "",
            context={"vars": {"job_root": "job-1", "item_id": "p001-b001", "case_artifact": "cases/job-1.json"}},
        )

        captured = capsys.readouterr()
        assert captured.err == ""
        assert result["output"] == "来自 artifact 的翻译。"
        assert "artifact replay log" in result["metadata"]["replay_logs"]
