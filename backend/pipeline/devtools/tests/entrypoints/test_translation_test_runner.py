"""The offline entrypoint must not select live tools or hide pytest failures."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest


def _runner(path=None):
    path = path or Path(__file__).resolve().parents[2] / "run_translation_tests.py"
    spec = importlib.util.spec_from_file_location("offline_translation_runner_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_symlinked_entry_uses_one_canonical_test_tree(tmp_path):
    source = Path(__file__).resolve().parents[2]
    alias = tmp_path / "devtools-alias"
    alias.symlink_to(source, target_is_directory=True)
    runner = _runner(alias / "run_translation_tests.py")
    assert runner.RUNNER_TEST == source / "tests/entrypoints/test_translation_test_runner.py"
    assert runner.RUNNER_TEST.is_relative_to(runner.SERVICES)


def test_default_suites_and_failure_propagation(monkeypatch):
    runner = _runner()
    calls = []
    monkeypatch.setenv("RETAIN_TRANSLATION_CAPTURE_DIR", "/unused-live-capture")
    def fake_run(command, **kwargs):
        calls.append((command, kwargs))
        return SimpleNamespace(returncode=1)
    monkeypatch.setattr(runner.subprocess, "run", fake_run)
    assert runner.main([]) == 1
    command, options = calls[0]
    assert command[3:5] == [str(path) for path in runner.SUITES.values()]
    assert command[5] == str(runner.RUNNER_TEST)
    assert command[6:8] == list(map(str, runner.ARCHITECTURE_TESTS))
    assert options["timeout"] == 300
    assert "RETAIN_TRANSLATION_CAPTURE_DIR" not in options["env"]
    assert options["env"]["PYTHONPATH"] == str(runner.SERVICES / "pipeline")
    assert not Path(options["env"]["OUTPUT_ROOT"]).exists()


def test_runner_drops_live_environment_and_keeps_explicit_typst(monkeypatch, tmp_path):
    runner = _runner()
    for key in ("RETAIN_MODEL_EXECUTOR_URL", "RETAIN_MODEL_CAPABILITY", "RETAIN_MODEL_JOB_ID",
                "RETAIN_TRANSLATION_TRANSPORT", "OPENAI_API_KEY", "DEEPSEEK_API_KEY",
                "HTTPS_PROXY", "ALL_PROXY", "PYTEST_ADDOPTS", "PYTHONSTARTUP",
                "RUST_API_PROJECT_ROOT", "RUST_API_OUTPUT_ROOT"):
        monkeypatch.setenv(key, "synthetic-live-setting")
    monkeypatch.setenv("OUTPUT_ROOT", "synthetic-live-setting")
    monkeypatch.setenv("TYPST_BIN", "/synthetic/typst")
    environment = runner.test_environment(str(tmp_path))
    assert "synthetic-live-setting" not in environment.values()
    assert environment["OUTPUT_ROOT"] == str(tmp_path)
    assert environment["TYPST_BIN"] == "/synthetic/typst"
    assert environment["PYTHONNOUSERSITE"] == "1"


def test_child_default_caches_use_isolated_output_root(tmp_path):
    runner = _runner()
    child = runner.subprocess.run(
        [runner.sys.executable, "-c",
         "import json; from retainpdf_pipeline.foundation.config import paths; "
         "print(json.dumps([str(paths.TRANSLATION_UNIT_CACHE_DIR), "
         "str(paths.DOMAIN_CONTEXT_CACHE_DIR), str(paths.RENDER_TYPOGRAPHY_MEMORY_DIR)]))"],
        env=runner.test_environment(str(tmp_path)), capture_output=True, text=True,
        check=True, timeout=20,
    )
    assert json.loads(child.stdout) == [
        str(tmp_path / name) for name in
        ("_translation_unit_cache", "_domain_context_cache", "_render_typography_memory")
    ]


@pytest.mark.parametrize("failure", [False, True])
def test_output_root_exists_only_during_child_run(monkeypatch, failure):
    runner = _runner()
    roots = []
    def fake_run(command, **kwargs):
        root = Path(kwargs["env"]["OUTPUT_ROOT"])
        assert root.is_dir()
        (root / "synthetic-cache").write_text("test-only")
        roots.append(root)
        if failure:
            raise runner.subprocess.TimeoutExpired(command, 300)
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(runner.subprocess, "run", fake_run)
    assert runner.main([]) == (124 if failure else 0)
    assert len(roots) == 1
    assert not roots[0].exists()


def test_reverse_and_collection(monkeypatch):
    runner = _runner()
    calls = []
    monkeypatch.setattr(runner.subprocess, "run", lambda command, **kwargs: (
        calls.append(command) or SimpleNamespace(returncode=0)))
    assert runner.main(["--suite", "benchmarks", "--reverse", "--collect-only"]) == 0
    expected = sorted(map(str, runner.SUITES["benchmarks"].rglob("test_*.py")), reverse=True)
    assert calls[0][3:3 + len(expected)] == expected
    assert calls[0][-1] == "--collect-only"


@pytest.mark.parametrize("suite", ["all", "translation", "benchmarks"])
@pytest.mark.parametrize("reverse", [False, True])
def test_architecture_detector_regressions_follow_translation_suite(monkeypatch, suite, reverse):
    runner = _runner()
    calls = []
    monkeypatch.setattr(runner.subprocess, "run", lambda command, **kwargs: (
        calls.append(command) or SimpleNamespace(returncode=0)))
    assert runner.main(["--suite", suite, *(["--reverse"] if reverse else [])]) == 0
    for gate in runner.ARCHITECTURE_TESTS:
        assert (str(gate) in calls[0]) == (suite != "benchmarks")
        assert calls[0].count(str(gate)) <= 1
    if reverse:
        targets = calls[0][3:calls[0].index("-q")]
        assert targets == sorted(targets, reverse=True)


def test_missing_architecture_detector_regression_fails_closed(monkeypatch, tmp_path):
    runner = _runner()
    monkeypatch.setattr(runner, "ARCHITECTURE_TESTS", (tmp_path / "missing.py",))
    with pytest.raises(SystemExit) as error:
        runner.main([])
    assert error.value.code == 2


def test_timeout_is_failure(monkeypatch):
    runner = _runner()
    def timeout(command, **kwargs):
        raise runner.subprocess.TimeoutExpired(command, 300)
    monkeypatch.setattr(runner.subprocess, "run", timeout)
    assert runner.main([]) == 124


def test_missing_suite_is_not_silently_skipped(monkeypatch, tmp_path):
    runner = _runner()
    monkeypatch.setitem(runner.SUITES, "benchmarks", tmp_path / "missing")
    with pytest.raises(SystemExit) as error:
        runner.main([])
    assert error.value.code == 2


def test_empty_reverse_suite_never_runs_unscoped_pytest(monkeypatch, tmp_path):
    runner = _runner()
    monkeypatch.setitem(runner.SUITES, "benchmarks", tmp_path)
    def unexpected_run(*args, **kwargs):
        pytest.fail("Empty selection must not launch pytest discovery")
    monkeypatch.setattr(runner.subprocess, "run", unexpected_run)
    with pytest.raises(SystemExit) as error:
        runner.main(["--suite", "benchmarks", "--reverse"])
    assert error.value.code == 2


@pytest.mark.parametrize("reverse", [False, True])
def test_tooling_selection_preserves_legacy_aggregates(monkeypatch, reverse):
    runner = _runner()
    calls = []
    monkeypatch.setattr(runner.subprocess, "run", lambda command, **kwargs: (
        calls.append(command) or SimpleNamespace(returncode=0)))
    assert list(runner.SUITES) == ["translation", "benchmarks"]
    assert runner.main(["--suite", "tooling", "--collect-only", *(["--reverse"] if reverse else [])]) == 0
    root = runner.SUITES["benchmarks"] / "tooling"
    expected = sorted(map(str, root.rglob("test_*.py")), reverse=True) if reverse else [str(root)]
    assert calls[0][3:calls[0].index("-q")] == expected
    assert calls[0][-1] == "--collect-only"
    assert str(runner.RUNNER_TEST) not in calls[0]


def _fake_categories(runner, monkeypatch, tmp_path):
    root = tmp_path / "pipeline/tests"
    root.mkdir(parents=True)
    monkeypatch.setitem(runner.SUITES, "benchmarks", root)
    for category in runner.BENCHMARK_CATEGORIES:
        directory = root / category
        directory.mkdir()
        (directory / "test_example.py").write_text("def test_example(): pass\n")


@pytest.mark.parametrize("relative", ["test_loose.py", "unknown/test_hidden.py"])
def test_structure_rejects_unclassified_tests(monkeypatch, tmp_path, relative):
    runner = _runner()
    _fake_categories(runner, monkeypatch, tmp_path)
    misplaced = runner.SUITES["benchmarks"] / relative
    misplaced.parent.mkdir(exist_ok=True)
    misplaced.write_text("def test_unclassified(): pass\n")
    with pytest.raises(ValueError, match="Unclassified"):
        runner.benchmark_modules()


def test_structure_rejects_empty_category(monkeypatch, tmp_path):
    runner = _runner()
    _fake_categories(runner, monkeypatch, tmp_path)
    (runner.SUITES["benchmarks"] / "contracts/test_example.py").unlink()
    with pytest.raises(ValueError, match="empty benchmark category"):
        runner.benchmark_modules()


@pytest.mark.parametrize("fault", [None, "reverse", "empty_module", "category_union", "duplicate"])
def test_discovery_checks_dynamic_item_sets_without_executing_tests(monkeypatch, tmp_path, fault):
    runner = _runner()
    _fake_categories(runner, monkeypatch, tmp_path)
    paths = [runner.SUITES["benchmarks"] / name / "test_example.py" for name in runner.BENCHMARK_CATEGORIES]
    items = [str(path.resolve()) + "::test_example" for path in paths]
    calls = []
    def collect(targets, output_root):
        calls.append(targets)
        if len(calls) <= 2:
            if fault == "reverse" and len(calls) == 2:
                return items[:-1]
            if fault == "empty_module":
                return items[:-1]
            if fault == "duplicate":
                return items + items[:1]
            return items
        index = runner.BENCHMARK_CATEGORIES.index(targets[0].name)
        return [] if fault == "category_union" and index == 0 else [items[index]]
    monkeypatch.setattr(runner, "collect_nodeids", collect)
    if fault:
        with pytest.raises(ValueError):
            runner.check_discovery(str(tmp_path))
    else:
        runner.check_discovery(str(tmp_path))
        assert len(calls) == 5
        assert not any(runner.RUNNER_TEST in targets for targets in calls)


def test_check_discovery_option_does_not_execute_suite(monkeypatch):
    runner = _runner()
    calls = []
    monkeypatch.setattr(runner, "check_discovery", lambda root: calls.append(root))
    monkeypatch.setattr(runner.subprocess, "run", lambda *args, **kwargs: pytest.fail("must not execute tests"))
    assert runner.main(["--check-discovery"]) == 0
    assert len(calls) == 1
    assert not Path(calls[0]).exists()


def test_package_aliases_keep_default_full_and_explicit_contract_scope():
    runner = _runner()
    scripts = json.loads((runner.SERVICES.parent / "package.json").read_text())["scripts"]
    base = "python3 backend/pipeline/devtools/run_translation_tests.py"
    assert scripts["test:translation"] == base
    assert scripts["test:translation:tooling"] == base + " --suite tooling"
    assert scripts["test:translation:contract"] == base + " --suite benchmarks"


def test_real_collector_returns_canonical_items_without_running_bodies(tmp_path):
    runner = _runner()
    module = tmp_path / "test_collection_probe.py"
    module.write_text("def test_never_execute():\n    raise AssertionError('body must not run')\n")
    assert runner.collect_nodeids([module], str(tmp_path / "cache")) == [
        str(module.resolve()) + "::test_never_execute"
    ]


@pytest.mark.parametrize("relative", ["support/test_hidden.py", "tools/analysis/test_hidden.py", "test_hidden.py"])
def test_structure_rejects_tests_outside_test_root(monkeypatch, tmp_path, relative):
    runner = _runner()
    _fake_categories(runner, monkeypatch, tmp_path)
    misplaced = runner.SUITES["benchmarks"].parent / relative
    misplaced.parent.mkdir(parents=True, exist_ok=True)
    misplaced.write_text("def test_hidden(): pass\n")
    with pytest.raises(ValueError, match="Unclassified") as error:
        runner.benchmark_modules()
    assert str(misplaced) in str(error.value)
