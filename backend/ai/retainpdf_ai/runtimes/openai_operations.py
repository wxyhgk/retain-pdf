"""OpenAI tool schemas and adapter for durable PDF operations."""

from __future__ import annotations

import json
from typing import Any

from ..agent_command_broker import AgentCommandBroker

_PAGE_STEP_SCHEMA: dict[str, Any] = {
    "oneOf": [
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["op", "pages"],
            "properties": {
                "op": {"const": "select_pages"},
                "pages": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 999,
                    "items": {"type": "integer", "minimum": 1},
                    "description": "按当前页面编号选择；可用于删除、重排或复制页面。",
                },
            },
        },
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["op", "pages", "degrees"],
            "properties": {
                "op": {"const": "rotate_pages"},
                "pages": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 999,
                    "items": {"type": "integer", "minimum": 1},
                },
                "degrees": {"type": "integer", "enum": [90, 180, 270]},
            },
        },
    ]
}


def _function(
    name: str,
    description: str,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters,
        },
    }


DOCUMENT_AGENT_TOOLS: list[dict[str, Any]] = [
    _function(
        "retainpdf_document_inspect",
        "读取当前文档可安全暴露的元数据和活动版本。",
        {"type": "object", "additionalProperties": False, "properties": {}},
    ),
    _function(
        "retainpdf_operation_create",
        "根据受限页面步骤创建 durable PDF operation；创建不会执行或提交。",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["steps"],
            "properties": {
                "steps": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 64,
                    "items": _PAGE_STEP_SCHEMA,
                }
            },
        },
    ),
    _function(
        "retainpdf_operation_get",
        "查询一个 durable operation 的权威状态。",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["operation_id"],
            "properties": {"operation_id": {"type": "string", "minLength": 1}},
        },
    ),
    _function(
        "retainpdf_operation_run",
        "显式确认后运行或重试 operation，生成可预览候选版本，但不提交。",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["operation_id"],
            "properties": {
                "operation_id": {"type": "string", "minLength": 1},
                "retry": {"type": "string", "enum": ["failed", "ambiguous"]},
                "accept_duplicate_risk": {"type": "boolean", "default": False},
            },
        },
    ),
    _function(
        "retainpdf_operation_commit",
        "在用户已经预览候选版本并再次显式确认后提交 operation。",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["operation_id"],
            "properties": {"operation_id": {"type": "string", "minLength": 1}},
        },
    ),
    _function(
        "retainpdf_operation_cancel",
        "取消尚未提交的 operation。",
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["operation_id", "reason"],
            "properties": {
                "operation_id": {"type": "string", "minLength": 1},
                "reason": {
                    "type": "string",
                    "enum": ["agent_abort", "superseded", "user_cancelled"],
                },
            },
        },
    ),
]


def parse_tool_arguments(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(str(raw or "{}"))
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def invoke_operation_tool(
    broker: AgentCommandBroker,
    name: str,
    arguments: dict[str, Any],
    *,
    ran_in_this_turn: set[str],
    allow_same_turn_commit: bool = False,
) -> dict[str, Any]:
    try:
        argv = operation_tool_argv(
            name,
            arguments,
            ran_in_this_turn=ran_in_this_turn,
            allow_same_turn_commit=allow_same_turn_commit,
        )
        completed = broker.execute_host_argv(argv)
    except (TypeError, ValueError) as exc:
        error = str(exc)
        return {
            "ok": False,
            "code": (
                "confirmation_required"
                if error == "explicit confirmation is required"
                else "invalid_operation_command"
            ),
            "error": error,
        }
    exit_code = int(completed.get("exit_code") or 0)
    stdout = str(completed.get("stdout") or "")
    if exit_code != 0:
        return {
            "ok": False,
            "error": str(completed.get("stderr") or "operation tool failed")[:4000],
        }
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        payload = {"output": stdout[:16000]}
    operation_id = str(arguments.get("operation_id") or "").strip()
    if name == "retainpdf_operation_run" and operation_id:
        ran_in_this_turn.add(operation_id)
    return {"ok": True, "result": payload}


def operation_tool_argv(
    name: str,
    arguments: dict[str, Any],
    *,
    ran_in_this_turn: set[str],
    allow_same_turn_commit: bool = False,
) -> tuple[str, ...]:
    if name == "retainpdf_document_inspect":
        return ("retainpdf-agent", "document", "inspect")
    if name == "retainpdf_operation_create":
        program = {
            "schema": "retainpdf_page_program_v1",
            "steps": arguments.get("steps"),
        }
        canonical = json.dumps(
            program,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return (
            "retainpdf-agent",
            "operation",
            "create",
            "--program-json",
            canonical,
        )
    operation_id = str(arguments.get("operation_id") or "").strip()
    if name == "retainpdf_operation_get":
        return (
            "retainpdf-agent",
            "operation",
            "get",
            "--operation-id",
            operation_id,
        )
    if name == "retainpdf_operation_run":
        argv = [
            "retainpdf-agent",
            "operation",
            "run",
            "--operation-id",
            operation_id,
        ]
        retry = str(arguments.get("retry") or "").strip()
        if retry:
            argv.extend(["--retry", retry])
            if retry == "ambiguous" and arguments.get("accept_duplicate_risk") is True:
                argv.extend(["--accept-duplicate-risk", "yes"])
        return tuple(argv)
    if name == "retainpdf_operation_commit":
        if operation_id in ran_in_this_turn and not allow_same_turn_commit:
            raise ValueError(
                "candidate must be previewed before a later confirmed commit turn"
            )
        return (
            "retainpdf-agent",
            "operation",
            "commit",
            "--operation-id",
            operation_id,
        )
    if name == "retainpdf_operation_cancel":
        return (
            "retainpdf-agent",
            "operation",
            "cancel",
            "--operation-id",
            operation_id,
            "--reason-code",
            str(arguments.get("reason") or ""),
        )
    raise ValueError(f"unsupported RetainPDF tool: {name}")
