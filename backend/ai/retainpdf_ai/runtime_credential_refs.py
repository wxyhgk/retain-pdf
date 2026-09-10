"""Credential-reference selection for AI runtime configuration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .api_contracts import RuntimeConfigUpdate
from .config import Settings
from .credential_vault import CredentialReferenceError, resolve_credential
from .runtime_credentials import masked_secret


class RuntimeCredentialInputError(RuntimeError):
    """A safe runtime-config credential validation error."""


@dataclass(frozen=True)
class RuntimeCredentialSelection:
    llm_api_key: str
    llm_credential_ref: str
    fx_gateway_api_key: str
    fx_gateway_credential_ref: str


def select_runtime_credentials(
    current: Settings,
    payload: RuntimeConfigUpdate,
    data_root: Path,
) -> RuntimeCredentialSelection:
    llm_key = (payload.llm_api_key or "").strip()
    llm_ref = (payload.llm_credential_ref or "").strip()
    fx_key = (payload.fx_gateway_api_key or "").strip()
    fx_ref = (payload.fx_gateway_credential_ref or "").strip()
    _reject_ambiguous_input(
        key=llm_key,
        credential_ref=llm_ref,
        clear=payload.clear_llm_api_key,
        label="模型",
    )
    _reject_ambiguous_input(
        key=fx_key,
        credential_ref=fx_ref,
        clear=payload.clear_fx_gateway_api_key,
        label="Gateway",
    )

    selected_llm_key, selected_llm_ref = _select_one(
        current_key=current.llm_api_key,
        current_ref=current.llm_credential_ref,
        requested_key=llm_key,
        requested_ref=llm_ref,
        clear=payload.clear_llm_api_key,
        data_root=data_root,
        expected_kind="agent_llm_api_key",
    )
    selected_fx_key, selected_fx_ref = _select_one(
        current_key=current.fx_gateway_api_key,
        current_ref=current.fx_gateway_credential_ref,
        requested_key=fx_key,
        requested_ref=fx_ref,
        clear=payload.clear_fx_gateway_api_key,
        data_root=data_root,
        expected_kind="fx_gateway_api_key",
    )
    return RuntimeCredentialSelection(
        llm_api_key=selected_llm_key,
        llm_credential_ref=selected_llm_ref,
        fx_gateway_api_key=selected_fx_key,
        fx_gateway_credential_ref=selected_fx_ref,
    )


def runtime_credential_view_fields(settings: Settings) -> dict[str, Any]:
    return {
        "llm_credential_ref": settings.llm_credential_ref,
        "llm_api_key_configured": bool(settings.llm_api_key.strip()),
        "llm_api_key_masked": (
            "••••"
            if settings.llm_credential_ref
            else masked_secret(settings.llm_api_key)
        ),
        "fx_gateway_credential_ref": settings.fx_gateway_credential_ref,
        "fx_gateway_api_key_configured": bool(settings.fx_gateway_api_key.strip()),
        "fx_gateway_api_key_masked": (
            "••••"
            if settings.fx_gateway_credential_ref
            else masked_secret(settings.fx_gateway_api_key)
        ),
    }


def runtime_credential_persistence_fields(settings: Settings) -> dict[str, str]:
    return {
        "llm_api_key": "" if settings.llm_credential_ref else settings.llm_api_key,
        "llm_credential_ref": settings.llm_credential_ref,
        "fx_gateway_api_key": (
            "" if settings.fx_gateway_credential_ref else settings.fx_gateway_api_key
        ),
        "fx_gateway_credential_ref": settings.fx_gateway_credential_ref,
    }


def _reject_ambiguous_input(
    *,
    key: str,
    credential_ref: str,
    clear: bool,
    label: str,
) -> None:
    if key and credential_ref:
        raise RuntimeCredentialInputError(
            f"{label} key 和 credential_ref 不能同时设置。"
        )
    if clear and (key or credential_ref):
        raise RuntimeCredentialInputError(f"{label} key 不能同时保存和清除。")


def _select_one(
    *,
    current_key: str,
    current_ref: str,
    requested_key: str,
    requested_ref: str,
    clear: bool,
    data_root: Path,
    expected_kind: str,
) -> tuple[str, str]:
    if clear:
        return "", ""
    if requested_key:
        return requested_key, ""
    if not requested_ref:
        return current_key, current_ref
    try:
        secret = resolve_credential(
            data_root,
            requested_ref,
            expected_kind,
            usage_lock_held=True,
        )
    except CredentialReferenceError as exc:
        raise RuntimeCredentialInputError(str(exc)) from exc
    return secret, requested_ref
