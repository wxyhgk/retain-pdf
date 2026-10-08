"""``retainpdf-pipeline translation-revise``:单块译文修订写回。

由 Rust API 调用。请求体从 stdin 读一个 JSON 对象
(translated_text / source / reason / expected_generation),结果以一个 JSON
对象写到 stdout。可预期的拒绝(找不到、冲突、校验失败)同样以退出码 0 输出,
``outcome`` 字段区分;非零退出码只表示进程本身出错。
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from pathlib import Path

from retainpdf_pipeline.translate.public import RevisionOutcome
from retainpdf_pipeline.translate.public import RevisionRequest
from retainpdf_pipeline.translate.public import revise_translation_item


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="retainpdf-pipeline translation-revise",
        description="Validate and write back one translated item, then advance the translation checkpoint.",
    )
    parser.add_argument("--job-root", required=True, help="Absolute job root containing translated/.")
    parser.add_argument("--item-id", required=True, help="Translation item id, e.g. p003-b004.")
    return parser.parse_args(argv)


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise RevisionOutcome("invalid", "invalid_request", "expected_generation must be an integer")
    return value


def _request_from_stdin(item_id: str) -> RevisionRequest:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as exc:
        raise RevisionOutcome("invalid", "invalid_request", f"request body is not JSON: {exc}") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("translated_text"), str):
        raise RevisionOutcome("invalid", "invalid_request", "translated_text must be a string")
    return RevisionRequest(
        item_id=item_id,
        translated_text=payload["translated_text"],
        source=str(payload.get("source", "") or ""),
        reason=str(payload.get("reason", "") or ""),
        expected_generation=_optional_int(payload.get("expected_generation")),
    )


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    # 校验与写回过程中任何 print 都不能混进 stdout 的结果 JSON。
    with contextlib.redirect_stdout(sys.stderr):
        try:
            result = revise_translation_item(
                Path(args.job_root), _request_from_stdin(str(args.item_id))
            )
        except RevisionOutcome as outcome:
            result = outcome.as_dict()
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
