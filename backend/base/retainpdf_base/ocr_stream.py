"""OCR 流式公布：OCR 每做完一段，把"到目前为止"的归一化文档和一份就绪清单写到任务目录，后面的环节（跨栏跨页拼接、翻译）不用等整个 OCR 阶段。

2026-10-31 用户："我觉得用 3 是最好的，这样速度能达到极限"——OCR 和翻译并行。写的一方是 OCR provider（现在只有 GLM-OCR，
`retainpdf_pipeline` 的 `glm_ocr_driver`），读的一方是翻译包的流式模式（`retainpdf_translation.workflow.streaming_flow`），
所以放在两边都依赖的底座包里。

- `ocr/stream/document.v1.json`：前 `ready_pages` 页的 document.v1（已缩放到原文 PDF，和最后的整份文档逐页一致）。
- `ocr/stream/manifest.json`：`schema=ocr_stream_v1`、`seq`（每公布一次加 1）、`ready_pages`、`total_pages`、`done`、`failed`、`error`。
  两个文件都原子写（先写临时文件再改名），读的一方任何时候读到的都是完整的一版。先写文档、后写清单：清单说有几页，文档里一定至少有这么多页。
- 结束时 `done=true`，文档就是整份；失败时 `failed=true`、`error` 写原因，读的一方别再等。
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from retainpdf_base.io import load_json
from retainpdf_base.io import save_json_atomic

OCR_STREAM_SCHEMA = "ocr_stream_v1"
STREAM_DIR_NAME = "stream"
MANIFEST_FILE_NAME = "manifest.json"
DOCUMENT_FILE_NAME = "document.v1.json"


def stream_dir(ocr_dir: Path) -> Path:
    return Path(ocr_dir) / STREAM_DIR_NAME


def manifest_path(ocr_dir: Path) -> Path:
    return stream_dir(ocr_dir) / MANIFEST_FILE_NAME


def document_path(ocr_dir: Path) -> Path:
    return stream_dir(ocr_dir) / DOCUMENT_FILE_NAME


@dataclass(frozen=True)
class OcrStreamState:
    seq: int
    ready_pages: int
    total_pages: int
    done: bool
    failed: bool
    error: str
    document_path: Path


class OcrStreamWriter:
    def __init__(self, ocr_dir: Path, *, provider: str, total_pages: int) -> None:
        self._ocr_dir = Path(ocr_dir)
        self._provider = provider
        self._total_pages = int(total_pages)
        self._seq = 0
        stream_dir(self._ocr_dir).mkdir(parents=True, exist_ok=True)

    def publish(self, document: dict, *, done: bool = False) -> None:
        ready_pages = len(document.get("pages") or [])
        save_json_atomic(document_path(self._ocr_dir), document)
        self._write_manifest(ready_pages=ready_pages, done=done)

    def fail(self, error: str) -> None:
        self._write_manifest(ready_pages=self._last_ready_pages(), done=False, failed=True, error=error)

    def _last_ready_pages(self) -> int:
        state = read_ocr_stream(self._ocr_dir)
        return state.ready_pages if state is not None else 0

    def _write_manifest(self, *, ready_pages: int, done: bool, failed: bool = False, error: str = "") -> None:
        self._seq += 1
        save_json_atomic(
            manifest_path(self._ocr_dir),
            {
                "schema": OCR_STREAM_SCHEMA,
                "seq": self._seq,
                "provider": self._provider,
                "ready_pages": ready_pages,
                "total_pages": self._total_pages,
                "done": bool(done),
                "failed": bool(failed),
                "error": str(error or "")[:500],
                "document": f"{STREAM_DIR_NAME}/{DOCUMENT_FILE_NAME}",
                "updated_at": time.time(),
            },
        )


class OcrStreamFailed(RuntimeError):
    """OCR 那边失败了（清单 `failed=true`）：等的一方别再等。"""


def wait_for_ocr_stream(
    ocr_dir: Path,
    *,
    after_seq: int = 0,
    poll_seconds: float = 0.5,
    sleep: Callable[[float], None] = time.sleep,
) -> OcrStreamState:
    """等到比 `after_seq` 新的一版清单。OCR 失败就抛 `OcrStreamFailed`。

    不自己设超时：OCR 卡住时 OCR 进程有自己的"多久没有进展"超时，它失败或被收掉以后，翻译这边由任务调度一起停掉。"""
    while True:
        state = read_ocr_stream(ocr_dir)
        if state is not None and state.failed:
            raise OcrStreamFailed(f"OCR stream failed after {state.ready_pages}/{state.total_pages} pages: {state.error}")
        if state is not None and state.seq > after_seq and state.ready_pages > 0:
            return state
        sleep(poll_seconds)


def read_ocr_stream(ocr_dir: Path) -> OcrStreamState | None:
    """读就绪清单；没有、读不了、不是这个版本都返回 None（当作还没开始公布）。"""
    try:
        manifest = load_json(manifest_path(ocr_dir))
    except (OSError, ValueError):
        return None
    if not isinstance(manifest, dict) or manifest.get("schema") != OCR_STREAM_SCHEMA:
        return None
    return OcrStreamState(
        seq=int(manifest.get("seq") or 0),
        ready_pages=int(manifest.get("ready_pages") or 0),
        total_pages=int(manifest.get("total_pages") or 0),
        done=bool(manifest.get("done")),
        failed=bool(manifest.get("failed")),
        error=str(manifest.get("error") or ""),
        document_path=Path(ocr_dir) / str(manifest.get("document") or f"{STREAM_DIR_NAME}/{DOCUMENT_FILE_NAME}"),
    )


__all__ = [
    "OCR_STREAM_SCHEMA",
    "OcrStreamFailed",
    "OcrStreamState",
    "OcrStreamWriter",
    "document_path",
    "manifest_path",
    "read_ocr_stream",
    "wait_for_ocr_stream",
]
