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


def prepare_fx_state(
    settings: Settings, *, session_key: str, shared_home: bool = False
) -> tuple[Path, Path, Path, Path]:
    """建好 fx 的私有 HOME / workspace / tmp，返回 (executable, home, workspace, tmp)。

    单独抽出来是因为现在有两个消费者：ACP 客户端（start_fx_client）和 PTY
    终端（fx_terminal）。同一套加固只能有一份 —— 两份复制出来的沙箱一定会
    在某次改动后只改了其中一份，而漏掉的那份不会有任何报错。

    `shared_home` 只给交互式终端用：HOME 放 fx 的**账号和配置**，那不是按
    文档分的东西。每个 session 一个 HOME 意味着用户换一本书就要重新登录一次
    —— 对 ACP 那条路（宿主替用户批，本来就不该有交互登录）无所谓，对人用的
    终端是荒谬的。

    workspace 和 tmp 无论如何都按 session 隔离：那里面是文件，是按文档分的。
    """
    if sys.platform not in {"darwin", "linux"}:
        raise RuntimeError("fx 0.0.5 has no supported native runtime for this platform")
    executable = resolve_executable(settings.fx_command)
    state_root = (
        settings.fx_state_root.resolve()
        / "sessions"
        / conversation_namespace(session_key)
    )
    home = (
        settings.fx_state_root.resolve() / "shared-home"
        if shared_home
        else state_root / "home"
    )
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
    return executable, home, workspace, tmp


def resolve_fx_command_path(
    settings: Settings, executable: Path, broker: AgentCommandBroker | None
) -> str:
    """fx 子进程的 PATH。ACP 和 PTY 必须用同一份，否则两条路能跑的命令不一样。"""
    command_path = str(executable.parent)
    if broker is not None:
        command_path = f"{broker.bin_dir}{os.pathsep}{command_path}"
    if settings.fx_shell_mode:
        # 第二把锁。默认的 PATH 只有 broker 的 shim 目录和 fx 自己所在目录 ——
        # 没有 /usr/bin,所以 cat / grep / jq / python3 在终端里根本不存在。
        # 光放开 approve_permission 不够,fx 连命令都找不到。
        #
        # 追加在后面而不是前面:broker 的 retainpdf-agent 必须优先于同名的
        # 系统命令,否则 PATH 上随便放一个同名文件就能截走结构化操作。
        system_path = os.environ.get("PATH", "")
        if system_path:
            command_path = f"{command_path}{os.pathsep}{system_path}"
    return command_path


def resolve_fx_gateway_key(settings: Settings) -> str:
    """取 fx 的 Gateway 凭据：直配的 key，或凭据库里的引用。

    PTY 那条路也要 —— 不传的话 fx 的 TUI 起来第一屏是「Welcome to fx，请登录」，
    而用户明明已经在设置里填过 Gateway Key 了。
    """
    if settings.fx_gateway_credential_ref:
        return resolve_credential(
            settings.data_root,
            settings.fx_gateway_credential_ref,
            "fx_gateway_api_key",
        )
    return settings.fx_gateway_api_key


def start_fx_client(
    settings: Settings,
    broker: AgentCommandBroker | None = None,
    *,
    session_key: str = "",
) -> FxAcpClient:
    executable, home, workspace, tmp = prepare_fx_state(
        settings, session_key=session_key
    )
    command_path = resolve_fx_command_path(settings, executable, broker)
    gateway_api_key = resolve_fx_gateway_key(settings)
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
            extra_body=settings.fx_upstream_extra,
            reasoning_efforts=settings.fx_reasoning_efforts,
            usage_data_root=settings.usage_ledger_root,
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
