import os
from pathlib import Path


PIPELINE_ENV_DIR_ENV = "RETAIN_PDF_ENV_DIR"


def _env_dir() -> Path:
    override = os.environ.get(PIPELINE_ENV_DIR_ENV, "").strip()
    if override:
        return Path(override).expanduser().resolve()
    # Source checkout compatibility. Installed wheels should use the explicit
    # env var (or process environment) instead of relying on package location.
    return Path(__file__).resolve().parents[3] / ".env"


ENV_DIR = _env_dir()


def load_env_file(env_name: str) -> dict[str, str]:
    path = ENV_DIR / env_name
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def load_raw_secret(env_name: str) -> str:
    path = ENV_DIR / env_name
    if not path.exists() or not path.is_file():
        return ""

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" in line:
            continue
        return line
    return ""


def get_secret(
    *,
    explicit_value: str = "",
    env_var: str,
    env_file_name: str,
) -> str:
    if explicit_value.strip():
        return explicit_value.strip()
    file_values = load_env_file(env_file_name)
    if env_var in file_values and file_values[env_var].strip():
        return file_values[env_var].strip()
    raw_secret = load_raw_secret(env_file_name)
    if raw_secret:
        return raw_secret
    return os.environ.get(env_var, "").strip()
