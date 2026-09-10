"""Create a hardened fx subprocess without leaking host credentials."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from ..agent_command_broker import AgentCommandBroker
from ..config import Settings, fx_gateway_chat_url, normalize_fx_gateway_base_url
from ..credential_vault import resolve_credential
from ..fx_openai_bridge import FxOpenAIChatBridge
from ..prompts import build_fx_workspace_instructions
from .fx_acp import FxAcpClient
from .fx_coordination import conversation_namespace


def start_fx_client(
    settings: Settings,
    broker: AgentCommandBroker | None = None,
    *,
    session_key: str = "",
) -> FxAcpClient:
    if sys.platform not in {"darwin", "linux"}:
        raise RuntimeError("fx 0.0.5 has no supported native runtime for this platform")
    executable = resolve_executable(settings.fx_command)
    state_root = (
        settings.fx_state_root.resolve()
        / "sessions"
        / conversation_namespace(session_key)
    )
    home = state_root / "home"
    workspace = state_root / "workspace"
    tmp = state_root / "tmp"
    for path in (state_root, home, workspace, tmp):
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        if path.is_symlink() or not path.is_dir():
            raise RuntimeError("fx private state contains an unsafe directory")
        try:
            path.chmod(0o700)
        except OSError:
            pass

    _write_workspace_instructions(
        workspace,
        build_fx_workspace_instructions(settings.agent_confirmation_mode),
    )
    command_path = str(executable.parent)
    if broker is not None:
        command_path = f"{broker.bin_dir}{os.pathsep}{command_path}"
    gateway_api_key = settings.fx_gateway_api_key
    if settings.fx_gateway_credential_ref:
        gateway_api_key = resolve_credential(
            settings.data_root,
            settings.fx_gateway_credential_ref,
            "fx_gateway_api_key",
        )
    # Optional host-side loopback bridge: fx keeps owning the agent loop
    # while inference uses an OpenAI-compatible endpoint instead of Vercel
    # AI Gateway. Started/stopped with the client; never leaks without it.
    bridge = None
    if settings.fx_openai_base_url.strip():
        bridge = FxOpenAIChatBridge(
            base_url=settings.fx_openai_base_url.strip(),
            api_key=settings.fx_openai_api_key,
            model=settings.fx_model or settings.llm_model,
            timeout_s=settings.fx_turn_timeout_s,
        ).start()
        gateway_api_key = bridge.gateway_api_key
    env = {
        "HOME": str(home),
        "TMPDIR": str(tmp),
        "PATH": command_path,
        "NO_COLOR": "1",
        "FX_AUTO_UPGRADE": "0",
        "FX_PERMISSION_MODE": "ask",
        "AI_GATEWAY_API_KEY": gateway_api_key,
    }
    if settings.fx_model or bridge is not None:
        env["FX_MODEL"] = settings.fx_model or (settings.llm_model if bridge is not None else "")
    if bridge is not None:
        env["FX_GATEWAY_CHAT_URL"] = bridge.chat_url
        env["FX_GATEWAY_BASE_URL"] = bridge.gateway_base_url
    if settings.fx_gateway_base_url:
        base_url = normalize_fx_gateway_base_url(settings.fx_gateway_base_url)
        env["FX_GATEWAY_BASE_URL"] = base_url
        # fx 0.0.5 does not derive its completion endpoint from the base URL.
        # Both variables are required or model turns still use the public
        # Gateway while catalog requests use the custom URL.
        env["FX_GATEWAY_CHAT_URL"] = fx_gateway_chat_url(base_url)
    try:
        return FxAcpClient(
            executable,
            workspace,
            env,
            permission_handler=broker.approve_permission if broker is not None else None,
            startup_timeout=settings.fx_startup_timeout_s,
            turn_timeout=settings.fx_turn_timeout_s,
            cleanup=bridge.close if bridge is not None else None,
        )
    except Exception:
        if bridge is not None:
            bridge.close()
        raise


def resolve_executable(command: str) -> Path:
    raw = command.strip()
    if not raw or any(char in raw for char in "\r\n\0"):
        raise RuntimeError("RETAIN_AI_FX_COMMAND is invalid")
    resolved = shutil.which(raw) if not Path(raw).is_absolute() else raw
    if not resolved:
        raise RuntimeError("fx executable was not found")
    path = Path(resolved).resolve()
    if not path.is_file():
        raise RuntimeError("fx executable is not a regular file")
    return path


def _write_workspace_instructions(workspace: Path, content: str) -> None:
    instructions = workspace / "AGENTS.md"
    if instructions.is_symlink():
        raise RuntimeError("fx workspace instructions may not be a symlink")
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    flags |= getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(instructions, flags, 0o600)
    try:
        os.write(descriptor, content.encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
