from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

OCR_PROVIDER_CONFIG_ENV = "RETAIN_OCR_PROVIDER_CONFIG"
PADDLE_DEFAULT_MODEL_ENV = "RETAIN_PADDLE_DEFAULT_MODEL"
PADDLE_DEFAULT_MODEL_FALLBACK = "PaddleOCR-VL-1.6"


def paddle_default_model() -> str:
    override = str(os.environ.get(PADDLE_DEFAULT_MODEL_ENV, "") or "").strip()
    if override:
        return override
    return str(_paddle_config().get("default_model") or PADDLE_DEFAULT_MODEL_FALLBACK).strip()


def normalize_paddle_model_name(model: str) -> str:
    trimmed = str(model or "").strip()
    if not trimmed:
        return paddle_default_model()
    aliases = _paddle_aliases()
    return aliases.get(trimmed.lower(), trimmed)


def ocr_provider_config() -> dict[str, Any]:
    return dict(_ocr_provider_config())


def ocr_provider_definitions() -> dict[str, dict[str, Any]]:
    providers = _ocr_provider_config().get("providers")
    if not isinstance(providers, dict):
        return _legacy_provider_definitions()
    normalized: dict[str, dict[str, Any]] = {}
    for key, value in providers.items():
        provider_key = str(key or "").strip().lower()
        if not provider_key or not isinstance(value, dict):
            continue
        normalized[provider_key] = dict(value)
    return normalized


def ocr_provider_definition(provider: str) -> dict[str, Any]:
    provider_key = str(provider or "").strip().lower()
    return dict(ocr_provider_definitions().get(provider_key) or {})


def ocr_provider_options(provider: str) -> dict[str, dict[str, Any]]:
    options = ocr_provider_definition(provider).get("options")
    if not isinstance(options, dict):
        return {}
    return {
        str(key).strip(): dict(value)
        for key, value in options.items()
        if str(key).strip() and isinstance(value, dict)
    }


def ocr_provider_credential_spec(provider: str) -> dict[str, Any] | None:
    credential = ocr_provider_definition(provider).get("credential")
    return dict(credential) if isinstance(credential, dict) else None


def configured_command_providers() -> dict[str, dict[str, Any]]:
    return {
        key: definition
        for key, definition in ocr_provider_definitions().items()
        if str(definition.get("kind", "") or "").strip().lower()
        in {"local_command", "remote_command"}
    }


def configured_local_command_providers() -> dict[str, dict[str, Any]]:
    return {
        key: definition
        for key, definition in configured_command_providers().items()
        if str(definition.get("kind", "") or "").strip().lower() == "local_command"
    }


def configured_remote_command_providers() -> dict[str, dict[str, Any]]:
    return {
        key: definition
        for key, definition in configured_command_providers().items()
        if str(definition.get("kind", "") or "").strip().lower() == "remote_command"
    }


def _paddle_aliases() -> dict[str, str]:
    aliases = _paddle_config().get("model_aliases") or {}
    paddle_model_option = ocr_provider_options("paddle").get("paddle_model") or {}
    option_aliases = paddle_model_option.get("aliases")
    if isinstance(option_aliases, dict):
        aliases = {**dict(aliases), **option_aliases}
    if not isinstance(aliases, dict):
        return {}
    return {
        str(key).strip().lower(): str(value).strip()
        for key, value in aliases.items()
        if str(key).strip() and str(value).strip()
    }


def _paddle_config() -> dict[str, Any]:
    payload = _ocr_provider_config()
    paddle = payload.get("paddle") if isinstance(payload, dict) else {}
    legacy = dict(paddle or {}) if isinstance(paddle, dict) else {}
    providers = payload.get("providers") if isinstance(payload, dict) else {}
    paddle_definition = providers.get("paddle") if isinstance(providers, dict) else {}
    paddle_options = (
        paddle_definition.get("options")
        if isinstance(paddle_definition, dict)
        else {}
    )
    paddle_options = paddle_options if isinstance(paddle_options, dict) else {}
    model_option = paddle_options.get("paddle_model") or {}
    if "default_model" not in legacy and isinstance(model_option, dict):
        default_model = str(model_option.get("default", "") or "").strip()
        if default_model:
            legacy["default_model"] = default_model
    if "model_aliases" not in legacy and isinstance(model_option.get("aliases"), dict):
        legacy["model_aliases"] = dict(model_option.get("aliases") or {})
    return legacy


