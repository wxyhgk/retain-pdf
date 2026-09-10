from __future__ import annotations

import hashlib
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .contracts import LiveE2EError, Options, StackHandle
from .pdf_check import multipart_pdf, operation_id, verify_candidate
from .transport import request_json

SCHEMA = "retainpdf_agent_live_e2e_v1"
RECOVERY_SCHEMA = "retainpdf_agent_restart_recovery_e2e_v1"
EXPECTED_RUNTIME = "vercel-fx-acp-v1"


def seed_document_and_conversation(
    stack: StackHandle,
    options: Options,
) -> tuple[str, str]:
    fixture_bytes = options.fixture.read_bytes()
    document_id = hashlib.sha256(fixture_bytes).hexdigest()
    multipart, content_type = multipart_pdf(options.fixture)
    request_json(
        "POST",
        f"{stack.api_url}/api/v1/uploads",
        stack.api_key,
        body=multipart,
        content_type=content_type,
        timeout=30,
    )
    conversation = request_json(
        "POST",
        f"{stack.api_url}/api/v1/ai/conversations",
        stack.api_key,
        payload={"title": "FX live PDF acceptance", "document_id": document_id},
    )
    conversation_id = str((conversation.get("data") or {}).get("conversation_id") or "")
    if not conversation_id:
        raise LiveE2EError("conversation creation returned no id")
    return document_id, conversation_id


def ask_agent(
    stack: StackHandle,
    *,
    document_id: str,
    conversation_id: str,
    question: str,
    confirmed: bool,
    timeout: float,
) -> dict[str, Any]:
    answer = request_json(
        "POST",
        f"{stack.api_url}/api/v1/ai/ask",
        stack.api_key,
        payload={
            "question": question,
            "document_id": document_id,
            "conversation_id": conversation_id,
            "confirm_document_operation": confirmed,
            "stream": False,
        },
        timeout=timeout,
    )
    answer_data = answer.get("data") or {}
    if answer_data.get("agent_runtime") != EXPECTED_RUNTIME:
        raise LiveE2EError("AI response did not come from the pinned FX runtime")
    if not answer_data.get("persisted"):
        raise LiveE2EError("AI response was not persisted")
    return answer_data


def get_operation(stack: StackHandle, operation_id_value: str) -> dict[str, Any]:
    operation = request_json(
        "GET",
        f"{stack.api_url}/api/v1/internal/agent/operations/{operation_id_value}",
        stack.api_key,
    )
    return operation.get("data") or {}


