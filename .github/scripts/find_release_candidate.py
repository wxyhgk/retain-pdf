"""Decide whether a release tag can promote main's prebuilt candidates, or must rebuild.

发版 workflow 的第一个 job 调用它，输出 mode=promote|build：

promote 需要同时满足（缺一条就 mode=build，并写明原因，走原来的完整构建）：
1. 本次是 tag push（PR / workflow_dispatch / 分支 push 一律不提升）；
2. tag 版本 == 这个 commit 声明的版本（resolve_declared_version.py）——预构建
   注入的就是声明版本，相等才能保证产物里的版本字符串与 tag 构建一致；
3. tag 指向的 commit 在 main 上（main 是它本身或它的后代）；
4. 该 commit 在 main 上的 push 触发的 Tests workflow 成功；
5. 该 commit 的预构建 workflow 成功；
6. 那次预构建 run 里提升所需的 artifact 都在、没过期（且离过期还有余量）。

已手动触发的预构建还在跑时会等待，默认最多 120 分钟。未触发预构建的标签直接
进入构建路径，有同一提交的 main Tests 成功记录时继续复用该结果。

只会选 head_sha 与本次 tag 完全相同的 run，绝不会拿别的 commit 的产物。
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import time
from typing import Callable
import urllib.error
import urllib.parse
import urllib.request


sys.path.insert(0, str(Path(__file__).resolve().parent))

from resolve_release_version import resolve_release_version  # noqa: E402


TESTS_WORKFLOW = "tests.yml"
PREBUILD_WORKFLOW = "prebuild-release-candidates.yml"
MAIN_BRANCH = "main"
DESKTOP_PLATFORMS = ("windows", "linux", "macos")
PENDING_STATUSES = {"queued", "in_progress", "waiting", "pending", "requested"}


def required_artifacts(kind: str, *, run_id: int, sha: str) -> list[str]:
    if kind == "docker":
        return [f"docker-candidate-app-{run_id}", f"docker-candidate-web-{run_id}"]
    if kind == "desktop":
        return [f"desktop-{platform}-{sha}" for platform in DESKTOP_PLATFORMS] + [
            f"desktop-meta-{platform}-{sha}" for platform in DESKTOP_PLATFORMS
        ]
    raise ValueError(f"unknown candidate kind {kind!r}")


@dataclass
class Decision:
    mode: str
    reason: str
    version: str = ""
    tag: str = ""
    prerelease: str = ""
    stable: str = ""
    run_id: str = ""
    tests_run_id: str = ""
    notes: list[str] = field(default_factory=list)

    def outputs(self) -> dict[str, str]:
        return {
            "mode": self.mode,
            "reason": " ".join(self.reason.split()),
            "version": self.version,
            "tag": self.tag,
            "prerelease": self.prerelease,
            "stable": self.stable,
            "run_id": self.run_id,
            "tests_run_id": self.tests_run_id,
        }


class GitHubApi:
    def __init__(self, *, token: str, api_url: str = "https://api.github.com", retries: int = 3):
        self._token = token
        self._api_url = api_url.rstrip("/")
        self._retries = retries

    def get(self, path: str, params: dict[str, str | int] | None = None) -> dict:
        url = f"{self._api_url}{path}"
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self._token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "retainpdf-release-candidate",
            },
        )
        last_error: Exception | None = None
        for attempt in range(self._retries):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                # 4xx 是确定的结果（权限 / 不存在），重试没有意义。
                if exc.code < 500:
                    raise
                last_error = exc
            except urllib.error.URLError as exc:
                last_error = exc
            time.sleep(2 * (attempt + 1))
        assert last_error is not None
        raise last_error


def list_workflow_runs(api, repo: str, workflow: str, sha: str) -> list[dict]:
    payload = api.get(
        f"/repos/{repo}/actions/workflows/{workflow}/runs",
        {"head_sha": sha, "per_page": 100},
    )
    return list(payload.get("workflow_runs") or [])


def select_workflow_run(
    runs: list[dict], *, sha: str, events: set[str], branch: str = MAIN_BRANCH
) -> tuple[str, dict | None, str]:
    """Return (state, run, detail); state in success / pending / failed / missing."""
    relevant = [
        run
        for run in runs
        if run.get("head_sha") == sha
        and run.get("head_branch") == branch
        and run.get("event") in events
    ]
    if not relevant:
        return "missing", None, "no run"
    successes = [
        run for run in relevant if run.get("status") == "completed" and run.get("conclusion") == "success"
    ]
    if successes:
        return "success", max(successes, key=lambda run: int(run["id"])), ""
    pending = [run for run in relevant if run.get("status") in PENDING_STATUSES]
    if pending:
        return "pending", None, f"run {max(int(run['id']) for run in pending)} still {pending[0].get('status')}"
    latest = max(relevant, key=lambda run: int(run["id"]))
    return "failed", latest, f"run {latest['id']} concluded {latest.get('conclusion')}"


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _check_artifacts(
    api,
    *,
    repo: str,
    run_id: int,
    names: list[str],
    now: Callable[[], float],
    min_ttl_seconds: int,
) -> str:
    """Return an empty string when every artifact is usable, else why not."""
    payload = api.get(f"/repos/{repo}/actions/runs/{run_id}/artifacts", {"per_page": 100})
    by_name: dict[str, list[dict]] = {}
    for artifact in payload.get("artifacts") or []:
        by_name.setdefault(artifact.get("name", ""), []).append(artifact)
    deadline = datetime.fromtimestamp(now() + min_ttl_seconds, tz=timezone.utc)
    for name in names:
        usable = [
            artifact
            for artifact in by_name.get(name, [])
            if not artifact.get("expired")
            and artifact.get("expires_at")
            and _parse_time(artifact["expires_at"]) > deadline
        ]
        if not usable:
            if by_name.get(name):
                return f"artifact {name} of run {run_id} is expired or expires within {min_ttl_seconds // 60} minutes"
            return f"artifact {name} is missing from run {run_id}"
    return ""


def decide(
    api,
    *,
    kind: str,
    repo: str,
    sha: str,
    tag: str,
    event_name: str,
    ref_type: str,
    declared_version: str,
    wait_seconds: int = 120 * 60,
    appear_grace_seconds: int = 5 * 60,
    poll_seconds: int = 60,
    min_artifact_ttl_seconds: int = 2 * 60 * 60,
    now: Callable[[], float] = time.time,
    sleep: Callable[[float], None] = time.sleep,
) -> Decision:
    required_artifacts(kind, run_id=0, sha=sha)  # validates kind early

    if event_name != "push" or ref_type != "tag":
        return Decision("build", f"not a tag push (event={event_name}, ref_type={ref_type}); promotion only runs for release tags")

    release = resolve_release_version(tag)  # invalid tags fail loudly, same as the build path
    decision = Decision(
        "build",
        "",
        version=release["version"],
        tag=release["tag"],
        prerelease=release["prerelease"],
        stable=release["stable"],
    )

    def fallback(reason: str) -> Decision:
        decision.mode = "build"
        decision.reason = reason
        return decision

    try:
        tests_state, tests_run, tests_detail = select_workflow_run(
            list_workflow_runs(api, repo, TESTS_WORKFLOW, sha), sha=sha, events={"push"}
        )
        if tests_run is not None and tests_state == "success":
            decision.tests_run_id = str(tests_run["id"])
        if not declared_version:
            return fallback("this commit does not declare an aligned application version")
        if declared_version != release["version"]:
            return fallback(
                f"tag version {release['version']} != version declared by this commit ({declared_version}); "
                "prebuilt candidates carry the declared version"
            )

        compare = api.get(f"/repos/{repo}/compare/{sha}...{MAIN_BRANCH}")
        if compare.get("status") not in {"ahead", "identical"}:
            return fallback(f"tagged commit {sha} is not on {MAIN_BRANCH} (compare status={compare.get('status')})")

        started = now()
        while True:
            prebuild_state, prebuild_run, prebuild_detail = select_workflow_run(
                list_workflow_runs(api, repo, PREBUILD_WORKFLOW, sha),
                sha=sha,
                events={"push", "workflow_dispatch"},
            )
            elapsed = now() - started
            if prebuild_state == "missing":
                return fallback(f"no prebuild run on {MAIN_BRANCH} for {sha}")
            if tests_state == "failed":
                return fallback(f"Tests workflow did not succeed for {sha}: {tests_detail}")
            if prebuild_state == "failed":
                return fallback(f"prebuild workflow did not succeed for {sha}: {prebuild_detail}")
            if tests_state == "success" and prebuild_state == "success":
                break
            if tests_state == "missing" and elapsed >= appear_grace_seconds:
                return fallback(f"no Tests run on {MAIN_BRANCH} for {sha}")
            if elapsed >= wait_seconds:
                return fallback(
                    f"timed out after {int(elapsed // 60)} minutes waiting for Tests ({tests_state} {tests_detail}) "
                    f"and prebuild ({prebuild_state} {prebuild_detail})"
                )
            print(
                f"waiting: Tests={tests_state} {tests_detail}; prebuild={prebuild_state} {prebuild_detail}",
                flush=True,
            )
            sleep(poll_seconds)
            tests_state, tests_run, tests_detail = select_workflow_run(
                list_workflow_runs(api, repo, TESTS_WORKFLOW, sha), sha=sha, events={"push"}
            )
            decision.tests_run_id = str(tests_run["id"]) if tests_run is not None and tests_state == "success" else ""

        assert tests_run is not None and prebuild_run is not None
        run_id = int(prebuild_run["id"])
        problem = _check_artifacts(
            api,
            repo=repo,
            run_id=run_id,
            names=required_artifacts(kind, run_id=run_id, sha=sha),
            now=now,
            min_ttl_seconds=min_artifact_ttl_seconds,
        )
        if problem:
            return fallback(problem)
    except Exception as exc:  # noqa: BLE001 - any lookup failure must fall back, never promote
        return fallback(f"could not verify prebuilt candidates ({type(exc).__name__}: {exc})")

    decision.mode = "promote"
    decision.run_id = str(run_id)
    decision.tests_run_id = str(tests_run["id"])
    decision.reason = (
        f"promoting prebuild run {run_id} (Tests run {tests_run['id']} succeeded) for {sha} at version {release['version']}"
    )
    return decision


def _write_outputs(path: Path, values: dict[str, str]) -> None:
    with path.open("a", encoding="utf-8") as output:
        for key, value in values.items():
            if "\n" in value or "\r" in value:
                raise ValueError(f"output {key} contains a newline")
            output.write(f"{key}={value}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--kind", required=True, choices=("docker", "desktop"))
    parser.add_argument("--tag", required=True)
    parser.add_argument("--declared-version", default="")
    parser.add_argument("--event-name", default=os.environ.get("GITHUB_EVENT_NAME", ""))
    parser.add_argument("--ref-type", default=os.environ.get("GITHUB_REF_TYPE", ""))
    parser.add_argument("--sha", default=os.environ.get("GITHUB_SHA", ""))
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY", ""))
    parser.add_argument("--api-url", default=os.environ.get("GITHUB_API_URL", "https://api.github.com"))
    parser.add_argument("--wait-minutes", type=int, default=120)
    parser.add_argument(
        "--github-output",
        type=Path,
        default=Path(os.environ["GITHUB_OUTPUT"]) if "GITHUB_OUTPUT" in os.environ else None,
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=Path(os.environ["GITHUB_STEP_SUMMARY"]) if "GITHUB_STEP_SUMMARY" in os.environ else None,
    )
    args = parser.parse_args(argv)

    api = GitHubApi(token=os.environ.get("GITHUB_TOKEN", ""), api_url=args.api_url)
    try:
        decision = decide(
            api,
            kind=args.kind,
            repo=args.repo,
            sha=args.sha,
            tag=args.tag,
            event_name=args.event_name,
            ref_type=args.ref_type,
            declared_version=args.declared_version.strip(),
            wait_seconds=args.wait_minutes * 60,
        )
    except ValueError as exc:
        parser.error(str(exc))

    outputs = decision.outputs()
    print(json.dumps(outputs, indent=2, ensure_ascii=False))
    if args.github_output is not None:
        _write_outputs(args.github_output, outputs)
    if args.summary is not None:
        with args.summary.open("a", encoding="utf-8") as summary:
            title = "提升 main 预构建产物" if decision.mode == "promote" else "回退到完整构建"
            summary.write(f"### {args.kind} 发布：{title}\n\n- 原因：{outputs['reason']}\n")
            if decision.run_id:
                summary.write(f"- 预构建 run：{decision.run_id}\n")
            if decision.tests_run_id:
                summary.write(f"- Tests run：{decision.tests_run_id}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
