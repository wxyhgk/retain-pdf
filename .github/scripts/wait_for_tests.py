"""Wait for the Tests run from the push that triggered Web publication."""
from __future__ import annotations

import os
import time

from find_release_candidate import GitHubApi, TESTS_WORKFLOW, list_workflow_runs, select_workflow_run


def wait_for_push_tests(
    api,
    *,
    repo: str,
    sha: str,
    branch: str,
    now=time.monotonic,
    sleep=time.sleep,
) -> int:
    started = now()
    last_message = ""
    while True:
        runs = list_workflow_runs(api, repo, TESTS_WORKFLOW, sha)
        state, run, detail = select_workflow_run(runs, sha=sha, events={"push"}, branch=branch)
        if state == "success":
            assert run is not None
            return int(run["id"])
        elapsed = now() - started
        if state == "failed":
            raise RuntimeError(f"Tests failed for {branch} at {sha}: {detail}")
        if (state == "missing" and elapsed >= 120) or elapsed >= 45 * 60:
            raise RuntimeError(f"Timed out waiting for Tests on {branch} at {sha}: {detail}")
        message = f"Waiting for Tests on {branch} at {sha}: {detail}"
        if message != last_message:
            print(message, flush=True)
            last_message = message
        sleep(10)


def main() -> None:
    if os.environ["GITHUB_EVENT_NAME"] != "push" or os.environ["GITHUB_REF_TYPE"] != "branch":
        raise SystemExit("Tests reuse requires a branch push")
    repo = os.environ["GITHUB_REPOSITORY"]
    sha = os.environ["GITHUB_SHA"]
    branch = os.environ["GITHUB_REF_NAME"]
    api = GitHubApi(token=os.environ["GITHUB_TOKEN"], api_url=os.environ["GITHUB_API_URL"])
    run_id = wait_for_push_tests(api, repo=repo, sha=sha, branch=branch)
    server = os.environ["GITHUB_SERVER_URL"]
    print(f"Tests passed for {branch} at {sha}: {server}/{repo}/actions/runs/{run_id}")


if __name__ == "__main__":
    main()
