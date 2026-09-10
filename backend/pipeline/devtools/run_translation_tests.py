"""Run the curated offline translation regression suites, never live eval scripts."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


SERVICES = Path(__file__).resolve().parents[2]
SUITES = {
    "translation": SERVICES / "pipeline/devtools/tests/translation",
    "benchmarks": SERVICES.parent / "tests/performance/pipeline/tests",
}
RUNNER_TEST = Path(__file__).resolve().parent / "tests/entrypoints/test_translation_test_runner.py"
ARCHITECTURE_TESTS = tuple(Path(__file__).resolve().parent / "tests" / name for name in (
    "test_translation_field_writer_gate.py", "test_translation_layer_gate.py",
))
BENCHMARK_CATEGORIES = ("tooling", "contracts", "integration")


def benchmark_modules() -> dict[str, list[Path]]:
    """Fail closed on misplaced tests; helpers and conftest are not test modules."""
    root = SUITES["benchmarks"]
    classified = {category: [] for category in BENCHMARK_CATEGORIES}
    for path in sorted(root.parent.rglob("test_*.py")):
        if not path.is_relative_to(root):
            raise ValueError(f"Unclassified benchmark test: {path}")
        parts = path.relative_to(root).parts
        if len(parts) < 2 or parts[0] not in classified:
            raise ValueError(f"Unclassified benchmark test: {path}")
        classified[parts[0]].append(path)
    for category, modules in classified.items():
        if not modules:
            raise ValueError(f"Missing or empty benchmark category: {root / category}")
    return classified


def collect_nodeids(targets: list[Path], output_root: str) -> list[str]:
    # A child plugin returns canonical paths regardless of pytest's chosen rootdir.
    # Only collection runs here: never recursively execute the runner's own tests.
    program = '''import json,sys,pytest
class Capture:
    def pytest_collection_finish(self, session):
        rows = [str(item.path.resolve()) + "::" + item.nodeid.split("::", 1)[1] for item in session.items]
        print("RETAIN_DISCOVERY=" + json.dumps(rows))
raise SystemExit(pytest.main([*sys.argv[1:], "--collect-only", "-q"], plugins=[Capture()]))
'''
    result = subprocess.run(
        [sys.executable, "-c", program, *map(str, targets)], cwd=SERVICES,
        env=test_environment(output_root), capture_output=True, text=True, timeout=300,
    )
    if result.returncode:
        raise ValueError(f"Benchmark collection failed (exit {result.returncode}): {result.stderr or result.stdout}")
    rows = [line.removeprefix("RETAIN_DISCOVERY=") for line in result.stdout.splitlines()
            if line.startswith("RETAIN_DISCOVERY=")]
    if len(rows) != 1:
        raise ValueError("Benchmark collection did not report exactly one item list")
    return json.loads(rows[0])


def check_discovery(output_root: str) -> None:
    classified = benchmark_modules()
    modules = [path for paths in classified.values() for path in paths]
    forward = collect_nodeids([SUITES["benchmarks"]], output_root)
    reverse = collect_nodeids(sorted(modules, reverse=True), output_root)
    if len(forward) != len(set(forward)) or len(reverse) != len(set(reverse)):
        raise ValueError("Benchmark collection contains duplicate items")
    if set(forward) != set(reverse):
        raise ValueError("Forward/reverse benchmark collection differs")
    discovered_modules = {node.split("::", 1)[0] for node in forward}
    expected_modules = {str(path.resolve()) for path in modules}
    if discovered_modules != expected_modules:
        raise ValueError(
            "Benchmark modules are uncollected or unexpected: "
            f"missing={sorted(expected_modules - discovered_modules)}, "
            f"unexpected={sorted(discovered_modules - expected_modules)}"
        )
    category_items = []
    for category in BENCHMARK_CATEGORIES:
        category_items.extend(collect_nodeids([SUITES["benchmarks"] / category], output_root))
    if len(category_items) != len(set(category_items)) or set(category_items) != set(forward):
        raise ValueError("Benchmark category collection union differs from full collection")
    print(f"Benchmark discovery verified: {len(modules)} modules, {len(forward)} items")


def test_environment(output_root: str) -> dict[str, str]:
    """Keep runtime essentials, never inherit live provider/executor settings."""
    allowed = {
        "PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "COMSPEC",
        "PATHEXT", "APPDATA", "LOCALAPPDATA", "TMP", "TEMP", "TMPDIR",
        "LANG", "LC_ALL", "TYPST_BIN",
    }
    environment = {key: value for key, value in os.environ.items() if key.upper() in allowed}
    environment.update(
        PYTHONPATH=str(SERVICES / "pipeline"),
        PYTHONNOUSERSITE="1",
        OUTPUT_ROOT=output_root,
    )
    return environment


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=("all", *SUITES, "tooling"), default="all")
    parser.add_argument("--reverse", action="store_true", help="Reverse test file order (not test order within each file).")
    parser.add_argument("--collect-only", action="store_true")
    parser.add_argument("--check-discovery", action="store_true", help="Only audit benchmark collection: forward/reverse and category union; never execute test bodies.")
    args = parser.parse_args(argv)
    if args.check_discovery:
        with tempfile.TemporaryDirectory(prefix="retainpdf-discovery-") as output_root:
            try:
                check_discovery(output_root)
                return 0
            except ValueError as error:
                parser.error(str(error))
            except subprocess.TimeoutExpired:
                print("Benchmark discovery exceeded 300 seconds.", file=sys.stderr)
                return 124
    directories = (list(SUITES.values()) if args.suite == "all" else
                   [SUITES["benchmarks"] / "tooling"] if args.suite == "tooling" else [SUITES[args.suite]])
    missing = [str(directory) for directory in directories if not directory.is_dir()]
    if missing:
        parser.error("Missing test directories: " + ", ".join(missing))
    if args.suite in {"all", "benchmarks", "tooling"}:
        try:
            benchmark_modules()
        except ValueError as error:
            parser.error(str(error))
    targets = [str(directory) for directory in directories]
    if args.reverse:
        targets = [str(path) for path in sorted(
            (path for directory in directories for path in directory.rglob("test_*.py")),
            reverse=True,
        )]
        if not targets:
            parser.error("No test files found in the selected suites")
    if args.suite == "all":
        targets.append(str(RUNNER_TEST))
    if args.suite in {"all", "translation"}:
        missing_gates = [str(path) for path in ARCHITECTURE_TESTS if not path.is_file()]
        if missing_gates:
            parser.error("Missing architecture regression tests: " + ", ".join(missing_gates))
        targets.extend(map(str, ARCHITECTURE_TESTS))
        if args.reverse:
            targets.sort(reverse=True)
    command = [sys.executable, "-m", "pytest", *targets, "-q", "--durations=12"]
    if args.collect_only:
        command.append("--collect-only")
    # Isolate default translation/domain/render caches as well as test fixtures.
    with tempfile.TemporaryDirectory(prefix="retainpdf-offline-tests-") as output_root:
        try:
            return subprocess.run(command, cwd=SERVICES, env=test_environment(output_root), timeout=300).returncode
        except subprocess.TimeoutExpired:
            print("Offline translation tests exceeded 300 seconds.", file=sys.stderr)
            return 124


if __name__ == "__main__":
    raise SystemExit(main())
