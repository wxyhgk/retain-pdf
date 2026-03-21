import os
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parent.parent
ENV_DIR = SCRIPTS_DIR / ".env"


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
    return os.environ.get(env_var, "").strip()
