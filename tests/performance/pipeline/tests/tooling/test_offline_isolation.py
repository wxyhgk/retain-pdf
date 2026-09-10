"""Negative probes use synthetic targets; never resolve or contact a provider."""
import json
import subprocess

import pytest

from support.offline import child_command, child_environment


@pytest.mark.parametrize("operation", [
    "import socket; socket.getaddrinfo('unused.invalid', 443)",
    "import socket; socket.socket().connect(('127.0.0.1', 1))",
    "import socket; socket.socket().connect_ex(('127.0.0.1', 1))",
    "import requests; requests.get('https://unused.invalid')",
])
def test_child_blocks_network_during_module_import(tmp_path, operation):
    (tmp_path / "import_target.py").write_text(operation)
    script = tmp_path / "entry.py"
    script.write_text("import import_target")
    process = subprocess.run(child_command(script), env=child_environment(tmp_path),
                             capture_output=True, text=True, timeout=20)
    assert process.returncode != 0
    assert "offline test attempted network access" in process.stderr


def test_child_drops_parent_settings_and_isolates_all_cache_roots(tmp_path, monkeypatch):
    for name in ("OPENAI_API_KEY", "HTTPS_PROXY", "RETAIN_MODEL_CAPABILITY",
                 "RETAIN_TRANSLATION_CAPTURE_DIR", "OUTPUT_ROOT", "PYTEST_ADDOPTS"):
        monkeypatch.setenv(name, "synthetic-parent-only")
    env = child_environment(tmp_path)
    assert "synthetic-parent-only" not in env.values()
    script = tmp_path / "entry.py"
    script.write_text(
        "import json\nfrom retainpdf_pipeline.foundation.config import paths\n"
        "print(json.dumps([str(paths.TRANSLATION_UNIT_CACHE_DIR), "
        "str(paths.DOMAIN_CONTEXT_CACHE_DIR), str(paths.RENDER_TYPOGRAPHY_MEMORY_DIR)]))\n"
    )
    process = subprocess.run(child_command(script), env=env, capture_output=True, text=True, timeout=20)
    assert process.returncode == 0, process.stderr
    roots = json.loads(process.stdout.splitlines()[-1])
    assert roots == [str(tmp_path / "cache" / name) for name in
                     ("_translation_unit_cache", "_domain_context_cache", "_render_typography_memory")]


@pytest.mark.parametrize("operation", [
    "target.read_text()", "target.write_text('changed')",
    "sqlite3.connect(target)", "sqlite3.connect(target.as_uri() + '?mode=ro', uri=True)",
])
def test_child_denies_synthetic_private_data_before_access(tmp_path, operation):
    private = tmp_path / "synthetic-private"
    private.mkdir()
    sentinel = private / "sentinel"
    sentinel.write_text("synthetic-unchanged")
    script = tmp_path / "entry.py"
    script.write_text(
        "from pathlib import Path\nimport sqlite3\n"
        "from support.offline import forbid_private_data\n"
        f"target = Path({str(sentinel)!r})\nforbid_private_data([target.parent])\n{operation}\n"
    )
    process = subprocess.run(child_command(script), env=child_environment(tmp_path),
                             capture_output=True, text=True, timeout=20)
    assert process.returncode != 0
    assert "offline child attempted private data access" in process.stderr
    assert sentinel.read_text() == "synthetic-unchanged"
