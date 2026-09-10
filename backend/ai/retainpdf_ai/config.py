"""环境变量配置。所有凭证只走环境变量,代码与仓库不落任何密钥。"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from .credential_vault import resolve_credential
from .runtime_credentials import load_runtime_credentials

FX_DEFAULT_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh"
FX_GATEWAY_CHAT_PATH = "/v3/ai/language-model"
AGENT_CONFIRMATION_MODES = {"explicit", "green_light"}


def normalize_agent_confirmation_mode(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in AGENT_CONFIRMATION_MODES:
        raise ValueError("Agent 确认模式只能是 explicit 或 green_light。")
    return normalized


def normalize_fx_gateway_base_url(value: str) -> str:
    """Validate the endpoint override actually admitted by fx 0.0.5.

    fx 0.0.5 silently ignores every custom origin except explicit loopback
    HTTP with a port.  Reject those values before process startup so a typo or
    remote URL cannot fall back to the public Vercel Gateway unnoticed.
    """

    normalized = value.strip().rstrip("/")
    if not normalized:
        return ""
    try:
        parsed = urlsplit(normalized)
        port = parsed.port
    except ValueError as exc:
        raise ValueError("FX Gateway URL 端口无效。") from exc
    if (
        parsed.scheme.lower() != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or port is None
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(
            "FX 0.0.5 的自定义 Gateway 仅支持带端口的回环 HTTP 地址"
            "（127.0.0.1、localhost 或 [::1]），且不能包含凭据、查询或片段。"
        )
    return normalized


def fx_gateway_chat_url(base_url: str) -> str:
    normalized = normalize_fx_gateway_base_url(base_url)
    return f"{normalized}{FX_GATEWAY_CHAT_PATH}" if normalized else ""


def _repo_root() -> Path:
    # backend/ai/retainpdf_ai/config.py -> repository root
    return Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 41100
    # 本服务自身的认证 key 集合(与 Rust API 同风格的 X-API-Key)
    api_keys: frozenset[str] = field(default_factory=frozenset)
    # 调用 Rust API 用
    rust_api_base: str = "http://127.0.0.1:41000"
    rust_api_key: str = ""
    # LLM(DeepSeek 或兼容端点)
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-v4-flash"
    llm_api_key: str = ""
    llm_credential_ref: str = ""
    llm_timeout_s: float = 60.0
    # agent 循环护栏
    max_tool_rounds: int = 6
    reading_max_tool_rounds: int = 3
    ai_request_deadline_s: float = 90.0
    ai_heartbeat_interval_s: float = 5.0
    # B2 memory：近期窗口 / 超过则压缩 / MemoryView 字符上限
    memory_window_turns: int = 6
    memory_compress_after_turns: int = 12
    memory_max_chars: int = 24000
    # Agent harness selection. `python` preserves the retrieval-only loop;
    # `openai` adds durable document tools over any OpenAI-compatible endpoint;
    # `fx` enables the experimental, version-pinned ACP adapter.
    agent_runtime: str = "python"
    # explicit requires a host-owned confirmation action. green_light skips
    # that human gate but never expands the broker command grammar.
    agent_confirmation_mode: str = "explicit"
    runtime_config_revision: int = 0
    # Shared host-side control CLI. The fx-prefixed field remains as a
    # compatibility fallback for older launchers and tests.
    agent_cli_command: str = ""
    fx_command: str = "fx"
    # Real backend CLI. fx sees only a generated broker wrapper with this name.
    fx_agent_cli_command: str = "retainpdf-agent"
    fx_expected_version: str = "0.0.5"
    fx_gateway_base_url: str = ""
    fx_gateway_base_url_mode: str = "inherit_env"
    fx_gateway_base_url_env: str = ""
    fx_gateway_api_key: str = ""
    fx_gateway_credential_ref: str = ""
    fx_model: str = ""
    # Optional host-side loopback bridge for fx 0.0.5.  When configured, fx
    # keeps owning the agent loop while inference uses an OpenAI-compatible
    # Chat Completions endpoint instead of Vercel AI Gateway.
    fx_openai_base_url: str = ""
    fx_openai_api_key: str = ""
    fx_startup_timeout_s: float = 10.0
    fx_turn_timeout_s: float = 120.0
    fx_max_concurrent_turns: int = 4
    fx_state_root: Path = field(
        default_factory=lambda: _repo_root() / "data" / "agent-runtime" / "fx"
    )
    # 任务产物根目录(data/jobs/<job_id>/...)
    data_root: Path = field(default_factory=lambda: _repo_root() / "data")


def apply_runtime_credentials(
    settings: Settings, stored: Mapping[str, Any]
) -> Settings:
    mode = str(stored.get("fx_gateway_base_url_mode") or "inherit_env")
    inherited_fx_url = settings.fx_gateway_base_url_env or (
        settings.fx_gateway_base_url
        if settings.fx_gateway_base_url_mode == "inherit_env"
        else ""
    )
    if mode == "custom":
        fx_gateway_base_url = normalize_fx_gateway_base_url(
            str(stored.get("fx_gateway_base_url") or "")
        )
    elif mode == "official_default":
        fx_gateway_base_url = ""
    elif mode == "inherit_env":
        fx_gateway_base_url = inherited_fx_url
    else:
        raise ValueError("FX Gateway URL 配置模式无效。")
    has_persisted_revision = int(stored.get("revision") or 0) > 0
    llm_credential_ref = (
        str(stored.get("llm_credential_ref") or "")
        if has_persisted_revision
        else settings.llm_credential_ref
    )
    llm_api_key = (
        str(stored.get("llm_api_key") or "")
        if has_persisted_revision
        else settings.llm_api_key
    )
    fx_gateway_credential_ref = (
        str(stored.get("fx_gateway_credential_ref") or "")
        if has_persisted_revision
        else settings.fx_gateway_credential_ref
    )
    fx_gateway_api_key = (
        str(stored.get("fx_gateway_api_key") or "")
        if has_persisted_revision
        else settings.fx_gateway_api_key
    )
    if llm_credential_ref:
        llm_api_key = resolve_credential(
            settings.data_root,
            llm_credential_ref,
            "agent_llm_api_key",
        )
    if fx_gateway_credential_ref:
        fx_gateway_api_key = resolve_credential(
            settings.data_root,
            fx_gateway_credential_ref,
            "fx_gateway_api_key",
        )
    return replace(
        settings,
        runtime_config_revision=int(stored.get("revision") or 0),
        agent_runtime=str(stored.get("agent_runtime") or settings.agent_runtime),
        agent_confirmation_mode=normalize_agent_confirmation_mode(
            str(
                stored.get("agent_confirmation_mode")
                or settings.agent_confirmation_mode
            )
        ),
        llm_base_url=str(stored.get("llm_base_url") or settings.llm_base_url).rstrip("/"),
        llm_model=str(stored.get("llm_model") or settings.llm_model),
        llm_api_key=llm_api_key,
        llm_credential_ref=llm_credential_ref,
        fx_gateway_api_key=fx_gateway_api_key,
        fx_gateway_credential_ref=fx_gateway_credential_ref,
        fx_gateway_base_url=fx_gateway_base_url,
        fx_gateway_base_url_mode=mode,
        fx_model=str(stored.get("fx_model") or settings.fx_model),
    )


def load_settings() -> Settings:
    # 钥匙单源：单机部署一把钥匙就够。RETAIN_AI_API_KEYS 缺省时回退
    # RETAIN_API_KEYS（rust_api 的钥匙集）——此前双 env 必须人肉保持同步，
    # 错配时前端只能看到费解的 401（审计 D4 备注）。显式设置仍优先，兼容不破。
    raw_keys = os.environ.get("RETAIN_AI_API_KEYS", "").strip() or os.environ.get(
        "RETAIN_API_KEYS", ""
    )
    api_keys = frozenset(key.strip() for key in raw_keys.split(",") if key.strip())
    data_root = os.environ.get("RETAIN_AI_DATA_ROOT", "").strip()
    fx_gateway_base_url_env = os.environ.get(
        "RETAIN_AI_FX_GATEWAY_BASE_URL", ""
    ).strip()
    # 只有在没有显式配置 LLM key 时，ATLASCLOUD_API_KEY 才接管默认端点与模型；
    # 任何 RETAIN_AI_LLM_* 都优先，既有部署不受影响。
    atlascloud_api_key = os.environ.get("ATLASCLOUD_API_KEY", "").strip()
    llm_api_key = os.environ.get("RETAIN_AI_LLM_API_KEY", "").strip()
    use_atlascloud_defaults = bool(atlascloud_api_key and not llm_api_key)
    default_llm_base_url = (
        "https://api.atlascloud.ai/v1"
        if use_atlascloud_defaults
        else "https://api.deepseek.com/v1"
    )
    default_llm_model = (
        "deepseek-ai/deepseek-v4-pro"
        if use_atlascloud_defaults
        else "deepseek-v4-flash"
    )
    settings = Settings(
        host=os.environ.get("RETAIN_AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("RETAIN_AI_PORT", "41100")),
        api_keys=api_keys,
        rust_api_base=os.environ.get(
            "RETAIN_AI_RUST_API_BASE", "http://127.0.0.1:41000"
        ).rstrip("/"),
        rust_api_key=os.environ.get("RETAIN_AI_RUST_API_KEY", "").strip(),
        llm_base_url=os.environ.get(
            "RETAIN_AI_LLM_BASE_URL", default_llm_base_url
        ).rstrip("/"),
        llm_model=os.environ.get("RETAIN_AI_LLM_MODEL", default_llm_model),
        llm_api_key=llm_api_key or atlascloud_api_key,
        llm_credential_ref=os.environ.get("RETAIN_AI_LLM_CREDENTIAL_REF", "").strip(),
        llm_timeout_s=float(os.environ.get("RETAIN_AI_LLM_TIMEOUT_S", "60")),
        max_tool_rounds=int(os.environ.get("RETAIN_AI_MAX_TOOL_ROUNDS", "6")),
        reading_max_tool_rounds=max(
            1,
            min(
                3,
                int(os.environ.get("RETAIN_AI_READING_MAX_TOOL_ROUNDS", "3")),
            ),
        ),
        ai_request_deadline_s=max(
            1.0,
            float(os.environ.get("RETAIN_AI_REQUEST_DEADLINE_SECS", "90")),
        ),
        ai_heartbeat_interval_s=max(
            1.0,
            min(
                10.0,
                float(os.environ.get("RETAIN_AI_HEARTBEAT_INTERVAL_SECS", "5")),
            ),
        ),
        memory_window_turns=int(os.environ.get("RETAIN_AI_MEMORY_WINDOW_TURNS", "6")),
        memory_compress_after_turns=int(
            os.environ.get("RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS", "12")
        ),
        memory_max_chars=int(os.environ.get("RETAIN_AI_MEMORY_MAX_CHARS", "24000")),
        agent_runtime=os.environ.get("RETAIN_AI_RUNTIME", "python").strip().lower(),
        agent_confirmation_mode=normalize_agent_confirmation_mode(
            os.environ.get("RETAIN_AI_AGENT_CONFIRMATION_MODE", "explicit")
        ),
        agent_cli_command=os.environ.get(
            "RETAIN_AI_AGENT_CLI_COMMAND",
            os.environ.get("RETAIN_AI_FX_AGENT_CLI_COMMAND", ""),
        ).strip(),
        fx_command=os.environ.get("RETAIN_AI_FX_COMMAND", "fx").strip() or "fx",
        fx_agent_cli_command=os.environ.get(
            "RETAIN_AI_FX_AGENT_CLI_COMMAND", "retainpdf-agent"
        ).strip()
        or "retainpdf-agent",
        fx_expected_version=os.environ.get(
            "RETAIN_AI_FX_EXPECTED_VERSION", "0.0.5"
        ).strip(),
        fx_gateway_base_url=fx_gateway_base_url_env,
        fx_gateway_base_url_env=fx_gateway_base_url_env,
        fx_gateway_api_key=os.environ.get(
            "RETAIN_AI_FX_GATEWAY_API_KEY", ""
        ).strip(),
        fx_gateway_credential_ref=os.environ.get(
            "RETAIN_AI_FX_GATEWAY_CREDENTIAL_REF", ""
        ).strip(),
        fx_model=os.environ.get("RETAIN_AI_FX_MODEL", "").strip(),
        fx_openai_base_url=os.environ.get("RETAIN_AI_FX_OPENAI_BASE_URL", "").strip(),
        fx_openai_api_key=os.environ.get("RETAIN_AI_FX_OPENAI_API_KEY", "").strip(),
        fx_startup_timeout_s=float(
            os.environ.get("RETAIN_AI_FX_STARTUP_TIMEOUT_SECS", "10")
        ),
        fx_turn_timeout_s=float(
            os.environ.get("RETAIN_AI_FX_TURN_TIMEOUT_SECS", "120")
        ),
        fx_max_concurrent_turns=max(
            1,
            int(os.environ.get("RETAIN_AI_FX_MAX_CONCURRENT_TURNS", "4")),
        ),
        fx_state_root=Path(
            os.environ.get("RETAIN_AI_FX_STATE_ROOT", "").strip()
            or (_repo_root() / "data" / "agent-runtime" / "fx")
        ),
        data_root=Path(data_root) if data_root else _repo_root() / "data",
    )
    stored = load_runtime_credentials(settings.data_root)
    return apply_runtime_credentials(settings, stored)
