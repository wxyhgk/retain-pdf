from retainpdf_ai.config import load_settings


def test_atlascloud_key_uses_atlascloud_defaults(monkeypatch):
    monkeypatch.delenv("RETAIN_AI_LLM_API_KEY", raising=False)
    monkeypatch.delenv("RETAIN_AI_LLM_BASE_URL", raising=False)
    monkeypatch.delenv("RETAIN_AI_LLM_MODEL", raising=False)
    monkeypatch.setenv("ATLASCLOUD_API_KEY", "atlas-test-key")

    settings = load_settings()

    assert settings.llm_api_key == "atlas-test-key"
    assert settings.llm_base_url == "https://api.atlascloud.ai/v1"
    assert settings.llm_model == "deepseek-ai/deepseek-v4-pro"


def test_explicit_llm_settings_take_priority_over_atlascloud(monkeypatch):
    monkeypatch.setenv("ATLASCLOUD_API_KEY", "atlas-test-key")
    monkeypatch.setenv("RETAIN_AI_LLM_API_KEY", "explicit-key")
    monkeypatch.setenv("RETAIN_AI_LLM_BASE_URL", "https://llm.example.test/v1/")
    monkeypatch.setenv("RETAIN_AI_LLM_MODEL", "example-model")

    settings = load_settings()

    assert settings.llm_api_key == "explicit-key"
    assert settings.llm_base_url == "https://llm.example.test/v1"
    assert settings.llm_model == "example-model"
