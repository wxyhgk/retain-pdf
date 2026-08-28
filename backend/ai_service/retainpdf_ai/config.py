"""Cấu hình qua biến môi trường. Mọi thông tin bí mật chỉ đi qua biến môi trường, không có khóa nào nằm trong mã nguồn hay repo."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _repo_root() -> Path:
    # backend/ai_service/retainpdf_ai/config.py -> gốc repo
    return Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 41100
    # Tập key xác thực của chính dịch vụ này (X-API-Key cùng phong cách với Rust API)
    api_keys: frozenset[str] = field(default_factory=frozenset)
    # Dùng để gọi Rust API
    rust_api_base: str = "http://127.0.0.1:41000"
    rust_api_key: str = ""
    # LLM (DeepSeek hoặc endpoint tương thích)
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-v4-flash"
    llm_api_key: str = ""
    llm_timeout_s: float = 60.0
    # Lan can an toàn cho vòng lặp agent
    max_tool_rounds: int = 6
    # B2 memory: cửa sổ gần đây / vượt ngưỡng thì nén / giới hạn ký tự của MemoryView
    memory_window_turns: int = 6
    memory_compress_after_turns: int = 12
    memory_max_chars: int = 24000
    # Thư mục gốc chứa sản phẩm của tác vụ (data/jobs/<job_id>/...)
    data_root: Path = field(default_factory=lambda: _repo_root() / "data")


def load_settings() -> Settings:
    api_keys = frozenset(
        key.strip()
        for key in os.environ.get("RETAIN_AI_API_KEYS", "").split(",")
        if key.strip()
    )
    data_root = os.environ.get("RETAIN_AI_DATA_ROOT", "").strip()
    return Settings(
        host=os.environ.get("RETAIN_AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("RETAIN_AI_PORT", "41100")),
        api_keys=api_keys,
        rust_api_base=os.environ.get("RETAIN_AI_RUST_API_BASE", "http://127.0.0.1:41000").rstrip("/"),
        rust_api_key=os.environ.get("RETAIN_AI_RUST_API_KEY", "").strip(),
        llm_base_url=os.environ.get("RETAIN_AI_LLM_BASE_URL", "https://api.deepseek.com/v1").rstrip("/"),
        llm_model=os.environ.get("RETAIN_AI_LLM_MODEL", "deepseek-v4-flash"),
        llm_api_key=os.environ.get("RETAIN_AI_LLM_API_KEY", "").strip(),
        llm_timeout_s=float(os.environ.get("RETAIN_AI_LLM_TIMEOUT_S", "60")),
        max_tool_rounds=int(os.environ.get("RETAIN_AI_MAX_TOOL_ROUNDS", "6")),
        memory_window_turns=int(os.environ.get("RETAIN_AI_MEMORY_WINDOW_TURNS", "6")),
        memory_compress_after_turns=int(os.environ.get("RETAIN_AI_MEMORY_COMPRESS_AFTER_TURNS", "12")),
        memory_max_chars=int(os.environ.get("RETAIN_AI_MEMORY_MAX_CHARS", "24000")),
        data_root=Path(data_root) if data_root else _repo_root() / "data",
    )
