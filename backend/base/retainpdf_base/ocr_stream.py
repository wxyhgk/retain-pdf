"""OCR 流式公布：OCR 每做完一段，把"到目前为止"的归一化文档和一份就绪清单写到任务目录，后面的环节（跨栏跨页拼接、翻译）不用等整个 OCR 阶段。

2026-10-31 用户："我觉得用 3 是最好的，这样速度能达到极限"——OCR 和翻译并行。写的一方是 OCR provider（GLM-OCR 的
`glm_ocr_driver`、Paddle 的 `paddle_chunked`，都在 `retainpdf_pipeline`），读的一方是翻译包的流式模式（`retainpdf_translation.workflow.streaming_flow`），
所以放在两边都依赖的底座包里。

- `ocr/stream/document.v1.json`：document.v1（已缩放到原文 PDF，就绪的页和最后的整份文档逐页一致）。页按原位置放：
  第 n 页就是 `pages[n]`；还没做完的页是占位的空页（没有块），读的一方只读就绪的页。
- `ocr/stream/manifest.json`：`schema=ocr_stream_v1`、`seq`（每公布一次加 1）、`ready_page_indices`（就绪的页，从 0 数、升序）、
  `ready_pages`（就绪的页数）、`total_pages`、`done`、`failed`、`error`。
  两个文件都原子写（先写临时文件再改名），读的一方任何时候读到的都是完整的一版。先写文档、后写清单：清单说就绪的页，文档里一定有。
- 就绪的页不一定连着（2026-11-01 起）：Paddle 按片并行提交，后面的片常比第一片先做完（实测第 21–34 页 7 秒做完，
  第 1–10 页排队到 46 秒），做完哪片就公布哪片，翻译先翻已经到的页。GLM-OCR 串行，就绪的总是前几页。
  没有 `ready_page_indices` 的清单（这之前写的）就绪的是前 `ready_pages` 页。
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
    # 就绪的页（从 0 数）；不一定连着，见模块说明
    ready_page_indices: frozenset[int] = frozenset()


class OcrStreamWriter:
    def __init__(self, ocr_dir: Path, *, provider: str, total_pages: int) -> None:
        self._ocr_dir = Path(ocr_dir)
        self._provider = provider
        self._total_pages = int(total_pages)
        self._seq = 0
        stream_dir(self._ocr_dir).mkdir(parents=True, exist_ok=True)

    def publish(self, document: dict, *, done: bool = False, ready_page_indices=None) -> None:
        """`ready_page_indices` 不给就是文档里的全部页（前几页连着做完的写法）；给了就只有这些页就绪，其余是占位页。"""
        page_count = len(document.get("pages") or [])
        if done or ready_page_indices is None:
            ready = list(range(page_count))
        else:
            ready = sorted({int(index) for index in ready_page_indices})
            if ready and (ready[0] < 0 or ready[-1] >= page_count):
                raise ValueError(f"ready pages {ready} out of range for a {page_count}-page stream document")
        save_json_atomic(document_path(self._ocr_dir), document)
        self._write_manifest(ready=ready, done=done)

    def fail(self, error: str) -> None:
        state = read_ocr_stream(self._ocr_dir)
        ready = sorted(state.ready_page_indices) if state is not None else []
        self._write_manifest(ready=ready, done=False, failed=True, error=error)

    def _write_manifest(self, *, ready: list[int], done: bool, failed: bool = False, error: str = "") -> None:
        self._seq += 1
        save_json_atomic(
            manifest_path(self._ocr_dir),
            {
                "schema": OCR_STREAM_SCHEMA,
                "seq": self._seq,
                "provider": self._provider,
                "ready_pages": len(ready),
                "ready_page_indices": ready,
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
    ready_pages = int(manifest.get("ready_pages") or 0)
    indices = manifest.get("ready_page_indices")
    if isinstance(indices, list):
        ready = frozenset(int(index) for index in indices if isinstance(index, int) and index >= 0)
    else:
        ready = frozenset(range(ready_pages))
    return OcrStreamState(
        seq=int(manifest.get("seq") or 0),
        ready_pages=len(ready),
        ready_page_indices=ready,
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
