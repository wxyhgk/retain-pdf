#!/usr/bin/python3
"""Deterministic ACP peer for the local live-stack acceptance test.

It replaces only Gateway/model decision-making. Every admitted command still
travels through the real FX broker wrapper, capability issuer, Rust CLI/API,
durable operation store, PDF executor, validation, and commit path.
"""

from __future__ import annotations

import json
from pathlib import Path
import shlex
import subprocess
import sys
import time


def send(value: dict) -> None:
    sys.stdout.write(json.dumps(value, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def request_permission(command: str, request_id: int) -> None:
    send(
        {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "session/request_permission",
            "params": {
                "toolCall": {
                    "toolCallId": f"tool-{request_id}",
                    "kind": "execute",
                    "rawInput": {"command": command},
                },
                "options": [
                    {"optionId": "allow_once", "kind": "allow_once"},
                    {"optionId": "reject_once", "kind": "reject_once"},
                ],
            },
        }
    )
    permission = json.loads(next(sys.stdin))
    selected = (
        (permission.get("result") or {}).get("outcome") or {}
    ).get("optionId")
    if selected != "allow_once":
        raise RuntimeError("RetainPDF host rejected deterministic fixture command")


def execute(command: str, request_id: int) -> dict:
    request_permission(command, request_id)
    completed = subprocess.run(
        shlex.split(command),
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    send(
        {
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "update": {
                    "sessionUpdate": "tool_call_update",
                    "toolCallId": f"tool-{request_id}",
                    "title": command.split(" ", 3)[0:3],
                    "kind": "execute",
                    "status": "completed" if completed.returncode == 0 else "failed",
                }
            },
        }
    )
    if completed.returncode != 0:
        raise RuntimeError("real retainpdf-agent command failed")
    payload = json.loads(completed.stdout)
    if payload.get("ok") is not True:
        raise RuntimeError("real retainpdf-agent returned a failed envelope")
    return payload


def drive_operation() -> str:
    program = json.dumps(
        {
            "schema": "retainpdf_page_program_v1",
            "steps": [
                {"op": "select_pages", "pages": [1, 1]},
                {"op": "rotate_pages", "pages": [2], "degrees": 90},
            ],
        },
        separators=(",", ":"),
    )
    created = execute(
        f"retainpdf-agent operation create --program-json {shlex.quote(program)}", 101
    )
    operation_id = str(created["response"]["data"]["operation_id"])
    execute(f"retainpdf-agent operation run --operation-id {operation_id}", 102)
    status = ""
    for offset in range(8):
        time.sleep(0.5)
        current = execute(
            f"retainpdf-agent operation get --operation-id {operation_id}", 103 + offset
        )
        status = str(current["response"]["data"]["status"])
        if status == "result_ready":
            break
        if status == "failed":
            raise RuntimeError("real PDF operation failed")
    if status != "result_ready":
        raise RuntimeError("real PDF operation did not become ready")
    execute(f"retainpdf-agent operation commit --operation-id {operation_id}", 111)
    return operation_id


def acp() -> None:
    for raw in sys.stdin:
        message = json.loads(raw)
        method = message.get("method")
        request_id = message.get("id")
        if method == "initialize":
            send(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "protocolVersion": 1,
                        "agentCapabilities": {"loadSession": True},
                        "agentInfo": {"name": "fx", "version": "0.0.5"},
                    },
                }
            )
        elif method == "session/new":
            send(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {"sessionId": "deterministic-live-session"},
                }
            )
        elif method == "session/load":
            send(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {"sessionId": "deterministic-live-session"},
                }
            )
        elif method == "session/set_config_option":
            send(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "configOptions": [{"id": "mode", "currentValue": "ask"}]
                    },
                }
            )
        elif method == "session/prompt":
            operation_id = drive_operation()
            send(
                {
                    "jsonrpc": "2.0",
                    "method": "session/update",
                    "params": {
                        "update": {
                            "sessionUpdate": "agent_message_chunk",
                            "content": {
                                "type": "text",
                                "text": f"Committed operation {operation_id}",
                            },
                        }
                    },
                }
            )
            send(
                {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {"stopReason": "end_turn"},
                }
            )


if __name__ == "__main__":
    if sys.argv[1:] == ["--version"]:
        print("0.0.5")
    elif sys.argv[1:] == ["acp"]:
        try:
            acp()
        except Exception as error:
            Path("fake-fx-error.log").write_text(
                f"{type(error).__name__}: {error}\n", encoding="utf-8"
            )
            raise
    else:
        raise SystemExit(2)
