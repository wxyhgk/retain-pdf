"""Keep the daily offline gate and optional order check distinct from live evals."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
ENTRY = '$RETAIN_PDF_SERVICES_ROOT/pipeline/devtools/run_translation_tests.py'


def test_daily_gate_uses_full_offline_entry_and_keeps_stage_tests():
    workflow = (ROOT / ".github/workflows/tests.yml").read_text()
    assert f'python "{ENTRY}"' in workflow
    assert ENTRY + '" --reverse' not in workflow
    assert "pipeline/devtools/tests/translation/test_" not in workflow
    # pipeline 测试拆成互补的两步：装 typst 前跑 not needs_typst，装 typst 后
    # 只补 needs_typst。两步 -m 互为补集，合起来必须仍是全集。
    pipeline_tests = '"$RETAIN_PDF_SERVICES_ROOT/pipeline/devtools/tests" -q'
    assert pipeline_tests + ' -m "not needs_typst"' in workflow
    assert pipeline_tests + " -m needs_typst\n" in workflow
    hermetic = workflow.index(pipeline_tests + ' -m "not needs_typst"')
    typst_setup = workflow.index("uses: ./.github/actions/setup-test-typst")
    integration = workflow.index(pipeline_tests + " -m needs_typst\n")
    assert hermetic < typst_setup < integration
    assert "uses: ./.github/actions/setup-test-typst" in workflow


def test_order_check_is_manual_and_never_starts_live_evaluation():
    workflow = (ROOT / ".github/workflows/translation-offline.yml").read_text()
    assert "workflow_dispatch: {}" in workflow
    assert "pull_request:" not in workflow
    assert "schedule:" not in workflow
    assert f'python "{ENTRY}" --reverse' in workflow
    for live_marker in ("secrets.", "promptfoo", "live_smoke", "--run", "translation-replay"):
        assert live_marker not in workflow
    assert "--locked --all-extras" in workflow
    assert "uses: ./.github/actions/setup-test-typst" in workflow


def test_formula_runtime_matches_repository_version():
    action = (ROOT / ".github/actions/setup-test-typst/action.yml").read_text()
    sample = (ROOT / ".github/workflows/translate-sample-pdf.yml").read_text()
    assert 'TYPST_VERSION: "0.15.1"' in sample
    assert "/download/v0.15.1/" in action
    assert "curl --fail" in action
    assert '"$GITHUB_ENV"' in action
    assert "TYPST_BIN=" in action


def test_rust_architecture_filters_cover_shared_workspace_dependencies():
    workflow = (ROOT / ".github/workflows/rust-api-architecture.yml").read_text()
    for path in ("backend/api/**", "backend/packages/**", "backend/jobs/**", "database/**", "contracts/**", "Cargo.toml", "Cargo.lock"):
        assert workflow.count(f'- "{path}"') == 2


def test_backend_cargo_commands_use_aggregate_source_root():
    for relative in ("tests.yml", "build-desktop-packages.yml"):
        workflow = (ROOT / ".github/workflows" / relative).read_text()
        cargo_lines = [line for line in workflow.splitlines() if "cargo " in line and "--manifest-path" in line]
        assert cargo_lines
        assert all("RETAIN_PDF_SOURCE_ROOT/Cargo.toml" in line for line in cargo_lines)


def test_docker_backend_build_uses_aggregate_source_context():
    workflow = (ROOT / ".github/workflows/build-docker-images.yml").read_text()
    assert 'context=${{ steps.backend.outputs.source_root }}' in workflow
    assert 'file=${{ steps.backend.outputs.source_root }}/ops/deployment/docker/backend/Dockerfile.app' in workflow
