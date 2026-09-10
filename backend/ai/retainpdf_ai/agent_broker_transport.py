"""Bounded Unix-socket framing and wrapper generation for the Agent broker."""

from __future__ import annotations

import json
import socket
import sys
from typing import Any

MAX_BROKER_FRAME_BYTES = 1024 * 1024


def recv_json_line(connection: socket.socket) -> dict[str, Any]:
    chunks = bytearray()
    while len(chunks) <= MAX_BROKER_FRAME_BYTES:
        piece = connection.recv(min(65536, MAX_BROKER_FRAME_BYTES + 1 - len(chunks)))
        if not piece:
            break
        chunks.extend(piece)
        if b"\n" in piece:
            break
    if len(chunks) > MAX_BROKER_FRAME_BYTES:
        raise ValueError("broker frame too large")
    line = bytes(chunks).split(b"\n", 1)[0]
    value = json.loads(line)
    if not isinstance(value, dict):
        raise TypeError("broker frame must be an object")
    return value


def failure(message: str) -> dict[str, Any]:
    return {"exit_code": 1, "stdout": "", "stderr": message}


def wrapper_source(socket_path: str, broker_key: str) -> str:
    return f"""#!{sys.executable}
import json
import socket
import sys

payload = json.dumps({{"broker_key": {broker_key!r}, "argv": sys.argv[1:]}}, separators=(",", ":")).encode("utf-8")
if len(payload) > {MAX_BROKER_FRAME_BYTES}:
    sys.stderr.write("broker request exceeded limit\\n")
    raise SystemExit(1)
with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
    connection.connect({socket_path!r})
    connection.sendall(payload + b"\\n")
    chunks = bytearray()
    while len(chunks) <= {MAX_BROKER_FRAME_BYTES}:
        piece = connection.recv(65536)
        if not piece:
            break
        chunks.extend(piece)
        if b"\\n" in piece:
            break
response = json.loads(bytes(chunks).split(b"\\n", 1)[0])
sys.stdout.write(str(response.get("stdout") or ""))
sys.stderr.write(str(response.get("stderr") or ""))
raise SystemExit(int(response.get("exit_code") or 0))
"""
