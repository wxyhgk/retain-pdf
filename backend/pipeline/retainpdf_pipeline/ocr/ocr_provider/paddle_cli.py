from __future__ import annotations

import base64
import json
import mimetypes
import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any


PADDLE_CLI_PATH_ENV = "RETAIN_PADDLE_CLI_PATH"
PADDLE_CLI_TIMEOUT_ENV = "RETAIN_PADDLE_CLI_TIMEOUT_SECONDS"
PADDLE_CLI_MODEL_TYPE_DOC_PARSING = "doc_parsing"
PADDLE_CLI_MODEL_TYPE_OCR = "ocr"
PADDLE_CLI_MODEL_TYPES = {
    PADDLE_CLI_MODEL_TYPE_DOC_PARSING,
    PADDLE_CLI_MODEL_TYPE_OCR,
}
PADDLE_CLI_OCR_MODELS = {"PP-OCRv5", "PP-OCRv5-latin", "PP-OCRv6"}
PADDLE_CLI_MAX_TIMEOUT_SECONDS = 7200.0


@dataclass(frozen=True)
class PaddleCliArtifacts:
    payload: dict[str, Any]
    raw_payload_path: Path
    resources_dir: Path
    stdout_path: Path
    stderr_path: Path
    model_type: str


def run_paddle_cli(
    *,
    args: SimpleNamespace,
    source_pdf_path: Path,
    token: str,
    model_name: str,
    raw_root: Path,
) -> PaddleCliArtifacts:
    """Run the optional PaddleOCR cloud CLI without importing its SDK.

    The token is passed through the child environment, never argv. All output
    paths are created below the job's OCR directory, and subprocess execution
    deliberately keeps ``shell=False``.
    """

    options = _options(args)
    model_type = _model_type(options)
    _validate_model_for_task(model_name=model_name, model_type=model_type)
    executable = _resolve_executable()

    run_dir = raw_root / f"run-{time.time_ns()}"
    resources_dir = run_dir / "resources"
    raw_payload_path = run_dir / "result.json"
    stdout_path = run_dir / "stdout.log"
    stderr_path = run_dir / "stderr.log"
    resources_dir.mkdir(parents=True, exist_ok=False)

    request_timeout = _positive_float(options.get("cli_request_timeout"), 300.0)
    poll_timeout = _positive_float(
        options.get("cli_poll_timeout"),
        float(getattr(args, "poll_timeout", 600) or 600),
    )
    outer_timeout = _outer_timeout(
        options=options,
        request_timeout=request_timeout,
        poll_timeout=poll_timeout,
    )

    command = [
        executable,
        "api",
        "--model_type",
        model_type,
        "--model",
        model_name,
        "--file_path",
        str(source_pdf_path.resolve()),
        "--output",
        str(raw_payload_path),
        "--save_resources",
        str(resources_dir),
        "--request_timeout",
        _number_arg(request_timeout),
        "--poll_timeout",
        _number_arg(poll_timeout),
    ]
    base_url = str(getattr(args, "paddle_api_url", "") or "").strip()
    if base_url:
        command.extend(["--base_url", base_url])
    page_ranges = str(getattr(args, "page_ranges", "") or "").strip()
    if page_ranges:
        command.extend(["--page_ranges", page_ranges])
    command.extend(_optional_cli_args(args=args, options=options, model_type=model_type))

    env = os.environ.copy()
    env["PADDLEOCR_ACCESS_TOKEN"] = token
    try:
        completed = subprocess.run(
            command,
            shell=False,
            cwd=str(run_dir),
            env=env,
            text=True,
            capture_output=True,
            check=False,
            timeout=outer_timeout,
        )
    except subprocess.TimeoutExpired as exc:
        stdout_path.write_text(_timeout_text(exc.stdout), encoding="utf-8")
        stderr_path.write_text(_timeout_text(exc.stderr), encoding="utf-8")
        raise RuntimeError(
            f"PaddleOCR CLI timed out after {outer_timeout:.0f}s; logs={run_dir}"
        ) from exc

    stdout_path.write_text(completed.stdout or "", encoding="utf-8")
    stderr_path.write_text(completed.stderr or "", encoding="utf-8")
    if completed.returncode != 0:
        raise RuntimeError(
            f"PaddleOCR CLI failed with exit code {completed.returncode}; logs={run_dir}"
        )
    if not raw_payload_path.is_file():
        raise RuntimeError(
            f"PaddleOCR CLI completed without writing result JSON: {raw_payload_path}"
        )
    try:
        payload = json.loads(raw_payload_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"invalid PaddleOCR CLI result JSON: {raw_payload_path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"PaddleOCR CLI result must be a JSON object: {raw_payload_path}")
    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise RuntimeError(f"PaddleOCR CLI result is missing pages[]: {raw_payload_path}")
    return PaddleCliArtifacts(
        payload=payload,
        raw_payload_path=raw_payload_path,
        resources_dir=resources_dir,
        stdout_path=stdout_path,
        stderr_path=stderr_path,
        model_type=model_type,
    )


def paddle_cli_payload_for_document_schema(
    *,
    artifacts: PaddleCliArtifacts,
    pdf_page_sizes: list[tuple[float, float]],
) -> dict[str, Any]:
    """Convert the CLI's public JSON into the existing Paddle adapter shape.

    The current CLI intentionally omits ``prunedResult`` from doc-parsing
    output. In that mode one full-page block is emitted so Markdown remains
    available while metadata explicitly records coarse page-level geometry.
    OCR mode retains line boxes from ``rec_boxes``/``rec_polys``.
    """

    cli_payload = artifacts.payload
    raw_pages = list(cli_payload.get("pages") or [])
    layout_results: list[dict[str, Any]] = []
    page_meta: list[dict[str, Any]] = []
    for page_index, raw_page in enumerate(raw_pages):
        page = dict(raw_page or {}) if isinstance(raw_page, dict) else {}
        pdf_width, pdf_height = _page_size(pdf_page_sizes, page_index)
        if artifacts.model_type == PADDLE_CLI_MODEL_TYPE_OCR:
            normalized_page, raw_width, raw_height = _ocr_page(
                page=page,
                page_index=page_index,
                pdf_width=pdf_width,
                pdf_height=pdf_height,
            )
            precision = "block_bbox"
        else:
            normalized_page, raw_width, raw_height = _doc_parsing_page(
                page=page,
                page_index=page_index,
                pdf_width=pdf_width,
                pdf_height=pdf_height,
                resources_dir=artifacts.resources_dir,
            )
            precision = "page_bbox"
        normalized_page.setdefault("_cli", {}).update(
            {
                "transport": "official_cli",
                "geometry_precision": precision,
            }
        )
        layout_results.append(normalized_page)
        page_meta.append(
            {
                "pageIndex": page_index,
                "width": raw_width,
                "height": raw_height,
                "unit": "px" if artifacts.model_type == PADDLE_CLI_MODEL_TYPE_OCR else "pt",
            }
        )

    return {
        "layoutParsingResults": layout_results,
        "dataInfo": {
            "numPages": len(layout_results),
            "pages": page_meta,
            "cliGeometryPrecision": (
                "block_bbox"
                if artifacts.model_type == PADDLE_CLI_MODEL_TYPE_OCR
                else "page_bbox"
            ),
        },
        "_meta": {
            "source": "paddle_cli",
            "transport": "official_cli",
            "taskId": str(cli_payload.get("jobId", "") or ""),
            "cliModelType": artifacts.model_type,
            "cliRawPayload": str(artifacts.raw_payload_path),
            "cliResources": str(artifacts.resources_dir),
            "cliStdout": str(artifacts.stdout_path),
            "cliStderr": str(artifacts.stderr_path),
            "cliGeometryPrecision": (
                "block_bbox"
                if artifacts.model_type == PADDLE_CLI_MODEL_TYPE_OCR
                else "page_bbox"
            ),
        },
    }


def _doc_parsing_page(
    *,
    page: dict[str, Any],
    page_index: int,
    pdf_width: float,
    pdf_height: float,
    resources_dir: Path,
) -> tuple[dict[str, Any], float, float]:
    markdown_text = str(page.get("markdownText", "") or "")
    markdown_images = _materializable_images(page.get("markdownImages"), resources_dir)
    block_bbox = [0.0, 0.0, max(pdf_width, 1.0), max(pdf_height, 1.0)]
    blocks = []
    if markdown_text.strip():
        blocks.append(
            {
                "block_label": "text",
                "block_content": markdown_text,
                "block_bbox": block_bbox,
                "block_score": None,
                "_cli_geometry_precision": "page_bbox",
            }
        )
    return (
        {
            **page,
            "prunedResult": {
                "width": max(pdf_width, 1.0),
                "height": max(pdf_height, 1.0),
                "page_count": 1,
                "model_settings": {
                    "transport": "official_cli",
                    "geometry_precision": "page_bbox",
                },
                "parsing_res_list": blocks,
            },
            "markdown": {"text": markdown_text, "images": markdown_images},
            "outputImages": dict(page.get("outputImages") or {}),
            "pageIndex": page_index,
        },
        max(pdf_width, 1.0),
        max(pdf_height, 1.0),
    )


def _ocr_page(
    *,
    page: dict[str, Any],
    page_index: int,
    pdf_width: float,
    pdf_height: float,
) -> tuple[dict[str, Any], float, float]:
    pruned = dict(page.get("prunedResult") or {})
    blocks = pruned.get("parsing_res_list")
    if not isinstance(blocks, list):
        blocks = _ocr_line_blocks(pruned)
    raw_width, raw_height = _ocr_image_size(
        pruned,
        fallback_width=max(pdf_width, 1.0),
        fallback_height=max(pdf_height, 1.0),
    )
    pruned["width"] = raw_width
    pruned["height"] = raw_height
    pruned["page_count"] = int(pruned.get("page_count", 1) or 1)
    pruned["parsing_res_list"] = blocks
    settings = dict(pruned.get("model_settings") or {})
    settings.update({"transport": "official_cli", "geometry_precision": "block_bbox"})
    pruned["model_settings"] = settings
    markdown_text = "\n\n".join(
        str(block.get("block_content", "") or "").strip()
        for block in blocks
        if isinstance(block, dict) and str(block.get("block_content", "") or "").strip()
    )
    return (
        {
            **page,
            "prunedResult": pruned,
            "markdown": {"text": markdown_text, "images": {}},
            "pageIndex": page_index,
        },
        raw_width,
        raw_height,
    )


def _ocr_line_blocks(pruned: dict[str, Any]) -> list[dict[str, Any]]:
    texts = list(pruned.get("rec_texts") or [])
    scores = list(pruned.get("rec_scores") or [])
    boxes = list(pruned.get("rec_boxes") or [])
    polygons = list(pruned.get("rec_polys") or pruned.get("dt_polys") or [])
    blocks: list[dict[str, Any]] = []
    for index, raw_text in enumerate(texts):
        text = str(raw_text or "").strip()
        if not text:
            continue
        raw_box = boxes[index] if index < len(boxes) else None
        if not _is_bbox(raw_box) and index < len(polygons):
            raw_box = _bbox_from_polygon(polygons[index])
        bbox = _normalized_bbox(raw_box)
        score = scores[index] if index < len(scores) else None
        blocks.append(
            {
                "block_label": "text",
                "block_content": text,
                "block_bbox": bbox,
                "block_score": score,
                "_cli_ocr_line_index": index,
            }
        )
    return blocks


def _ocr_image_size(
    pruned: dict[str, Any],
    *,
    fallback_width: float,
    fallback_height: float,
) -> tuple[float, float]:
    candidates = [
        pruned.get("input_img_shape"),
        pruned.get("output_img_shape"),
        (pruned.get("doc_preprocessor_res") or {}).get("output_img_shape")
        if isinstance(pruned.get("doc_preprocessor_res"), dict)
        else None,
    ]
    for shape in candidates:
        if isinstance(shape, (list, tuple)) and len(shape) >= 2:
            try:
                height = float(shape[0])
                width = float(shape[1])
            except (TypeError, ValueError):
                continue
            if width > 0 and height > 0:
                return width, height
    maximum_x = maximum_y = 0.0
    for block in _ocr_line_blocks(pruned):
        bbox = block["block_bbox"]
        maximum_x = max(maximum_x, float(bbox[2]))
        maximum_y = max(maximum_y, float(bbox[3]))
    return max(maximum_x, fallback_width, 1.0), max(maximum_y, fallback_height, 1.0)


def _materializable_images(value: Any, resources_dir: Path) -> dict[str, str]:
    images = dict(value or {}) if isinstance(value, dict) else {}
    materialized: dict[str, str] = {}
    for raw_name, raw_value in images.items():
        name = str(raw_name or "").strip()
        if not name:
            continue
        # PaddleOCR CLI only accepts basename resource keys. Repeat that
        # constraint here before reading any subprocess-created file.
        candidate = resources_dir / name
        if Path(name).name == name and candidate.is_file():
            mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
            encoded = base64.b64encode(candidate.read_bytes()).decode("ascii")
            materialized[name] = f"data:{mime};base64,{encoded}"
        else:
            materialized[name] = str(raw_value or "")
    return materialized


def _optional_cli_args(
    *,
    args: SimpleNamespace,
    options: dict[str, Any],
    model_type: str,
) -> list[str]:
    values: dict[str, Any] = {}
    for name in (
        "use_doc_orientation_classify",
        "use_doc_unwarping",
        "use_textline_orientation",
        "use_layout_detection",
        "use_seal_recognition",
        "use_table_recognition",
        "use_formula_recognition",
        "use_chart_recognition",
        "visualize",
        "prettify_markdown",
        "text_det_limit_side_len",
        "text_det_limit_type",
        "text_rec_score_thresh",
    ):
        if name in options and options[name] is not None:
            values[name] = options[name]
    if model_type == PADDLE_CLI_MODEL_TYPE_DOC_PARSING:
        if bool(getattr(args, "disable_formula", False)):
            values.setdefault("use_formula_recognition", False)
        if bool(getattr(args, "disable_table", False)):
            values.setdefault("use_table_recognition", False)

    command: list[str] = []
    for name, value in values.items():
        if isinstance(value, bool):
            value = "True" if value else "False"
        command.extend([f"--{name}", str(value)])
    return command


def _resolve_executable() -> str:
    configured = str(os.environ.get(PADDLE_CLI_PATH_ENV, "") or "").strip()
    executable = configured or shutil.which("paddleocr") or ""
    if not executable:
        raise RuntimeError(
            "PaddleOCR CLI transport requires the optional `paddleocr` executable; "
            f"install it separately or set {PADDLE_CLI_PATH_ENV}"
        )
    if os.path.sep in executable and not Path(executable).expanduser().is_file():
        raise RuntimeError(f"configured PaddleOCR CLI executable does not exist: {executable}")
    return str(Path(executable).expanduser()) if os.path.sep in executable else executable


def _options(args: SimpleNamespace) -> dict[str, Any]:
    value = getattr(args, "ocr_provider_options", None)
    return dict(value) if isinstance(value, dict) else {}


def _model_type(options: dict[str, Any]) -> str:
    value = str(options.get("cli_model_type", PADDLE_CLI_MODEL_TYPE_DOC_PARSING) or "").strip().lower()
    if value not in PADDLE_CLI_MODEL_TYPES:
        expected = ", ".join(sorted(PADDLE_CLI_MODEL_TYPES))
        raise RuntimeError(f"unsupported PaddleOCR CLI model type: {value}; expected {expected}")
    return value


def _validate_model_for_task(*, model_name: str, model_type: str) -> None:
    is_ocr_model = model_name in PADDLE_CLI_OCR_MODELS
    if model_type == PADDLE_CLI_MODEL_TYPE_OCR and not is_ocr_model:
        raise RuntimeError(
            f"PaddleOCR CLI model_type=ocr requires one of {sorted(PADDLE_CLI_OCR_MODELS)}, "
            f"got {model_name}"
        )
    if model_type == PADDLE_CLI_MODEL_TYPE_DOC_PARSING and is_ocr_model:
        raise RuntimeError(
            f"PaddleOCR CLI model_type=doc_parsing does not support OCR-only model {model_name}"
        )


def _outer_timeout(
    *,
    options: dict[str, Any],
    request_timeout: float,
    poll_timeout: float,
) -> float:
    configured = options.get("cli_timeout")
    if configured is None:
        configured = os.environ.get(PADDLE_CLI_TIMEOUT_ENV)
    value = _positive_float(configured, request_timeout + poll_timeout + 30.0)
    return min(value, PADDLE_CLI_MAX_TIMEOUT_SECONDS)


def _positive_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _number_arg(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def _timeout_text(value: str | bytes | None) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value or "")


def _page_size(sizes: list[tuple[float, float]], index: int) -> tuple[float, float]:
    if index < len(sizes):
        return sizes[index]
    return 1.0, 1.0


def _is_bbox(value: Any) -> bool:
    return isinstance(value, (list, tuple)) and len(value) == 4 and all(
        isinstance(item, (int, float)) for item in value
    )


def _normalized_bbox(value: Any) -> list[float]:
    if not _is_bbox(value):
        return [0.0, 0.0, 0.0, 0.0]
    x0, y0, x1, y1 = (float(item) for item in value)
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]


def _bbox_from_polygon(value: Any) -> list[float]:
    if not isinstance(value, (list, tuple)):
        return [0.0, 0.0, 0.0, 0.0]
    points = [
        point
        for point in value
        if isinstance(point, (list, tuple)) and len(point) >= 2
    ]
    if not points:
        return [0.0, 0.0, 0.0, 0.0]
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    return [min(xs), min(ys), max(xs), max(ys)]


__all__ = [
    "PADDLE_CLI_MODEL_TYPE_DOC_PARSING",
    "PADDLE_CLI_MODEL_TYPE_OCR",
    "PADDLE_CLI_PATH_ENV",
    "PADDLE_CLI_TIMEOUT_ENV",
    "PaddleCliArtifacts",
    "paddle_cli_payload_for_document_schema",
    "run_paddle_cli",
]
