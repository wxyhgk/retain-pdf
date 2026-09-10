from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from retainpdf_pipeline.ocr.ocr_provider.drivers import list_registered_ocr_provider_drivers
from retainpdf_pipeline.ocr.ocr_provider.drivers import register_ocr_provider_driver
from retainpdf_pipeline.ocr.ocr_provider.drivers import run_registered_ocr_provider
from retainpdf_pipeline.ocr.ocr_provider.types import OcrProviderResult
from retainpdf_pipeline.ocr.ocr_provider.provider_config import OCR_PROVIDER_CONFIG_ENV


def test_ocr_provider_registry_accepts_custom_driver(tmp_path: Path) -> None:
    job_dirs = resolve_job_dirs(tmp_path / "20260616-custom-provider")
    ensure_job_dirs(job_dirs)
    source_pdf_path = job_dirs.source_dir / "book.pdf"
    source_pdf_path.write_bytes(b"%PDF-1.4\n")

    def _driver(args: SimpleNamespace) -> OcrProviderResult:
        normalized_json_path = Path(args.ocr_dir) / "normalized" / "document.v1.json"
        provider_result_json_path = Path(args.ocr_dir) / "custom-result.json"
        normalized_json_path.parent.mkdir(parents=True, exist_ok=True)
        provider_result_json_path.write_text("{}", encoding="utf-8")
        normalized_json_path.write_text("{}", encoding="utf-8")
        return OcrProviderResult(
            job_dirs=job_dirs,
            source_pdf_path=source_pdf_path,
            provider_result_json_path=provider_result_json_path,
            normalized_json_path=normalized_json_path,
            raw_main_payload_path=provider_result_json_path,
        )

    register_ocr_provider_driver("custom-smoke", _driver)

    result = run_registered_ocr_provider(
        "custom-smoke",
        SimpleNamespace(ocr_dir=str(job_dirs.ocr_dir)),
        paddle_driver=_driver,
    )

    assert "custom-smoke" in list_registered_ocr_provider_drivers()
    assert result.provider_result_json_path.name == "custom-result.json"
    assert result.artifact_manifest.raw_main_payload_path == result.provider_result_json_path


def test_ocr_provider_registry_discovers_configured_local_provider(
    tmp_path: Path,
    monkeypatch,
) -> None:
    config_path = tmp_path / "ocr_providers.json"
    config_path.write_text(
        """
{
  "providers": {
    "local-fast": {
      "display_name": "Local Fast OCR",
      "kind": "local_command",
      "credential": null,
      "options": {
        "command": {"type": "string", "default": "python /tmp/local-fast.py"},
        "raw_provider": {"type": "string", "default": "generic_flat_ocr"}
      }
    }
  }
}
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv(OCR_PROVIDER_CONFIG_ENV, str(config_path))

    # The registry is process-global. Force a module reload so config discovery
    # observes this test-specific config without leaking across tests.
    import importlib
    import retainpdf_pipeline.ocr.ocr_provider_config as provider_config
    import retainpdf_pipeline.ocr.ocr_provider.drivers as drivers

    importlib.reload(provider_config)
    drivers = importlib.reload(drivers)
    assert "local-fast" in drivers.list_registered_ocr_provider_drivers()
