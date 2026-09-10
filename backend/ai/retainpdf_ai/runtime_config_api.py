"""Runtime configuration and readiness routes for the AI service."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from typing import Any
from urllib.parse import urlsplit

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from . import __version__
from .agent import RetrievalAgent
from .api_contracts import RuntimeConfigUpdate
from .config import (
    FX_DEFAULT_GATEWAY_BASE_URL,
    Settings,
    apply_runtime_credentials,
    fx_gateway_chat_url,
    normalize_agent_confirmation_mode,
    normalize_fx_gateway_base_url,
)
from .credential_vault import CredentialReferenceError, credential_usage_lock
from .runtime import AgentRuntime, build_agent_runtime, probe_fx_gateway_endpoint
from .runtime_credential_refs import (
    RuntimeCredentialInputError,
    runtime_credential_persistence_fields,
    runtime_credential_view_fields,
    select_runtime_credentials,
)
from .runtime_credentials import (
    RuntimeCredentialConflict,
    RuntimeCredentialError,
    load_runtime_credentials,
    save_runtime_credentials,
)
from .rust_client import RustApiClient


def register_runtime_config_routes(
    app: FastAPI,
    *,
    active_settings: Settings,
    runtime: AgentRuntime,
    runtime_id: str,
    rust: RustApiClient | None,
    agent: RetrievalAgent | None,
    restart_runtime: Callable[[], None],
    require_api_key: Callable[[Request], None],
) -> None:
    """Attach runtime-config and readiness endpoints to ``app``."""

    def configured_settings() -> Settings:
        stored = load_runtime_credentials(active_settings.data_root)
        return apply_runtime_credentials(active_settings, stored)

    def runtime_config_view(candidate: Settings | None = None) -> dict[str, Any]:
        candidate = candidate or configured_settings()
        restart_required = (
            candidate.runtime_config_revision != active_settings.runtime_config_revision
        )
        effective_fx_base_url = (
            candidate.fx_gateway_base_url or FX_DEFAULT_GATEWAY_BASE_URL
        )
        effective_fx_chat_url = (
            fx_gateway_chat_url(candidate.fx_gateway_base_url)
            if candidate.fx_gateway_base_url
            else f"{FX_DEFAULT_GATEWAY_BASE_URL}/v3/ai/language-model"
        )
        return {
            "schema": "retainpdf_ai_runtime_config_view_v1",
            "active_runtime": runtime_id,
            "configured_runtime": candidate.agent_runtime,
            "agent_confirmation_mode": candidate.agent_confirmation_mode,
            "configured_revision": candidate.runtime_config_revision,
            "active_revision": active_settings.runtime_config_revision,
            "restart_state": "pending" if restart_required else "active",
            "llm_base_url": candidate.llm_base_url,
            "llm_model": candidate.llm_model,
            **runtime_credential_view_fields(candidate),
            "fx_gateway_base_url": candidate.fx_gateway_base_url,
            "fx_gateway_mode": candidate.fx_gateway_base_url_mode,
            "fx_gateway_effective_base_url": effective_fx_base_url,
            "fx_gateway_effective_chat_url": effective_fx_chat_url,
            "fx_model": candidate.fx_model,
            "restart_required": restart_required,
        }

    @app.get("/readyz")
    def readyz() -> JSONResponse:
        try:
            configured = configured_settings()
        except (CredentialReferenceError, RuntimeCredentialError):
            return JSONResponse(
                status_code=503,
                content={
                    "ok": False,
                    "reason": "credential_reference_unavailable",
                    "active_revision": active_settings.runtime_config_revision,
                },
            )
        if (
            configured.runtime_config_revision
            != active_settings.runtime_config_revision
        ):
            return JSONResponse(
                status_code=503,
                content={
                    "ok": False,
                    "reason": "runtime_config_restart_pending",
                    "active_revision": active_settings.runtime_config_revision,
                    "configured_revision": configured.runtime_config_revision,
                },
            )
        if (
            active_settings.agent_runtime == "fx"
            and active_settings.fx_gateway_base_url
        ):
            try:
                probe_fx_gateway_endpoint(
                    active_settings.fx_gateway_base_url,
                    timeout=min(active_settings.fx_startup_timeout_s, 1.5),
                )
            except RuntimeError:
                return JSONResponse(
                    status_code=503,
                    content={
                        "ok": False,
                        "reason": "fx_gateway_unreachable",
                        "active_revision": active_settings.runtime_config_revision,
                        "configured_revision": configured.runtime_config_revision,
                    },
                )
        return JSONResponse(
            content={
                "ok": True,
                "version": __version__,
                "agent_runtime": runtime_id,
                "capabilities": runtime.capabilities.public_view(),
                "active_revision": active_settings.runtime_config_revision,
                "configured_revision": configured.runtime_config_revision,
            }
        )

    @app.get("/v1/runtime-config", dependencies=[Depends(require_api_key)])
    def get_runtime_config() -> dict[str, Any]:
        try:
            return {"data": runtime_config_view()}
        except (CredentialReferenceError, RuntimeCredentialError) as exc:
            raise _credential_config_unavailable() from exc

    def update_runtime_config_locked(
        payload: RuntimeConfigUpdate,
        background_tasks: BackgroundTasks,
    ) -> dict[str, Any]:
        current = configured_settings()
        if (
            payload.expected_revision is not None
            and payload.expected_revision != current.runtime_config_revision
        ):
            raise HTTPException(
                status_code=409,
                detail="AI 配置已被其他请求更新；请刷新后重试。",
            )
        selected_runtime = (
            payload.agent_runtime.strip().lower()
            if payload.agent_runtime is not None
            else current.agent_runtime
        )
        if selected_runtime not in {"python", "openai", "fx"}:
            raise HTTPException(
                status_code=400,
                detail="运行模式只能是 python、openai 或 fx。",
            )
        try:
            agent_confirmation_mode = normalize_agent_confirmation_mode(
                payload.agent_confirmation_mode
                if payload.agent_confirmation_mode is not None
                else current.agent_confirmation_mode
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        try:
            credentials = select_runtime_credentials(
                current,
                payload,
                active_settings.data_root,
            )
        except RuntimeCredentialInputError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        llm_base_url = current.llm_base_url
        if payload.llm_base_url is not None:
            llm_base_url = _validate_base_url(payload.llm_base_url)
        llm_model = current.llm_model
        if payload.llm_model is not None:
            llm_model = payload.llm_model.strip()
            if not llm_model:
                raise HTTPException(status_code=400, detail="模型名称不能为空。")
        fx_gateway_base_url = current.fx_gateway_base_url
        fx_gateway_base_url_mode = current.fx_gateway_base_url_mode
        if payload.fx_gateway_base_url is not None:
            try:
                fx_gateway_base_url = normalize_fx_gateway_base_url(
                    payload.fx_gateway_base_url
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            fx_gateway_base_url_mode = (
                "custom" if fx_gateway_base_url else "official_default"
            )
        fx_model = current.fx_model
        if payload.fx_model is not None:
            fx_model = payload.fx_model.strip()

        candidate = replace(
            current,
            agent_runtime=selected_runtime,
            agent_confirmation_mode=agent_confirmation_mode,
            llm_base_url=llm_base_url,
            llm_model=llm_model,
            llm_api_key=credentials.llm_api_key,
            llm_credential_ref=credentials.llm_credential_ref,
            fx_gateway_base_url=fx_gateway_base_url,
            fx_gateway_base_url_mode=fx_gateway_base_url_mode,
            fx_gateway_api_key=credentials.fx_gateway_api_key,
            fx_gateway_credential_ref=credentials.fx_gateway_credential_ref,
            fx_model=fx_model,
        )
        _validate_candidate(candidate, rust=rust, agent=agent)

        changed = any(
            (
                candidate.agent_runtime != current.agent_runtime,
                candidate.agent_confirmation_mode != current.agent_confirmation_mode,
                candidate.llm_base_url != current.llm_base_url,
                candidate.llm_model != current.llm_model,
                candidate.llm_api_key != current.llm_api_key,
                candidate.llm_credential_ref != current.llm_credential_ref,
                candidate.fx_gateway_base_url != current.fx_gateway_base_url,
                candidate.fx_gateway_base_url_mode != current.fx_gateway_base_url_mode,
                candidate.fx_gateway_api_key != current.fx_gateway_api_key,
                candidate.fx_gateway_credential_ref
                != current.fx_gateway_credential_ref,
                candidate.fx_model != current.fx_model,
            )
        )
        if not changed:
            return {"data": runtime_config_view(current)}
        try:
            save_runtime_credentials(
                active_settings.data_root,
                {
                    "agent_runtime": candidate.agent_runtime,
                    "agent_confirmation_mode": candidate.agent_confirmation_mode,
                    "llm_base_url": candidate.llm_base_url,
                    "llm_model": candidate.llm_model,
                    **runtime_credential_persistence_fields(candidate),
                    "fx_gateway_base_url": candidate.fx_gateway_base_url,
                    "fx_gateway_base_url_mode": candidate.fx_gateway_base_url_mode,
                    "fx_model": candidate.fx_model,
                },
                expected_revision=current.runtime_config_revision,
            )
        except RuntimeCredentialConflict as exc:
            raise HTTPException(
                status_code=409,
                detail="AI 配置已被其他请求更新；请刷新后重试。",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"安全保存 AI 配置失败：{exc}",
            ) from exc
        saved = configured_settings()
        background_tasks.add_task(restart_runtime)
        return {"data": runtime_config_view(saved)}

    @app.put("/v1/runtime-config", dependencies=[Depends(require_api_key)])
    def update_runtime_config(
        payload: RuntimeConfigUpdate,
        background_tasks: BackgroundTasks,
    ) -> dict[str, Any]:
        try:
            with credential_usage_lock(active_settings.data_root):
                return update_runtime_config_locked(payload, background_tasks)
        except (CredentialReferenceError, RuntimeCredentialError) as exc:
            raise _credential_config_unavailable() from exc


def _credential_config_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail="AI runtime credential reference is unavailable.",
    )


def _validate_base_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urlsplit(normalized)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
    ):
        raise HTTPException(
            status_code=400,
            detail="模型 API URL 必须是无内嵌凭据的 http(s) 地址。",
        )
    return normalized


def _validate_candidate(
    candidate: Settings,
    *,
    rust: RustApiClient | None,
    agent: RetrievalAgent | None,
) -> None:
    selected_runtime = candidate.agent_runtime
    if selected_runtime in {"python", "openai"} and not candidate.llm_api_key:
        mode = "OpenAI-compatible Agent" if selected_runtime == "openai" else "普通问答"
        raise HTTPException(status_code=400, detail=f"{mode}模式需要模型 API Key。")
    if selected_runtime == "fx":
        if not candidate.fx_gateway_api_key:
            raise HTTPException(
                status_code=400, detail="FX Agent 模式需要 Gateway Key。"
            )
        if rust is None or agent is None:
            raise HTTPException(status_code=503, detail="FX Agent 运行环境不可用。")
        try:
            build_agent_runtime(candidate, rust, agent)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"FX Agent 自检失败：{exc}",
            ) from exc
    if selected_runtime == "openai":
        if rust is None or agent is None:
            raise HTTPException(
                status_code=503,
                detail="OpenAI-compatible Agent 运行环境不可用。",
            )
        try:
            build_agent_runtime(candidate, rust, agent)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"OpenAI-compatible Agent 自检失败：{exc}",
            ) from exc
