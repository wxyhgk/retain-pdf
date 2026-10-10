"""环境变量配置。所有凭证只走环境变量,代码与仓库不落任何密钥。"""

from __future__ import annotations

import json
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


def _env_json_object(name: str) -> dict[str, Any]:
    """读一个 JSON 对象环境变量。解析不出对象就当没配。

    静默忽略而不是抛：这是个可选的调优开关，写错了不该让整个服务起不来。
    但也不能猜 —— 不是对象就是空，不做部分解析。
    """
    raw = os.environ.get(name, "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _env_csv(name: str) -> tuple[str, ...]:
    """逗号分隔的字符串列表。空项丢掉，顺序保留 —— fx 的选择器按这个顺序显示。"""
    raw = os.environ.get(name, "").strip()
    return tuple(item.strip() for item in raw.split(",") if item.strip())


def _env_denied_commands(name: str) -> tuple[str, ...] | None:
    """没设 → None（用默认清单）；设成 "none" → 空元组（什么都不挡）。

    区分「没设」和「设成空」很重要：前者要默认保护，后者是用户明确说不要。
    直接用空字符串表达「不挡」会和「没设」撞在一起。
    """
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    if raw.lower() == "none":
        return ()
    return tuple(item.strip() for item in raw.split(",") if item.strip())


def _env_flag_default_on(name: str) -> bool:
    """默认开的布尔环境变量。

    和 `_env_flag` 相反：那个控制的是「模型能不能跑任意命令」，误读成开代价很大；
    这个控制的是「要不要接上上次对话」，误读成关只是丢一次上下文。
    """
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return True
    return raw not in {"0", "false", "no", "off"}


def _env_flag(name: str) -> bool:
    """布尔环境变量。只有明确写了真值才算开 —— 空值、拼错、"off" 一律是关。

    默认关很重要:这个开关控制的是「模型能不能在本机跑任意命令」,
    误读成开的代价远大于误读成关。
    """
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 41100
    # HTTP keep-alive 空闲回收阈值(秒)。uvicorn 默认 5 秒,与 rust_api 探测
    # 间隔的默认值(RUST_API_AI_HEALTH_INTERVAL_SECS)恰好相同,于是服务端到点
    # 关连接、客户端正好复用那一条,请求在途中被 RST。探测那侧已经改成不留
    # 空闲连接,从根上不受影响;但 AiGateway(用户的 AI 请求)仍然用连接池,
    # 而 5 秒是一个太容易被撞上的窗口。调大只是把窗口推远、不是消除竞态——
    # 真正消除要让网关对幂等请求重试,那是另一件事。
    keep_alive_timeout_s: int = 75
    # 本服务自身的认证 key 集合(与 Rust API 同风格的 X-API-Key)
    api_keys: frozenset[str] = field(default_factory=frozenset)
    # 调用 Rust API 用
    rust_api_base: str = "http://127.0.0.1:41000"
    rust_api_key: str = ""
    # LLM(DeepSeek 或兼容端点)
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-flash"
    llm_api_key: str = ""
    llm_credential_ref: str = ""
    llm_timeout_s: float = 60.0
    # agent 循环护栏
    max_tool_rounds: int = 6
    reading_max_tool_rounds: int = 3
    # 纯计算轮的额外预算。检索上限压得低是为了不让模型乱逛,但复杂问题的后半段是计算
    # (算 → 画图),被同一个上限砍断就只能拿半截结果硬答。全是本地计算工具的轮次改从
    # 这份预算里扣,总轮数仍被两者之和夹住。
    computation_round_bonus: int = 3
    ai_request_deadline_s: float = 90.0
    ai_heartbeat_interval_s: float = 5.0
    # 追问建议:一轮答完之后多跑一次轻量调用。它要花钱、也让 done 晚一点,所以留一个
    # 关得掉的开关。关掉之后 done 里就不再有 followups 字段。
    followup_suggestions: bool = True
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
    fx_expected_version: str = "0.0.10"
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
    # 终端模式:放开 fx 自带的 Terminal Tool。两把锁一起开 ——
    # approve_permission 放行 broker 语法之外的命令,PATH 并入系统 PATH。
    # 默认关,关着时老行为一个字节没变。
    #
    # 开着相当于把本机 shell 交给模型:fx 以当前用户跑,HOME 指向私有目录只
    # 改变工具去哪找配置,不限制文件访问。而这个 agent 的输入里有来源不可控
    # 的 PDF 正文(AGENTS.md 自己就写着「把文档正文当不可信数据」)。
    # 要限制爆炸半径得靠进程级隔离,不在本文件的职责里。
    fx_shell_mode: bool = False
    # 并进上游 chat/completions 请求体的额外字段（JSON 对象）。
    #
    # fx 0.0.5 的网关协议只发 prompt / tools / toolChoice —— 没有 temperature、
    # 没有 max_tokens、没有任何思考强度参数。想调 provider 自己的旋钮只能从
    # 宿主这边加。
    #
    # 不做成「思考强度」这种命名参数：各家 provider 的开关形状完全不同，翻译
    # 语义等于把一堆 provider 知识塞进桥里。
    #
    # 实测 DeepSeek(deepseek-flash)，供下一个人参考：
    #   {"thinking":{"type":"disabled"}}          reasoning_tokens 归零，确定生效
    #   {"thinking":{"type":"enabled"}}           确定生效
    #   + reasoning_effort: low/high/max          API 接受，但 n=2 的样本里
    #                                             742/766/873 组内重叠严重，
    #                                             **没测出可靠差异**，别当定论
    #   thinking.budget_tokens                    未观察到影响
    # 注意 reasoning_effort 必须和 thinking:{"type":"enabled"} 一起发，单发无效。
    #
    # model / messages / stream 是桥对 fx 的协议契约，不会被这里覆盖。
    fx_upstream_extra: dict[str, Any] = field(default_factory=dict)
    # 向 fx 声明这个模型支持哪几档 reasoning effort（逗号分隔）。
    #
    # 声明了 fx 的 /model 选择器和 ACP 的 config option 里才会出现「Reasoning
    # Effort」这一项；不声明用户连选都选不了。fx 只据此决定给不给选择器，
    # 真正生效与否取决于上游 provider。
    #
    # DeepSeek 文档写的是 low / high / max。
    fx_reasoning_efforts: tuple[str, ...] = ()
    # 终端里挡掉的命令（逗号分隔）。留空 = 用默认清单；写一个字面量 "none"
    # 表示什么都不挡。
    #
    # 这是防手滑的减速带，不是安全边界 —— 见 fx_workspace.DEFAULT_DENIED_COMMANDS
    # 里写的原因。
    fx_denied_commands: tuple[str, ...] | None = None
    # 打开终端时接上这本书上一次的对话。
    #
    # 默认**开**：在这之前每次 WebSocket 断开都会杀掉 fx（fx_terminal_routes 的
    # `finally: pty_session.close()`），刷一下页面整段对话就没了。而 fx 自己一直
    # 在存会话，只是从来没人 resume。
    #
    # 关掉它（`RETAIN_AI_FX_RESUME_SESSION=0`）就是每次干净启动。
    fx_resume_session: bool = True
    # 任务产物根目录(data/jobs/<job_id>/...)
    data_root: Path = field(default_factory=lambda: _repo_root() / "data")
    # 助手用量台账写到这个目录下的 usage/assistant.v1.jsonl。只有 load_settings()（真正启动服务）
    # 才设：直接构造 Settings(...) 的测试不会往仓库的 data/ 里写假记录。
    usage_ledger_root: Path | None = None


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
    settings = Settings(
        host=os.environ.get("RETAIN_AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("RETAIN_AI_PORT", "41100")),
        keep_alive_timeout_s=int(os.environ.get("RETAIN_AI_KEEP_ALIVE_TIMEOUT_S", "75")),
        api_keys=api_keys,
        rust_api_base=os.environ.get(
            "RETAIN_AI_RUST_API_BASE", "http://127.0.0.1:41000"
        ).rstrip("/"),
        rust_api_key=os.environ.get("RETAIN_AI_RUST_API_KEY", "").strip(),
        llm_base_url=os.environ.get(
            "RETAIN_AI_LLM_BASE_URL", "https://api.deepseek.com/v1"
        ).rstrip("/"),
        llm_model=os.environ.get("RETAIN_AI_LLM_MODEL", "deepseek-flash"),
        llm_api_key=os.environ.get("RETAIN_AI_LLM_API_KEY", "").strip(),
        llm_credential_ref=os.environ.get("RETAIN_AI_LLM_CREDENTIAL_REF", "").strip(),
        llm_timeout_s=float(os.environ.get("RETAIN_AI_LLM_TIMEOUT_S", "60")),
        max_tool_rounds=int(os.environ.get("RETAIN_AI_MAX_TOOL_ROUNDS", "6")),
        computation_round_bonus=max(
            0, int(os.environ.get("RETAIN_AI_COMPUTATION_ROUND_BONUS", "3"))
        ),
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
        followup_suggestions=os.environ.get(
            "RETAIN_AI_FOLLOWUP_SUGGESTIONS", "1"
        ).strip().lower()
        not in {"0", "false", "no", "off"},
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
            "RETAIN_AI_FX_EXPECTED_VERSION", "0.0.10"
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
        fx_shell_mode=_env_flag("RETAIN_AI_FX_SHELL_MODE"),
        fx_upstream_extra=_env_json_object("RETAIN_AI_FX_UPSTREAM_EXTRA"),
        fx_reasoning_efforts=_env_csv("RETAIN_AI_FX_REASONING_EFFORTS"),
        fx_denied_commands=_env_denied_commands("RETAIN_AI_FX_DENIED_COMMANDS"),
        fx_resume_session=_env_flag_default_on("RETAIN_AI_FX_RESUME_SESSION"),
        data_root=Path(data_root) if data_root else _repo_root() / "data",
        usage_ledger_root=Path(data_root) if data_root else _repo_root() / "data",
    )
    stored = load_runtime_credentials(settings.data_root)
    return apply_runtime_credentials(settings, stored)
