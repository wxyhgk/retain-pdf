from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request
from urllib.request import urlopen


DEFAULT_BASE_URL = (
    os.environ.get("RETAIN_PDF_BACKEND_URL", "").strip()
    or os.environ.get("RUST_API_BASE_URL", "").strip()
    or "http://127.0.0.1:41000"
)
DEFAULT_API_KEY = (
    os.environ.get("RETAIN_PDF_BACKEND_KEY", "").strip()
    or os.environ.get("RUST_API_KEY", "").strip()
    or "retain-pdf-desktop"
)


def _make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Query translation debug endpoints from the local Rust API.",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Rust API base URL.")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Rust API X-API-Key.")
    parser.add_argument("--timeout", type=float, default=60.0, help="Request timeout in seconds.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    diagnostics = subparsers.add_parser("diagnostics", help="Fetch translation diagnostics summary.")
    diagnostics.add_argument("--job-id", required=True)

    items = subparsers.add_parser("items", help="List translation debug index items.")
    items.add_argument("--job-id", required=True)
    items.add_argument("--limit", type=int, default=20)
    items.add_argument("--offset", type=int, default=0)
    items.add_argument("--page", type=int, default=None)
    items.add_argument("--final-status", default="")
    items.add_argument("--error-type", default="")
    items.add_argument("--route", default="")
    items.add_argument("--q", default="")

    item = subparsers.add_parser("item", help="Fetch one saved translation item payload.")
    item.add_argument("--job-id", required=True)
    item.add_argument("--item-id", required=True)

    replay = subparsers.add_parser("replay", help="Replay one translation item through current code.")
    replay.add_argument("--job-id", required=True)
    replay.add_argument("--item-id", required=True)

    return parser


def _query_dict(args: argparse.Namespace) -> dict[str, str]:
    query: dict[str, str] = {
        "limit": str(args.limit),
        "offset": str(args.offset),
    }
    if args.page is not None:
        query["page"] = str(args.page)
    if str(args.final_status or "").strip():
        query["final_status"] = str(args.final_status).strip()
    if str(args.error_type or "").strip():
        query["error_type"] = str(args.error_type).strip()
    if str(args.route or "").strip():
        query["route"] = str(args.route).strip()
    if str(args.q or "").strip():
        query["q"] = str(args.q).strip()
    return query


def _request_json(
    *,
    method: str,
    base_url: str,
    api_key: str,
    path: str,
    timeout: float,
    query: dict[str, str] | None = None,
) -> dict:
    base = base_url.rstrip("/")
    url = f"{base}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"
    request = Request(
        url,
        method=method.upper(),
        headers={
            "Accept": "application/json",
            "X-API-Key": api_key,
            "User-Agent": "retain-pdf-translation-debug-api",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {exc.reason}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"request failed: {exc.reason}") from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"invalid JSON response: {exc}") from exc
    if not isinstance(data, dict):
        raise RuntimeError("unexpected API response shape")
    return data


def _run(args: argparse.Namespace) -> dict:
    if args.command == "diagnostics":
        return _request_json(
            method="GET",
            base_url=args.base_url,
            api_key=args.api_key,
            path=f"/api/v1/jobs/{args.job_id}/translation/diagnostics",
            timeout=args.timeout,
        )
    if args.command == "items":
        return _request_json(
            method="GET",
            base_url=args.base_url,
            api_key=args.api_key,
            path=f"/api/v1/jobs/{args.job_id}/translation/items",
            timeout=args.timeout,
            query=_query_dict(args),
        )
    if args.command == "item":
        return _request_json(
            method="GET",
            base_url=args.base_url,
            api_key=args.api_key,
            path=f"/api/v1/jobs/{args.job_id}/translation/items/{args.item_id}",
            timeout=args.timeout,
        )
    if args.command == "replay":
        return _request_json(
            method="POST",
            base_url=args.base_url,
            api_key=args.api_key,
            path=f"/api/v1/jobs/{args.job_id}/translation/items/{args.item_id}/replay",
            timeout=args.timeout,
        )
    raise RuntimeError(f"unsupported command: {args.command}")


def main() -> int:
    parser = _make_parser()
    args = parser.parse_args()
    payload = _run(args)
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
