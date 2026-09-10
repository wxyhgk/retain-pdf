from __future__ import annotations

import sys

import pytest

from retainpdf_pipeline.entrypoints import console


def test_help_lists_stable_commands(capsys) -> None:
    assert console.main(["--help"]) == 0

    output = capsys.readouterr().out
    assert "retainpdf-pipeline <command>" in output
    assert "translate-only" in output
    assert "document-operation" in output
    assert "side-by-side-pdf" in output
    assert "diagnose-failure" in output


def test_unknown_command_fails_without_running_worker(capsys) -> None:
    assert console.main(["not-a-command"]) == 2

    error = capsys.readouterr().err
    assert "unknown command: not-a-command" in error


def test_dispatch_forwards_worker_arguments_and_restores_argv(monkeypatch) -> None:
    received: list[str] = []

    def fake_runner() -> int:
        received.extend(sys.argv)
        return 7

    monkeypatch.setitem(console.COMMANDS, "fake", (fake_runner, "test command"))
    original_argv = sys.argv

    assert console.main(["fake", "--spec", "job.spec.json"]) == 7
    assert received == [
        "retainpdf-pipeline fake",
        "--spec",
        "job.spec.json",
    ]
    assert sys.argv is original_argv


def test_side_by_side_pdf_is_a_plain_passthrough(monkeypatch, capsys) -> None:
    from retainpdf_pipeline.render.tools import side_by_side_pdf

    received: list[str] = []

    def fake_main() -> None:
        received.extend(sys.argv)
        print("side-by-side-ready")

    monkeypatch.setattr(side_by_side_pdf, "main", fake_main)

    assert console.main(["side-by-side-pdf", "--source-pdf", "source.pdf"]) == 0
    assert received == [
        "retainpdf-pipeline side-by-side-pdf",
        "--source-pdf",
        "source.pdf",
    ]
    assert capsys.readouterr().out == "side-by-side-ready\n"


def test_diagnose_failure_is_a_plain_passthrough(monkeypatch, capsys) -> None:
    from retainpdf_pipeline.entrypoints import diagnose_failure_with_ai

    received: list[str] = []

    def fake_main() -> None:
        received.extend(sys.argv)
        print('{"status":"skipped","reason":"missing_api_key"}')

    monkeypatch.setattr(diagnose_failure_with_ai, "main", fake_main)

    assert console.main(["diagnose-failure", "--input-json", "failure.json"]) == 0
    assert received == [
        "retainpdf-pipeline diagnose-failure",
        "--input-json",
        "failure.json",
    ]
    assert capsys.readouterr().out == '{"status":"skipped","reason":"missing_api_key"}\n'


@pytest.mark.parametrize("command", ["side-by-side-pdf", "diagnose-failure"])
def test_plain_passthrough_preserves_system_exit(monkeypatch, command: str) -> None:
    if command == "side-by-side-pdf":
        from retainpdf_pipeline.render.tools import side_by_side_pdf as target
    else:
        from retainpdf_pipeline.entrypoints import diagnose_failure_with_ai as target

    def fake_main() -> None:
        raise SystemExit(23)

    monkeypatch.setattr(target, "main", fake_main)

    with pytest.raises(SystemExit) as exc_info:
        console.main([command, "--invalid"])

    assert exc_info.value.code == 23