def _legacy_provider_definitions() -> dict[str, dict[str, Any]]:
    paddle = _paddle_config()
    paddle_default = str(paddle.get("default_model") or PADDLE_DEFAULT_MODEL_FALLBACK).strip()
    paddle_aliases = dict(paddle.get("model_aliases") or {})
    return {
        "mineru": {
            "display_name": "MinerU",
            "kind": "remote",
            "credential": {
                "field": "mineru_token",
                "env": "RETAIN_MINERU_API_TOKEN",
                "required_for": ["remote_url", "local_upload"],
            },
            "options": {
                "model_version": {"type": "string", "default": "vlm"},
                "language": {"type": "string", "default": "ch"},
                "disable_formula": {"type": "boolean", "default": False},
                "disable_table": {"type": "boolean", "default": False},
            },
        },
        "paddle": {
            "display_name": "PaddleOCR",
            "kind": "remote",
            "credential": {
                "field": "paddle_token",
                "env": "RETAIN_PADDLE_API_TOKEN",
                "required_for": ["remote_url", "local_upload"],
            },
            "options": {
                "paddle_api_url": {"type": "string", "default": ""},
                "paddle_model": {
                    "type": "string",
                    "default": paddle_default,
                    "aliases": paddle_aliases,
                },
            },
        },
        "local": {
            "display_name": "Local OCR",
            "kind": "local_command",
            "credential": None,
            "options": {
                "command": {
                    "type": "string",
                    "env": "RETAIN_LOCAL_OCR_COMMAND",
                    "default": "",
                },
                "raw_provider": {
                    "type": "string",
                    "env": "RETAIN_OCR_RAW_PROVIDER",
                    "default": "generic_flat_ocr",
                },
            },
        },
    }


def _ocr_provider_config() -> dict[str, Any]:
    return _load_ocr_provider_config(str(_config_path()))


@lru_cache(maxsize=8)
def _load_ocr_provider_config(path_text: str) -> dict[str, Any]:
    """Cache each configured source independently.

    Tests and embedded hosts may temporarily switch RETAIN_OCR_PROVIDER_CONFIG.
    Keying the cache by resolved path prevents one temporary provider registry
    from leaking into later normalization jobs after the environment is restored.
    """
    path = Path(path_text)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return dict(payload or {}) if isinstance(payload, dict) else {}


def _config_path() -> Path:
    override = str(os.environ.get(OCR_PROVIDER_CONFIG_ENV, "") or "").strip()
    if override:
        return Path(override).expanduser().resolve()
    file_path = Path(__file__).resolve()
    # The backend workspace owns the registry at <services-root>/config.
    # Keep the older monorepo layouts readable while downstream bundles migrate.
    for parent in file_path.parents:
        for candidate in (
            parent / "config" / "ocr_providers.json",
            parent / "services" / "config" / "ocr_providers.json",
            parent / "packages" / "config" / "ocr_providers.json",
            parent / "backend" / "config" / "ocr_providers.json",
        ):
            if candidate.exists():
                return candidate
    for env_name in ("RETAIN_PDF_PROJECT_ROOT", "RUST_API_PROJECT_ROOT"):
        project_root = os.environ.get(env_name, "").strip()
        if project_root:
            root = Path(project_root).expanduser().resolve()
            for candidate in (
                root / "config" / "ocr_providers.json",
                root / "services" / "config" / "ocr_providers.json",
                root / "packages" / "config" / "ocr_providers.json",
                root / "backend" / "config" / "ocr_providers.json",
            ):
                if candidate.exists():
                    return candidate
    # Installed wheels intentionally do not guess from site-packages. The
    # explicit config env is authoritative; cwd keeps local CLI use convenient.
    return Path.cwd().resolve() / "config" / "ocr_providers.json"


__all__ = [
    "OCR_PROVIDER_CONFIG_ENV",
    "PADDLE_DEFAULT_MODEL_ENV",
    "PADDLE_DEFAULT_MODEL_FALLBACK",
    "configured_command_providers",
    "configured_local_command_providers",
    "configured_remote_command_providers",
    "normalize_paddle_model_name",
    "ocr_provider_config",
    "ocr_provider_credential_spec",
    "ocr_provider_definition",
    "ocr_provider_definitions",
    "ocr_provider_options",
    "paddle_default_model",
]
