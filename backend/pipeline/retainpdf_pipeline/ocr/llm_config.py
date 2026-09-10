"""OCR-local LLM endpoint configuration (stage-contract duplicate).

The translate stage owns the canonical provider runtime. The ocr stage only
needs the minimal endpoint facts to decide whether an API key is required and
to normalize the configured URL. Values are duplicated here so ocr never
imports translate; the authoritative knobs remain the translate stage spec
(``translation.base_url``) and environment/credential refs.

Duplicated from:
- retainpdf_pipeline.translate.llm.providers.deepseek.client
  (``DEFAULT_BASE_URL``, ``DEFAULT_API_KEY_ENV``, ``get_api_key`` shape)
- retainpdf_pipeline.translate.llm.providers.deepseek.transport
  (``normalize_base_url``)
"""

from __future__ import annotations

from retainpdf_pipeline.foundation.shared.local_env import get_secret


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY"
DEFAULT_API_KEY_FILE = "deepseek.env"


def normalize_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/chat/completions"):
        normalized = normalized[: -len("/chat/completions")]
    return normalized


def get_api_key(explicit_api_key: str = "", env_var: str = DEFAULT_API_KEY_ENV, required: bool = True) -> str:
    api_key = get_secret(
        explicit_value=explicit_api_key,
        env_var=env_var,
        env_file_name=DEFAULT_API_KEY_FILE,
    )
    if required and not api_key:
        raise RuntimeError(f"Missing API key. Set {env_var}, scripts/.env/{DEFAULT_API_KEY_FILE}, or pass --api-key.")
    return api_key


__all__ = [
    "DEFAULT_API_KEY_ENV",
    "DEFAULT_API_KEY_FILE",
    "DEFAULT_BASE_URL",
    "get_api_key",
    "normalize_base_url",
]
