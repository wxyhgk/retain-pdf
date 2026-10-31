from __future__ import annotations

from types import SimpleNamespace

from retainpdf_pipeline.ocr.mineru_provider.job_flow import run_mineru_to_job_dir
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import run_glm_ocr_to_job_dir
from retainpdf_pipeline.ocr.ocr_provider.local_command_driver import run_local_command_ocr_to_job_dir
from retainpdf_pipeline.ocr.ocr_provider.provider_config import configured_command_providers
from retainpdf_pipeline.ocr.ocr_provider.provider_config import ocr_provider_options
from retainpdf_pipeline.ocr.ocr_provider.types import OcrProviderDriver
from retainpdf_pipeline.ocr.ocr_provider.types import OcrProviderResult
from retainpdf_base.events import emit_stage_transition


def normalize_provider_name(provider: str) -> str:
    return str(provider or "mineru").strip().lower()


def _run_mineru_provider(args: SimpleNamespace) -> OcrProviderResult:
    job_dirs, source_pdf_path, provider_result_json_path, normalized_json_path = run_mineru_to_job_dir(
        args
    )
    return OcrProviderResult(
        job_dirs=job_dirs,
        source_pdf_path=source_pdf_path,
        provider_result_json_path=provider_result_json_path,
        normalized_json_path=normalized_json_path,
        raw_main_payload_path=provider_result_json_path,
    )


def _run_local_provider(args: SimpleNamespace) -> OcrProviderResult:
    """内置的 local：命令和 raw_provider 取 ocr_providers.json 里 local 的默认值，没有再看环境变量
    （run_local_command_ocr_to_job_dir 里）。不认任务请求 / stage spec 里的（审计 A2，2026-10-22）。

    配置每次现读，和 Rust 写 stage spec 时读的是同一份。
    """
    _apply_configured_command(args, ocr_provider_options("local"))
    return run_local_command_ocr_to_job_dir(args)


_PROVIDER_DRIVERS: dict[str, OcrProviderDriver] = {
    "mineru": _run_mineru_provider,
    "local": _run_local_provider,
    # 智谱 GLM-OCR（同步接口，分片请求、裁图、归一化都在 worker 里，见 glm_ocr_driver）
    "glm_ocr": run_glm_ocr_to_job_dir,
}
_CONFIG_DISCOVERY_DONE = False


def register_ocr_provider_driver(provider: str, driver: OcrProviderDriver) -> None:
    provider_name = normalize_provider_name(provider)
    if not provider_name:
        raise RuntimeError("OCR provider name must not be empty")
    _PROVIDER_DRIVERS[provider_name] = driver


def list_registered_ocr_provider_drivers() -> list[str]:
    discover_configured_ocr_provider_drivers()
    return sorted(_PROVIDER_DRIVERS.keys())


def discover_configured_ocr_provider_drivers() -> None:
    global _CONFIG_DISCOVERY_DONE
    if _CONFIG_DISCOVERY_DONE:
        return
    for provider_name, definition in configured_command_providers().items():
        if provider_name in _PROVIDER_DRIVERS:
            continue
        _PROVIDER_DRIVERS[provider_name] = _build_local_command_driver(provider_name, definition)
    _CONFIG_DISCOVERY_DONE = True


def _build_local_command_driver(provider_name: str, definition: dict) -> OcrProviderDriver:
    provider_kind = str(definition.get("kind", "") or "").strip().lower()
    options = definition.get("options") if isinstance(definition, dict) else {}
    options = options if isinstance(options, dict) else {}
    command = _option_default(options, "command")
    raw_provider = _option_default(options, "raw_provider")

    def _driver(args: SimpleNamespace) -> OcrProviderResult:
        setattr(args, "provider", provider_name)
        setattr(args, "ocr_provider_kind", provider_kind)
        _apply_command_defaults(args, command, raw_provider)
        return run_local_command_ocr_to_job_dir(args)

    return _driver


def _apply_configured_command(args: SimpleNamespace, options: dict) -> None:
    _apply_command_defaults(
        args,
        _option_default(options, "command"),
        _option_default(options, "raw_provider"),
    )


def _apply_command_defaults(args: SimpleNamespace, command: str, raw_provider: str) -> None:
    # args.local_ocr_command 只由进程内的调用方（测试、这里）设置；provider_pipeline 不再从 stage spec 填它。
    if command and not str(getattr(args, "local_ocr_command", "") or "").strip():
        setattr(args, "local_ocr_command", command)
    if raw_provider and not str(getattr(args, "local_ocr_raw_provider", "") or "").strip():
        setattr(args, "local_ocr_raw_provider", raw_provider)


def _option_default(options: dict, name: str) -> str:
    spec = options.get(name)
    if not isinstance(spec, dict):
        return ""
    return str(spec.get("default", "") or "").strip()


def run_registered_ocr_provider(
    provider: str,
    args: SimpleNamespace,
    *,
    paddle_driver: OcrProviderDriver,
) -> OcrProviderResult:
    provider_name = normalize_provider_name(provider)
    discover_configured_ocr_provider_drivers()
    registry = dict(_PROVIDER_DRIVERS)
    registry["paddle"] = paddle_driver
    driver = registry.get(provider_name)
    if driver is None:
        raise RuntimeError(f"unsupported provider-backed workflow provider: {provider_name}")
    emit_stage_transition(
        stage="ocr_processing",
        substage="ocr_processing",
        message=f"开始执行 {provider_name} OCR provider 流程",
        provider=provider_name,
    )
    return driver(args)


__all__ = [
    "list_registered_ocr_provider_drivers",
    "discover_configured_ocr_provider_drivers",
    "normalize_provider_name",
    "register_ocr_provider_driver",
    "run_registered_ocr_provider",
]
