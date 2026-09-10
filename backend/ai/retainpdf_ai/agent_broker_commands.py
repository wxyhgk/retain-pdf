"""Pure command parsing and validation for the host-owned Agent broker."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
import shlex
from typing import Any

from .agent_broker_contracts import BrokerCommand, BrokerScope

_MAX_COMMAND_CHARS = 16384
_SAFE_OPERATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_SHA256 = re.compile(r"^[0-9a-fA-F]{64}$")
_CANCEL_REASONS = {"agent_abort", "superseded", "user_cancelled"}
_BASE64URL = re.compile(r"^[A-Za-z0-9_-]+$")
_HOST_TOOL_NAMES = frozenset(
    {
        "list_documents",
        "search_fulltext",
        "read_blocks",
        "search_favorites",
        "search_markdown",
        "read_markdown_chunk",
        "calculate_expression",
        "calculate_statistics",
        "analyze_table",
        "generate_chart",
    }
)


def parse_broker_command(raw_command: str, scope: BrokerScope) -> BrokerCommand:
    if (
        not raw_command
        or len(raw_command) > _MAX_COMMAND_CHARS
        or any(character in raw_command for character in "\r\n\0")
    ):
        raise ValueError("invalid command")
    try:
        argv = tuple(shlex.split(raw_command, posix=True))
    except ValueError as exc:
        raise ValueError("invalid command quoting") from exc
    return parse_broker_argv(argv, scope)


def parse_broker_argv(argv: tuple[str, ...], scope: BrokerScope) -> BrokerCommand:
    if not argv or argv[0] != "retainpdf-agent":
        raise ValueError("unsupported executable")
    if argv == ("retainpdf-agent", "document", "inspect"):
        return BrokerCommand(
            public_argv=argv,
            action="document.inspect",
            cli_argv=("document", "inspect", "--document-id", scope.document_id),
        )
    if len(argv) >= 3 and argv[1:3] == ("tool", "call"):
        return _parse_tool_call(argv)
    if len(argv) >= 3 and argv[1:3] == ("operation", "create"):
        return _parse_create(argv, scope)
    if len(argv) < 3 or argv[1] != "operation":
        raise ValueError("unsupported command")
    action = argv[2]
    if action == "get":
        flags = _parse_flags(argv[3:], {"--operation-id"})
        operation_id = _operation_id(flags)
        return BrokerCommand(
            argv,
            "operation.get",
            ("operation", "get", "--operation-id", operation_id),
        )
    if action in {"run", "commit"}:
        return _parse_effect(argv, scope, action)
    if action == "cancel":
        flags = _parse_flags(argv[3:], {"--operation-id", "--reason-code"})
        operation_id = _operation_id(flags)
        reason = flags["--reason-code"]
        if reason not in _CANCEL_REASONS:
            raise ValueError("invalid cancel reason")
        return BrokerCommand(
            argv,
            "operation.cancel",
            ("operation", "cancel", "--operation-id", operation_id),
            {
                "schema": "document_operation_cancel_v1",
                "idempotency_key": _idempotency_key(scope, "cancel", operation_id),
                "reason": reason,
            },
        )
    raise ValueError("unsupported operation action")


def _parse_tool_call(argv: tuple[str, ...]) -> BrokerCommand:
    flags = _parse_flags(argv[3:], {"--name", "--arguments-base64url"})
    name = flags["--name"]
    if name not in _HOST_TOOL_NAMES:
        raise ValueError("unsupported host tool")
    arguments = _decode_json_object(flags["--arguments-base64url"])
    return BrokerCommand(
        public_argv=argv,
        action="tool.call",
        cli_argv=(),
        request_payload={"name": name, "arguments": arguments},
    )


def _parse_create(argv: tuple[str, ...], scope: BrokerScope) -> BrokerCommand:
    if len(argv[3:]) != 2 or argv[3] not in {
        "--program-json",
        "--program-base64url",
        "--program-sha256",
    }:
        raise ValueError("invalid create flags")
    if not scope.request_message_id:
        raise ValueError("invalid create scope")
    program: dict[str, Any] | None = None
    if argv[3] == "--program-json":
        program, canonical = _parse_page_program_json(argv[4])
        program_sha256 = hashlib.sha256(canonical).hexdigest()
    elif argv[3] == "--program-base64url":
        program, canonical = _decode_page_program(argv[4])
        program_sha256 = hashlib.sha256(canonical).hexdigest()
    else:
        # Compatibility for control-plane preview callers. fx is prompted
        # only with --program-base64url for real execution.
        program_sha256 = argv[4]
        if not _SHA256.fullmatch(program_sha256):
            raise ValueError("invalid program hash")
    payload: dict[str, Any] = {
        "schema": "document_operation_create_v1",
        "idempotency_key": _idempotency_key(scope, "create"),
        "conversation_id": scope.conversation_id,
        "request_message_id": scope.request_message_id,
        "document_id": scope.document_id,
        "intent_summary": scope.intent_summary.strip()[:4000] or "Document operation",
        "program_sha256": program_sha256.lower(),
    }
    if program is not None:
        payload["program"] = program
    return BrokerCommand(
        public_argv=argv,
        action="operation.create",
        cli_argv=("operation", "create"),
        request_payload=payload,
    )


def _parse_effect(
    argv: tuple[str, ...], scope: BrokerScope, action: str
) -> BrokerCommand:
    if not scope.effects_allowed:
        raise ValueError("explicit confirmation is required")
    retry = False
    accept_duplicate_risk = False
    if action == "run" and "--retry" in argv[3:]:
        retry_index = argv.index("--retry")
        retry_value = argv[retry_index + 1] if retry_index + 1 < len(argv) else ""
        allowed = {"--operation-id", "--retry"}
        if retry_value == "ambiguous":
            allowed.add("--accept-duplicate-risk")
        flags = _parse_flags(argv[3:], allowed)
        if flags["--retry"] not in {"failed", "ambiguous"}:
            raise ValueError("invalid retry source status")
        retry = True
        if flags["--retry"] == "ambiguous":
            if flags["--accept-duplicate-risk"] != "yes":
                raise ValueError("ambiguous retry risk was not accepted")
            accept_duplicate_risk = True
    else:
        flags = _parse_flags(argv[3:], {"--operation-id"})
    operation_id = _operation_id(flags)
    payload: dict[str, Any] = {
        "schema": f"document_operation_{action}_v1",
        "idempotency_key": _idempotency_key(scope, action, operation_id),
    }
    if action == "run":
        payload["confirmed"] = True
        if retry:
            payload["retry"] = True
            payload["accept_duplicate_risk"] = accept_duplicate_risk
    return BrokerCommand(
        argv,
        f"operation.{action}",
        ("operation", action, "--operation-id", operation_id),
        payload,
    )


def _parse_flags(argv: tuple[str, ...], allowed: set[str]) -> dict[str, str]:
    if len(argv) != len(allowed) * 2:
        raise ValueError("wrong flag count")
    flags: dict[str, str] = {}
    for index in range(0, len(argv), 2):
        name, value = argv[index], argv[index + 1]
        if name not in allowed or name in flags or not value:
            raise ValueError("invalid flag")
        flags[name] = value
    if set(flags) != allowed:
        raise ValueError("missing flag")
    return flags


def _decode_page_program(encoded: str) -> tuple[dict[str, Any], bytes]:
    if not encoded or len(encoded) > 12000 or not _BASE64URL.fullmatch(encoded):
        raise ValueError("invalid page program encoding")
    padding = "=" * (-len(encoded) % 4)
    try:
        raw = base64.urlsafe_b64decode(encoded + padding)
        value = json.loads(raw)
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid page program encoding") from exc
    return _validate_page_program(value)


def _decode_json_object(encoded: str) -> dict[str, Any]:
    if not encoded or len(encoded) > 12000 or not _BASE64URL.fullmatch(encoded):
        raise ValueError("invalid tool arguments encoding")
    padding = "=" * (-len(encoded) % 4)
    try:
        raw = base64.urlsafe_b64decode(encoded + padding)
        value = json.loads(raw)
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid tool arguments encoding") from exc
    if not isinstance(value, dict):
        raise ValueError("tool arguments must be an object")  # noqa: TRY004
    return value


def _parse_page_program_json(raw: str) -> tuple[dict[str, Any], bytes]:
    if not raw or len(raw.encode("utf-8")) > 12000:
        raise ValueError("invalid page program JSON")
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("invalid page program JSON") from exc
    return _validate_page_program(value)


def _validate_page_program(value: Any) -> tuple[dict[str, Any], bytes]:
    if not isinstance(value, dict) or set(value) != {"schema", "steps"}:
        raise ValueError("invalid page program")
    if value.get("schema") != "retainpdf_page_program_v1":
        raise ValueError("unsupported page program schema")
    steps = value.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= 32:
        raise ValueError("invalid page program steps")
    page_references = 0
    for step in steps:
        if not isinstance(step, dict):
            raise ValueError("invalid page program step")  # noqa: TRY004
        operation = step.get("op")
        expected = (
            {"op", "pages"}
            if operation == "select_pages"
            else {"op", "pages", "degrees"}
        )
        if operation not in {"select_pages", "rotate_pages"} or set(step) != expected:
            raise ValueError("unsupported page program step")
        pages = step.get("pages")
        if (
            not isinstance(pages, list)
            or not pages
            or not all(
                isinstance(page, int) and not isinstance(page, bool) and page > 0
                for page in pages
            )
        ):
            raise ValueError("invalid page program pages")
        if operation == "rotate_pages" and step.get("degrees") not in {90, 180, 270}:
            raise ValueError("invalid page rotation")
        page_references += len(pages)
        if page_references > 20000:
            raise ValueError("page program is too large")
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return value, canonical


def _operation_id(flags: dict[str, str]) -> str:
    value = flags["--operation-id"]
    if not _SAFE_OPERATION_ID.fullmatch(value):
        raise ValueError("invalid operation id")
    return value


def _idempotency_key(scope: BrokerScope, action: str, operation_id: str = "") -> str:
    identity = (
        f"{scope.conversation_id}\0{scope.request_message_id}\0{action}\0{operation_id}"
    )
    # Preserve the historical prefix: changing it would break retry deduplication.
    return f"fx-{action}-{hashlib.sha256(identity.encode()).hexdigest()[:40]}"
