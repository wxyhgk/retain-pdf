"""Require a successful Tests run on every publishing path."""
from pathlib import Path
import re

import pytest


WORKFLOWS = Path(__file__).resolve().parents[2] / "workflows"
STATUS_FUNCTIONS = re.compile(r"\b(always|failure|cancelled|success)\(\)")
FALLBACK_CONDITION = "needs.resolve.outputs.mode == 'build'"


def job(workflow: str, name: str) -> str:
    source = (WORKFLOWS / workflow).read_text()
    match = re.search(rf"^  {re.escape(name)}:\n(.*?)(?=^  [\w-]+:|\Z)", source, re.M | re.S)
    assert match is not None, f"missing {name} in {workflow}"
    return match.group(1)


def job_condition(job_text: str) -> str | None:
    folded = re.search(r"^    if: >-\n((?:      [^\n]+\n)+)", job_text, re.M)
    if folded:
        return " ".join(folded.group(1).split())
    match = re.search(r"^    if: (.+)$", job_text, re.M)
    return match.group(1) if match else None


def assert_cannot_bypass_success(job_text: str) -> None:
    """job 级 if 可以比较 outputs，但不能带状态函数（always() 等会绕过 needs 的
    success() 判定），也不能 continue-on-error。"""
    condition = job_condition(job_text)
    if condition is not None:
        assert STATUS_FUNCTIONS.search(condition) is None, condition
    assert re.search(r"^    continue-on-error:", job_text, re.M) is None


@pytest.mark.parametrize("workflow", [
    "publish-current-web.yml", "release-desktop.yml", "release-docker.yml",
])
def test_publish_workflows_require_complete_tests(workflow):
    gate = job(workflow, "quality-gate")
    assert "uses: ./.github/workflows/tests.yml" in gate
    assert "secrets: inherit" not in gate
    condition = job_condition(gate)
    if workflow == "publish-current-web.yml":
        assert condition == "github.event_name == 'workflow_dispatch'"
    else:
        expected = FALLBACK_CONDITION
        if workflow == "release-docker.yml":
            expected += " && github.event_name != 'pull_request'"
        assert condition == expected
        assert re.search(r"^    needs: resolve$", gate, re.M)
        assert "tested-main-run-id: ${{ needs.resolve.outputs.tests_run_id }}" in gate
        assert "tests_run_id: ${{ steps.find.outputs.tests_run_id }}" in job(workflow, "resolve")
    assert re.search(r"^    continue-on-error:", gate, re.M) is None


def test_web_publication_requires_the_gate_for_its_event():
    tested_push = job("publish-current-web.yml", "tested-push")
    assert job_condition(tested_push) == "github.event_name == 'push'"
    assert "actions: read" in tested_push
    assert "python3 .github/scripts/wait_for_tests.py" in tested_push
    assert "continue-on-error:" not in tested_push
    publish = job("publish-current-web.yml", "publish-web")
    assert "needs: [tested-push, quality-gate]" in publish
    assert job_condition(publish) == (
        "!cancelled() && "
        "((github.event_name == 'push' && needs.tested-push.result == 'success') || "
        "(github.event_name == 'workflow_dispatch' && needs.quality-gate.result == 'success'))"
    )


def test_docker_build_only_accepts_skipped_gate_on_pull_requests():
    build = job("release-docker.yml", "build")
    assert "needs: [quality-gate, prepare, resolve]" in build
    assert "continue-on-error:" not in build
    assert job_condition(build) == (
        "!cancelled() && needs.resolve.result == 'success' && needs.prepare.result == 'success' && "
        f"{FALLBACK_CONDITION} && "
        "(needs.quality-gate.result == 'success' || "
        "(github.event_name == 'pull_request' && needs.quality-gate.result == 'skipped'))"
    )


def test_docker_publish_waits_for_the_gated_build():
    publish = job("release-docker.yml", "publish")
    assert re.search(r"^    needs: \[quality-gate, prepare, build\]$", publish, re.M)
    assert_cannot_bypass_success(publish)


DESKTOP_BUILD_JOBS = ("build-windows-release", "build-linux-release", "build-macos-release")


