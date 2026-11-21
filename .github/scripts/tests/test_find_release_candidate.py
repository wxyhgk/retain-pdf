"""提升判定：只有同 sha、Tests 成功、预构建成功、版本一致、artifact 可用时才 promote。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import urllib.error

import pytest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from find_release_candidate import (  # noqa: E402
    PREBUILD_WORKFLOW,
    TESTS_WORKFLOW,
    decide,
    main,
    required_artifacts,
)
from wait_for_tests import wait_for_push_tests  # noqa: E402


REPO = "wxyhgk/retain-pdf"
SHA = "a" * 40
OTHER_SHA = "b" * 40
NOW = datetime(2026, 10, 7, 12, 0, tzinfo=timezone.utc)


def run(run_id, *, sha=SHA, branch="main", event="push", status="completed", conclusion="success"):
    return {
        "id": run_id,
        "head_sha": sha,
        "head_branch": branch,
        "event": event,
        "status": status,
        "conclusion": conclusion if status == "completed" else None,
    }


def artifact(name, *, expires_in=timedelta(days=5), expired=False):
    return {
        "name": name,
        "expired": expired,
        "expires_at": (NOW + expires_in).isoformat().replace("+00:00", "Z"),
    }


class FakeApi:
    def __init__(self, *, tests=None, prebuild=None, artifacts=None, compare="ahead", script=None):
        # script: list of (tests_runs, prebuild_runs) snapshots returned on successive polls.
        self.snapshots = script or [(tests if tests is not None else [run(11)],
                                     prebuild if prebuild is not None else [run(22)])]
        self.poll = 0
        self.compare = compare
        self.artifacts = artifacts
        self.calls = []

    def get(self, path, params=None):
        self.calls.append((path, params))
        if "/compare/" in path:
            if isinstance(self.compare, Exception):
                raise self.compare
            return {"status": self.compare}
        if path.endswith(f"/workflows/{TESTS_WORKFLOW}/runs"):
            assert params["head_sha"] == SHA
            snapshot = self.snapshots[min(self.poll, len(self.snapshots) - 1)]
            return {"workflow_runs": snapshot[0]}
        if path.endswith(f"/workflows/{PREBUILD_WORKFLOW}/runs"):
            snapshot = self.snapshots[min(self.poll, len(self.snapshots) - 1)]
            self.poll += 1
            return {"workflow_runs": snapshot[1]}
        if path.endswith("/artifacts"):
            run_id = int(path.split("/")[-2])
            if self.artifacts is not None:
                return {"artifacts": self.artifacts}
            return {"artifacts": [artifact(name) for name in required_artifacts(KIND[0], run_id=run_id, sha=SHA)]}
        raise AssertionError(path)


KIND = ["desktop"]


def test_web_gate_only_reuses_a_successful_push_for_the_exact_branch_and_sha():
    api = FakeApi(tests=[
        run(10, sha=OTHER_SHA, branch="master"),
        run(11, branch="main"),
        run(12, branch="master", event="pull_request"),
        run(13, branch="master"),
    ])
    assert wait_for_push_tests(api, repo=REPO, sha=SHA, branch="master") == 13


@pytest.mark.parametrize("conclusion", ["failure", "cancelled", "skipped"])
def test_web_gate_blocks_publication_when_tests_do_not_pass(conclusion):
    api = FakeApi(tests=[run(10, conclusion=conclusion)])
    with pytest.raises(RuntimeError, match="Tests failed"):
        wait_for_push_tests(api, repo=REPO, sha=SHA, branch="main")


def test_web_gate_waits_for_the_matching_tests_run():
    clock = Clock()
    api = FakeApi(tests=[])

    def poll(seconds):
        clock.sleep(seconds)
        runs, _ = api.snapshots[0]
        if not runs:
            runs.append(run(10, status="in_progress"))
        else:
            runs[0] = run(10)

    assert wait_for_push_tests(
        api, repo=REPO, sha=SHA, branch="main", now=clock.now, sleep=poll
    ) == 10
    assert len(api.calls) == 3


def test_web_gate_times_out_when_only_another_commit_passed():
    clock = Clock()
    api = FakeApi(tests=[run(10, sha=OTHER_SHA)])
    with pytest.raises(RuntimeError, match="Timed out waiting for Tests"):
        wait_for_push_tests(
            api, repo=REPO, sha=SHA, branch="main", now=clock.now, sleep=clock.sleep
        )


class Clock:
    def __init__(self):
        self.t = NOW.timestamp()

    def now(self):
        return self.t

    def sleep(self, seconds):
        self.t += seconds


def call(api, *, kind="desktop", tag="v4.2.7", declared="4.2.7", event="push", ref_type="tag", clock=None, **kw):
    KIND[0] = kind
    clock = clock or Clock()
    return decide(
        api,
        kind=kind,
        repo=REPO,
        sha=SHA,
        tag=tag,
        event_name=event,
        ref_type=ref_type,
        declared_version=declared,
        now=clock.now,
        sleep=clock.sleep,
        **kw,
    )


@pytest.mark.parametrize("kind", ["desktop", "docker"])
def test_promotes_when_every_gate_passes(kind):
    decision = call(FakeApi(), kind=kind)
    assert decision.mode == "promote"
    assert decision.run_id == "22"
    assert decision.tests_run_id == "11"
    assert decision.version == "4.2.7" and decision.tag == "v4.2.7"
    assert decision.stable == "true" and decision.prerelease == "false"


@pytest.mark.parametrize("event,ref_type", [
    ("pull_request", "branch"), ("workflow_dispatch", "branch"), ("push", "branch"), ("workflow_dispatch", "tag"),
])
def test_never_promotes_outside_tag_pushes(event, ref_type):
    api = FakeApi()
    decision = call(api, event=event, ref_type=ref_type)
    assert decision.mode == "build"
    assert "not a tag push" in decision.reason
    assert api.calls == []


def test_version_mismatch_falls_back_without_touching_artifacts():
    api = FakeApi()
    decision = call(api, tag="v4.2.7", declared="4.2.6")
    assert decision.mode == "build"
    assert "4.2.6" in decision.reason and "4.2.7" in decision.reason
    assert decision.tests_run_id == "11"
    assert [path for path, _ in api.calls] == [f"/repos/{REPO}/actions/workflows/{TESTS_WORKFLOW}/runs"]
    # 回退时仍给出 tag 版本，供完整构建使用。
    assert decision.version == "4.2.7"


def test_unaligned_declared_version_falls_back():
    assert call(FakeApi(), declared="").mode == "build"


def test_hotfix_tag_without_aligned_version_falls_back():
    decision = call(FakeApi(), tag="v4.2.2-hotfix-5", declared="4.2.2")
    assert decision.mode == "build"
    assert decision.prerelease == "true"


def test_invalid_tag_fails_loudly():
    with pytest.raises(ValueError):
        call(FakeApi(), tag="release-candidate")


@pytest.mark.parametrize("status", ["behind", "diverged"])
def test_commit_not_on_main_falls_back(status):
    decision = call(FakeApi(compare=status))
    assert decision.mode == "build"
    assert "not on main" in decision.reason


def test_identical_to_main_is_on_main():
    assert call(FakeApi(compare="identical")).mode == "promote"


def test_failed_tests_block_promotion_even_with_a_good_prebuild():
    decision = call(FakeApi(tests=[run(11, conclusion="failure")]))
    assert decision.mode == "build"
    assert decision.tests_run_id == ""
    assert "Tests workflow did not succeed" in decision.reason


def test_failed_prebuild_falls_back():
    decision = call(FakeApi(prebuild=[run(22, conclusion="cancelled")]))
    assert decision.mode == "build"
    assert "prebuild workflow did not succeed" in decision.reason


def test_runs_for_other_commits_branches_or_events_are_ignored():
    foreign = [
        run(30, sha=OTHER_SHA),
        run(31, branch="feature"),
        run(32, event="pull_request"),
    ]
    clock = Clock()
    decision = call(FakeApi(tests=[run(11)], prebuild=foreign), clock=clock, appear_grace_seconds=120)
    assert decision.mode == "build"
    assert "no prebuild run" in decision.reason
    assert decision.tests_run_id == "11"
    assert clock.t == NOW.timestamp()


def test_tests_triggered_outside_push_do_not_count():
    decision = call(FakeApi(tests=[run(11, event="workflow_dispatch")]), appear_grace_seconds=60)
    assert decision.mode == "build"
    assert "no Tests run" in decision.reason
    assert decision.tests_run_id == ""


def test_manual_prebuild_on_main_counts():
    assert call(FakeApi(prebuild=[run(40, event="workflow_dispatch")])).run_id == "40"


def test_latest_successful_prebuild_wins_over_older_and_failed_runs():
    api = FakeApi(prebuild=[run(20), run(25), run(27, conclusion="failure")])
    assert call(api).run_id == "25"


def test_waits_for_in_progress_runs_then_promotes():
    api = FakeApi(script=[
        ([run(11, status="in_progress")], [run(22, status="queued")]),
        ([run(11)], [run(22, status="in_progress")]),
        ([run(11)], [run(22)]),
    ])
    clock = Clock()
    decision = call(api, clock=clock, poll_seconds=60)
    assert decision.mode == "promote"
    assert clock.t - NOW.timestamp() == 120


def test_release_build_without_prebuild_does_not_reuse_pending_main_tests():
    decision = call(FakeApi(tests=[run(11, status="in_progress")], prebuild=[]))
    assert decision.mode == "build"
    assert decision.tests_run_id == ""


def test_gives_up_waiting_after_the_deadline():
    api = FakeApi(tests=[run(11)], prebuild=[run(22, status="in_progress")])
    decision = call(api, wait_seconds=600, poll_seconds=60)
    assert decision.mode == "build"
    assert "timed out" in decision.reason


def test_missing_artifact_falls_back():
    names = required_artifacts("desktop", run_id=22, sha=SHA)
    api = FakeApi(artifacts=[artifact(name) for name in names[1:]])
    decision = call(api)
    assert decision.mode == "build"
    assert f"artifact {names[0]} is missing" in decision.reason


@pytest.mark.parametrize("kwargs", [{"expired": True}, {"expires_in": timedelta(minutes=30)}])
def test_expired_or_expiring_artifact_falls_back(kwargs):
    names = required_artifacts("docker", run_id=22, sha=SHA)
    api = FakeApi(artifacts=[artifact(names[0], **kwargs), artifact(names[1])])
    decision = call(api, kind="docker")
    assert decision.mode == "build"
    assert "expired" in decision.reason


def test_artifacts_are_named_after_the_tagged_sha_and_run():
    assert required_artifacts("docker", run_id=7, sha=SHA) == ["docker-candidate-app-7", "docker-candidate-web-7"]
    desktop = required_artifacts("desktop", run_id=7, sha=SHA)
    assert f"desktop-macos-{SHA}" in desktop and f"desktop-meta-windows-{SHA}" in desktop
    with pytest.raises(ValueError):
        required_artifacts("snap", run_id=7, sha=SHA)


def test_api_errors_fall_back_instead_of_promoting():
    api = FakeApi(compare=urllib.error.URLError("boom"))
    decision = call(api)
    assert decision.mode == "build"
    assert "could not verify" in decision.reason


def test_main_writes_outputs_and_summary(tmp_path, monkeypatch):
    output = tmp_path / "out"
    summary = tmp_path / "summary"
    monkeypatch.setenv("GITHUB_TOKEN", "")
    assert main([
        "--kind", "docker", "--tag", "v4.2.7", "--declared-version", "4.2.7",
        "--event-name", "pull_request", "--ref-type", "branch", "--sha", SHA, "--repo", REPO,
        "--github-output", str(output), "--summary", str(summary),
    ]) == 0
    lines = dict(line.split("=", 1) for line in output.read_text().splitlines())
    assert lines["mode"] == "build"
    assert lines["run_id"] == ""
    assert "回退到完整构建" in summary.read_text()
