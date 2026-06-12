from __future__ import annotations

"""Atlas Cloud translation provider defaults and credential resolution.

Atlas Cloud (https://www.atlascloud.ai) exposes an OpenAI-compatible
``/v1/chat/completions`` endpoint, so this provider intentionally reuses the
shared OpenAI-compatible transport that already lives in the DeepSeek provider
client. The only Atlas-specific surface is the default base URL, default model,
the credential environment variable / local env file, and the matching API key
resolver.
"""

from foundation.shared.local_env import get_secret

# The shared OpenAI-compatible HTTP transport is provider-neutral; reuse it so
# Atlas Cloud does not duplicate retry / streaming / diagnostics logic.
from services.translation.llm.providers.deepseek.client import build_headers
from services.translation.llm.providers.deepseek.client import chat_completions_url
from services.translation.llm.providers.deepseek.client import get_session
from services.translation.llm.providers.deepseek.client import is_transport_error
from services.translation.llm.providers.deepseek.client import normalize_base_url
from services.translation.llm.providers.deepseek.client import request_chat_content


DEFAULT_BASE_URL = "https://api.atlascloud.ai/v1"
# Atlas Cloud's recommended default chat model. ``deepseek-v4-pro`` is a
# reasoning model, so callers should give it enough ``max_tokens`` (>= 512),
# otherwise the token budget is spent on the reasoning trace and ``content``
# comes back empty with ``finish_reason=length``.
DEFAULT_MODEL = "deepseek-ai/deepseek-v4-pro"
DEFAULT_API_KEY_ENV = "ATLASCLOUD_API_KEY"
DEFAULT_API_KEY_FILE = "atlascloud.env"


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
    "DEFAULT_MODEL",
    "build_headers",
    "chat_completions_url",
    "get_api_key",
    "get_session",
    "is_transport_error",
    "normalize_base_url",
    "request_chat_content",
]