def test_desktop_builds_run_in_parallel_but_publish_waits_for_tests():
    """桌面端 build 与 quality-gate 并行跑（省掉干等测试的几分钟），门禁收在
    发布 job：它必须同时 needs quality-gate 和 build，且 job 级 if 不能带状态函数
    绕过 success()。build 只产出 workflow 内 artifact，不得引用 secret，否则
    「未过测试先构建」就不再无害。"""
    publish = job("release-desktop.yml", "publish-desktop-release")
    needs = re.search(r"^    needs:\n((?:      - [\w-]+\n)+)", publish, re.M)
    assert needs is not None
    listed = set(re.findall(r"- ([\w-]+)", needs.group(1)))
    assert listed == {"resolve", "quality-gate", "build", "sign-macos-build"}
    assert job_condition(publish) == FALLBACK_CONDITION
    assert_cannot_bypass_success(publish)

    # Mac 签名（带密钥）必须等测试和打包都过了才跑。
    sign = job("release-desktop.yml", "sign-macos-build")
    sign_needs = re.search(r"^    needs:\n((?:      - [\w-]+\n)+)", sign, re.M)
    assert sign_needs is not None
    assert set(re.findall(r"- ([\w-]+)", sign_needs.group(1))) == {"resolve", "quality-gate", "build"}
    assert job_condition(sign) == FALLBACK_CONDITION
    assert_cannot_bypass_success(sign)

    build = job("release-desktop.yml", "build")
    assert "uses: ./.github/workflows/build-desktop-packages.yml" in build
    assert job_condition(build) == FALLBACK_CONDITION
    assert "secrets" not in build
    # 平台 job 只许按 inputs.platforms 过滤（mac-sign-trial.yml 只打 Mac 用）；发版和预构建不传 platforms，
    # 走默认的三平台，所以三个都一定跑。
    for name in DESKTOP_BUILD_JOBS:
        reusable_build = job("build-desktop-packages.yml", name)
        platform = name.removeprefix("build-").removesuffix("-release")
        conditions = re.findall(r"^    if:(.*)$", reusable_build, re.M)
        assert conditions in ([], [f" contains(inputs.platforms, '{platform}')"]), (name, conditions)
        assert "secrets." not in reusable_build
    source = (WORKFLOWS / "build-desktop-packages.yml").read_text()
    assert "secrets" not in source
    assert 'default: "windows,linux,macos"' in source
    assert "platforms" not in build
    assert "platforms" not in job("prebuild-release-candidates.yml", "desktop")


def test_tests_include_reusable_architecture_gate():
    assert "uses: ./.github/workflows/rust-api-architecture.yml" in job("tests.yml", "architecture")
    source = (WORKFLOWS / "rust-api-architecture.yml").read_text()
    assert "  workflow_call: {}" in source
    assert 'python3 "$RETAIN_PDF_SERVICES_ROOT/api/scripts/check_architecture.py"' in source
    assert 'python3 "$RETAIN_PDF_SERVICES_ROOT/pipeline/devtools/check_pipeline_architecture.py"' in source


@pytest.mark.parametrize("workflow", ["tests.yml", "rust-api-architecture.yml"])
def test_tag_quality_gates_are_not_cancelled_by_other_release_runs(workflow):
    source = (WORKFLOWS / workflow).read_text()
    assert "cancel-in-progress: ${{ github.ref_type != 'tag' }}" in source


def test_docker_matrix_preparation_cannot_skip_the_build():
    """release-docker 的 build 依赖 prepare 产出的平台矩阵；prepare 不能带条件，
    否则它被跳过时 build 也会被跳过，而 publish 挂在 build 后面。"""
    prepare = job("release-docker.yml", "prepare")
    assert re.search(r"^    if:", prepare, re.M) is None
    assert re.search(r"^    continue-on-error:", prepare, re.M) is None
    for downstream in ("build", "publish", "promote"):
        assert re.search(r"^    continue-on-error:", job("release-docker.yml", downstream), re.M) is None
    for downstream in ("build", "merge"):
        assert re.search(r"^    continue-on-error:", job("build-docker-images.yml", downstream), re.M) is None


@pytest.mark.parametrize("workflow", ["release-desktop.yml", "release-docker.yml"])
def test_release_resolve_job_cannot_be_skipped_or_ignored(workflow):
    """resolve 决定走哪条路径。它没有条件、不能 continue-on-error：它失败时
    两条路径都不会运行（发布失败，而不是在没有判定的情况下发布）。"""
    resolve = job(workflow, "resolve")
    assert job_condition(resolve) is None
    assert re.search(r"^    continue-on-error:", resolve, re.M) is None
