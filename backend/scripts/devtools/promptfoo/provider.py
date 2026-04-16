from __future__ import annotations

import io
from contextlib import redirect_stderr
import sys
from pathlib import Path
from typing import Any


PROMPTFOO_DIR = Path(__file__).resolve().parent
SCRIPTS_ROOT = PROMPTFOO_DIR.parents[1]

if str(PROMPTFOO_DIR) not in sys.path:
    sys.path.insert(0, str(PROMPTFOO_DIR))
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from common import load_saved_translation_item
from common import resolve_case_artifact_path
from common import resolve_job_root
from devtools.replay_translation_item import replay_translation_case_artifact
from devtools.replay_translation_item import replay_translation_item


def _vars(context: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(context, dict):
        return {}
    vars_payload = context.get("vars")
    return vars_payload if isinstance(vars_payload, dict) else {}


def _string(value: Any) -> str:
    return str(value or "").strip()


def call_api(prompt: str, options: dict[str, Any] | None = None, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    job_root = _string(vars_payload.get("job_root"))
    item_id = _string(vars_payload.get("item_id"))
    case_artifact = _string(vars_payload.get("case_artifact"))
    resolved_job_root = resolve_job_root(job_root)
    stderr_buffer = io.StringIO()
    with redirect_stderr(stderr_buffer):
        if resolved_job_root.exists():
            payload = replay_translation_item(resolved_job_root, item_id)
        else:
            payload = replay_translation_case_artifact(
                resolve_case_artifact_path(job_root, item_id, case_artifact),
                item_id,
            )
    replay_error = payload.get("replay_error") or {}
    captured_stderr = stderr_buffer.getvalue().strip()
    if replay_error:
        error_type = _string(replay_error.get("type"))
        error_message = _string(replay_error.get("message"))
        if captured_stderr:
            replay_error = dict(replay_error)
            replay_error["stderr"] = captured_stderr
            payload["replay_error"] = replay_error
        return {
            "output": f"__REPLAY_ERROR__ {error_type}: {error_message}".strip(),
            "metadata": payload,
        }
    if captured_stderr:
        payload = dict(payload)
        payload["replay_logs"] = captured_stderr
    replay_result = payload.get("replay_result") or {}
    output = _string(replay_result.get("translated_text"))
    if not output:
        output = _string((payload.get("saved_item") or {}).get("translated_text"))
    if not output:
        output = _string((payload.get("saved_item") or {}).get("source_text"))
    return {
        "output": output,
        "metadata": payload,
    }


def load_saved_output(prompt: str, options: dict[str, Any] | None = None, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    payload = load_saved_translation_item(
        _string(vars_payload.get("job_root")),
        _string(vars_payload.get("item_id")),
        _string(vars_payload.get("case_artifact")),
    )
    item = payload["item"]
    output = _string(item.get("translated_text"))
    if not output:
        output = _string(item.get("source_text"))
    return {
        "output": output,
        "metadata": {
            "job_id": payload["job_id"],
            "item_id": vars_payload.get("item_id"),
            "page_idx": payload["page_idx"],
            "page_path": payload["page_path"],
            "final_status": _string(item.get("final_status")),
            "skip_reason": _string(item.get("skip_reason")),
        },
    }
