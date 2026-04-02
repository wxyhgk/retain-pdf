import argparse
import os
import time
from typing import Any
from pathlib import Path

import requests
import sys

sys.path.append(str(Path(__file__).resolve().parents[2]))
from foundation.shared.local_env import get_secret


DEFAULT_BASE_URL = "https://mineru.net/api/v4"
DEFAULT_TOKEN_ENV = "MINERU_API_TOKEN"
DEFAULT_ENV_FILE = "mineru.env"
DEFAULT_MODEL_VERSION = "vlm"
DEFAULT_EXAMPLE_URL = "https://cdn-mineru.openxlab.org.cn/demo/example.pdf"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Minimal MinerU API example: submit and poll a parse task.")
    parser.add_argument(
        "--token",
        type=str,
        default="",
        help=f"MinerU API token. Prefer env {DEFAULT_TOKEN_ENV}.",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=DEFAULT_EXAMPLE_URL,
        help="Publicly accessible file URL to parse.",
    )
    parser.add_argument(
        "--model-version",
        type=str,
        default=DEFAULT_MODEL_VERSION,
        choices=["pipeline", "vlm", "MinerU-HTML"],
        help="MinerU model version.",
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default=DEFAULT_BASE_URL,
        help="MinerU API base URL.",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=3.0,
        help="Seconds between task status polls.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Maximum wait time in seconds for the task to finish.",
    )
    return parser.parse_args()


def get_token(explicit_token: str) -> str:
    token = get_secret(
        explicit_value=explicit_token,
        env_var=DEFAULT_TOKEN_ENV,
        env_file_name=DEFAULT_ENV_FILE,
    )
    if not token:
        raise RuntimeError(f"Missing MinerU token. Set --token, scripts/.env/{DEFAULT_ENV_FILE}, or env {DEFAULT_TOKEN_ENV}.")
    return token


def headers(token: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Authorization": f"Bearer {token}",
    }


def submit_task(base_url: str, token: str, file_url: str, model_version: str) -> dict[str, Any]:
    endpoint = f"{base_url.rstrip('/')}/extract/task"
    payload = {"url": file_url, "model_version": model_version}
    response = requests.post(endpoint, headers=headers(token), json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU submit failed: {data}")
    return data


def fetch_task(base_url: str, token: str, task_id: str) -> dict[str, Any]:
    endpoint = f"{base_url.rstrip('/')}/extract/task/{task_id}"
    response = requests.get(endpoint, headers=headers(token), timeout=60)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != 0:
        raise RuntimeError(f"MinerU task query failed: {data}")
    return data


def poll_task(base_url: str, token: str, task_id: str, poll_interval: float, timeout: int) -> dict[str, Any]:
    started = time.time()
    while True:
        data = fetch_task(base_url, token, task_id)
        task = data.get("data", {})
        state = task.get("state", "")
        print(f"task {task_id}: state={state}")
        if state == "done":
            return data
        if state == "failed":
            raise RuntimeError(f"MinerU task failed: {task.get('err_msg', '') or task}")
        if time.time() - started > timeout:
            raise TimeoutError(f"Timed out waiting for MinerU task {task_id}")
        time.sleep(max(0.5, poll_interval))


def main() -> None:
    args = parse_args()
    token = get_token(args.token)

    submit_data = submit_task(args.base_url, token, args.url, args.model_version)
    task_id = submit_data["data"]["task_id"]
    print(f"submitted task_id={task_id}")

    result_data = poll_task(args.base_url, token, task_id, args.poll_interval, args.timeout)
    result = result_data.get("data", {})
    print(f"done task_id={task_id}")
    if result.get("full_zip_url"):
        print(f"full_zip_url={result['full_zip_url']}")
    if result.get("err_msg"):
        print(f"err_msg={result['err_msg']}")


if __name__ == "__main__":
    main()