def wait_operation_status(
    stack: StackHandle,
    operation_id_value: str,
    target: str,
    *,
    timeout: float = 60.0,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    last: dict[str, Any] = {}
    while time.monotonic() < deadline:
        last = get_operation(stack, operation_id_value)
        status = str(last.get("status") or "")
        if status == target:
            return last
        if status in {"failed", "ambiguous", "cancelled", "committed"}:
            raise LiveE2EError(
                f"operation reached {status or 'unknown'} while waiting for {target}"
            )
        time.sleep(0.25)
    raise LiveE2EError(
        f"operation did not reach {target} before timeout; last={last.get('status') or 'unknown'}"
    )


def conversation_snapshot(
    stack: StackHandle,
    conversation_id: str,
) -> dict[str, Any]:
    response = request_json(
        "GET",
        f"{stack.api_url}/api/v1/ai/conversations/{conversation_id}",
        stack.api_key,
    )
    return response.get("data") or {}


def runtime_session_snapshot(
    stack: StackHandle,
    conversation_id: str,
) -> dict[str, Any]:
    response = request_json(
        "GET",
        f"{stack.api_url}/api/v1/internal/agent/runtime-sessions/{conversation_id}",
        stack.api_key,
    )
    return response.get("data") or {}


def exercise_commit(
    stack: StackHandle,
    options: Options,
    data_root: Path,
) -> dict[str, Any]:
    document_id, conversation_id = seed_document_and_conversation(stack, options)
    answer_data = ask_agent(
        stack,
        document_id=document_id,
        conversation_id=conversation_id,
        question=(
            "Use retainpdf-agent to preserve every source page in its original order, "
            "insert exactly one extra copy of page 1 immediately after the original page "
            "1, and rotate only that inserted copy by 90 degrees. The select_pages step "
            "must retain all source pages. Run the operation, wait until it is "
            "result_ready, and commit it. This exact document operation is explicitly "
            "confirmed. Do not only explain."
        ),
        confirmed=True,
        timeout=options.turn_timeout + 30,
    )
    operation_id_value = operation_id(data_root)
    operation_data = get_operation(stack, operation_id_value)
    candidate = verify_candidate(data_root, operation_data, options.fixture)
    return {
        "schema": SCHEMA,
        "ok": True,
        "runtime": EXPECTED_RUNTIME,
        "document_id": document_id,
        "conversation_id": conversation_id,
        "operation_id": operation_id_value,
        "operation_status": operation_data.get("status"),
        "candidate": candidate,
        "tool_events": len(answer_data.get("tool_trace") or []),
    }


def create_recovery_draft(
    stack: StackHandle,
    options: Options,
    data_root: Path,
) -> dict[str, Any]:
    document_id, conversation_id = seed_document_and_conversation(stack, options)
    answer = ask_agent(
        stack,
        document_id=document_id,
        conversation_id=conversation_id,
        question=(
            "Use retainpdf-agent to create exactly one operation that preserves every "
            "source page in its original order, inserts exactly one extra copy of page 1 "
            "immediately after the original page 1, and rotates only that inserted copy "
            "by 90 degrees. The select_pages step must retain all source pages. Create it "
            "only: do not run or commit it. Report the operation id so it can be resumed "
            "after a restart."
        ),
        confirmed=False,
        timeout=options.turn_timeout + 30,
    )
    operation_id_value = operation_id(data_root)
    created = get_operation(stack, operation_id_value)
    if (
        created.get("status") != "draft"
        or int(created.get("current_attempt") or 0) != 1
    ):
        raise LiveE2EError("recovery phase one did not leave one draft attempt")
    conversation = conversation_snapshot(stack, conversation_id)
    if int(conversation.get("message_count") or 0) != 2:
        raise LiveE2EError(
            "phase-one conversation did not persist exactly two messages"
        )
    runtime_session = runtime_session_snapshot(stack, conversation_id)
    cursor = str(runtime_session.get("session_cursor") or "")
    revision = int(runtime_session.get("revision") or 0)
    if (
        runtime_session.get("runtime_id") != EXPECTED_RUNTIME
        or not cursor
        or revision < 1
    ):
        raise LiveE2EError("phase-one FX runtime cursor was not durably stored")
    return {
        "document_id": document_id,
        "conversation_id": conversation_id,
        "operation_id": operation_id_value,
        "request_message_id": str(created.get("request_message_id") or ""),
        "current_attempt": 1,
        "session_cursor": cursor,
        "session_revision": revision,
        "phase_one_tool_events": len(answer.get("tool_trace") or []),
    }


def exercise_recovery_phase_one(
    stack: StackHandle,
    options: Options,
    data_root: Path,
) -> dict[str, Any]:
    recovery = create_recovery_draft(stack, options, data_root)
    operation_id_value = str(recovery["operation_id"])
    request_json(
        "POST",
        f"{stack.api_url}/api/v1/internal/agent/operations/{operation_id_value}/run",
        stack.api_key,
        payload={
            "schema": "document_operation_run_v1",
            "idempotency_key": "restart-recovery-run-v1",
            "confirmed": True,
        },
    )
    ready = wait_operation_status(
        stack,
        operation_id_value,
        "result_ready",
        timeout=min(max(options.turn_timeout, 30.0), 180.0),
    )
    if int(ready.get("current_attempt") or 0) != 1:
        raise LiveE2EError("operation attempt changed before restart")
    candidate = ready.get("candidate_version") or {}
    if candidate.get("status") != "candidate":
        raise LiveE2EError("result_ready operation has no durable candidate")
    if str(ready.get("request_message_id") or "") != recovery["request_message_id"]:
        raise LiveE2EError("operation request identity changed before restart")
    return recovery


def exercise_recovery_phase_two(
    stack: StackHandle,
    options: Options,
    data_root: Path,
    recovery: Mapping[str, Any],
) -> dict[str, Any]:
    document_id = str(recovery["document_id"])
    conversation_id = str(recovery["conversation_id"])
    operation_id_value = str(recovery["operation_id"])
    if operation_id(data_root) != operation_id_value:
        raise LiveE2EError("restart changed the durable operation identity")
    before = get_operation(stack, operation_id_value)
    if before.get("status") != "result_ready":
        raise LiveE2EError("operation did not survive restart at result_ready")
    if int(before.get("current_attempt") or 0) != int(recovery["current_attempt"]):
        raise LiveE2EError("operation attempt changed across restart")
    if str(before.get("request_message_id") or "") != recovery["request_message_id"]:
        raise LiveE2EError("operation request identity changed across restart")
    conversation_before = conversation_snapshot(stack, conversation_id)
    if int(conversation_before.get("message_count") or 0) != 2:
        raise LiveE2EError("conversation history did not survive restart")
    session_before = runtime_session_snapshot(stack, conversation_id)
    if (
        session_before.get("session_cursor") != recovery["session_cursor"]
        or int(session_before.get("revision") or 0) != recovery["session_revision"]
    ):
        raise LiveE2EError("FX runtime cursor changed before recovery turn")

    answer = ask_agent(
        stack,
        document_id=document_id,
        conversation_id=conversation_id,
        question=(
            "Continue the existing PDF operation from before the backend restart. "
            "Use retainpdf-agent to get its current state and commit that same operation. "
            "Do not create or run another operation. This commit is explicitly confirmed."
        ),
        confirmed=True,
        timeout=options.turn_timeout + 30,
    )
    committed = get_operation(stack, operation_id_value)
    if committed.get("status") != "committed":
        raise LiveE2EError("recovery turn did not commit the existing operation")
    if int(committed.get("current_attempt") or 0) != 1:
        raise LiveE2EError("recovery turn created a duplicate attempt")
    if operation_id(data_root) != operation_id_value:
        raise LiveE2EError("recovery turn created a duplicate operation")

    replay = (
        request_json(
            "POST",
            f"{stack.api_url}/api/v1/internal/agent/operations/{operation_id_value}/commit",
            stack.api_key,
            payload={
                "schema": "document_operation_commit_v1",
                "idempotency_key": "restart-recovery-commit-response-replay-v1",
            },
        ).get("data")
        or {}
    )
    if (
        replay.get("status") != "committed"
        or replay.get("idempotent_replay") is not True
    ):
        raise LiveE2EError("lost commit response replay was not idempotent")

    conversation_after = conversation_snapshot(stack, conversation_id)
    if int(conversation_after.get("message_count") or 0) != 4:
        raise LiveE2EError("recovery conversation did not append exactly one turn")
    session_after = runtime_session_snapshot(stack, conversation_id)
    if (
        session_after.get("session_cursor") != recovery["session_cursor"]
        or int(session_after.get("revision") or 0) != recovery["session_revision"]
    ):
        raise LiveE2EError("FX resumed by replacing its durable session cursor")
    candidate = verify_candidate(data_root, committed, options.fixture)
    return {
        "schema": RECOVERY_SCHEMA,
        "ok": True,
        "runtime": EXPECTED_RUNTIME,
        "document_id": document_id,
        "conversation_id": conversation_id,
        "operation_id": operation_id_value,
        "operation_status": committed.get("status"),
        "current_attempt": committed.get("current_attempt"),
        "operation_count": 1,
        "conversation_messages": conversation_after.get("message_count"),
        "session_revision": session_after.get("revision"),
        "session_cursor_reused": True,
        "commit_replay_idempotent": True,
        "candidate": candidate,
        "tool_events": {
            "before_restart": recovery.get("phase_one_tool_events"),
            "after_restart": len(answer.get("tool_trace") or []),
        },
    }
