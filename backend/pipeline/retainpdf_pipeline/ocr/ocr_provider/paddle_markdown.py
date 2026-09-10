from __future__ import annotations

import base64
import re
from pathlib import Path

from retainpdf_pipeline.ocr.retry import RetainNetworkError
from retainpdf_pipeline.ocr.retry import direct_session
from retainpdf_pipeline.ocr.retry import request_with_retry

_MARKDOWN_IMAGE_SESSION = direct_session(pool_connections=4, pool_maxsize=4)
_PAGE_PREFIX_RE = re.compile(r"^page-\d+(/|$)")
_IMG_SRC_RE = re.compile(r"""(<img\b[^>]*\bsrc=["'])([^"']+)(["'])""", re.IGNORECASE)
_MARKDOWN_IMG_SRC_RE = re.compile(
    r"""(!\[[^\]\n]*\]\(\s*<?)([^\s)>]+)(>?\s*(?:["'][^"']*["']\s*)?\))"""
)
_IMG_TAG_RE = re.compile(r"""<img\b([^>]*)>""", re.IGNORECASE)
_CENTERED_IMG_DIV_RE = re.compile(
    r"""<div\s+style=["']text-align:\s*center;?["']\s*>\s*(<img\b[^>]*>)\s*</div>""",
    re.IGNORECASE,
)
_HTML_ATTR_RE = re.compile(r"""([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*["']([^"']*)["']""")


def job_markdown_dir(job_root: Path) -> Path:
    return job_root / "md"


def job_markdown_images_dir(job_root: Path) -> Path:
    return job_markdown_dir(job_root) / "images"


def paddle_markdown_target_rel_path(rel_path: str, *, page_index: int) -> Path:
    normalized = str(rel_path or "").strip().lstrip("/").replace("\\", "/")
    if not normalized:
        return Path()
    if _PAGE_PREFIX_RE.match(normalized):
        return Path(normalized)
    return Path(f"page-{page_index}") / normalized


def paddle_markdown_rel_src_path(src: str, *, page_index: int) -> str:
    normalized = str(src or "").strip().replace("\\", "/")
    if not normalized or normalized.startswith(("http://", "https://", "data:")):
        return normalized
    normalized = normalized.lstrip("/")
    if normalized.startswith("images/"):
        return normalized
    return (Path("images") / paddle_markdown_target_rel_path(normalized, page_index=page_index)).as_posix()


def rewrite_paddle_markdown_image_srcs(text: str, *, page_index: int) -> str:
    rewritten = _IMG_SRC_RE.sub(
        lambda match: f"{match.group(1)}{paddle_markdown_rel_src_path(match.group(2), page_index=page_index)}{match.group(3)}",
        text,
    )
    return _MARKDOWN_IMG_SRC_RE.sub(
        lambda match: f"{match.group(1)}{paddle_markdown_rel_src_path(match.group(2), page_index=page_index)}{match.group(3)}",
        rewritten,
    )


def normalize_paddle_markdown_images(text: str, *, page_index: int) -> str:
    rewritten = rewrite_paddle_markdown_image_srcs(text, page_index=page_index)
    rewritten = _CENTERED_IMG_DIV_RE.sub(lambda match: _markdown_image_from_img_tag(match.group(1)), rewritten)
    return _IMG_TAG_RE.sub(lambda match: _markdown_image_from_attrs(match.group(1)), rewritten)


def _markdown_image_from_img_tag(img_tag: str) -> str:
    match = _IMG_TAG_RE.search(img_tag)
    if not match:
        return img_tag
    return _markdown_image_from_attrs(match.group(1))


def _markdown_image_from_attrs(attrs_text: str) -> str:
    attrs = {key.lower(): value for key, value in _HTML_ATTR_RE.findall(attrs_text)}
    src = attrs.get("src", "").strip()
    if not src:
        return f"<img{attrs_text}>"
    alt = attrs.get("alt", "Image").strip() or "Image"
    alt = alt.replace("[", "\\[").replace("]", "\\]")
    return f"![{alt}]({src})"


def decode_paddle_markdown_image(payload: str) -> bytes:
    value = str(payload or "").strip()
    if not value:
        raise RuntimeError("empty markdown image payload")
    if value.startswith(("http://", "https://")):
        try:
            response = request_with_retry(
                _MARKDOWN_IMAGE_SESSION,
                "get",
                value,
                timeout=300,
                attempts=3,
                backoff_seconds=0.5,
                label="Paddle markdown image",
            )
        except RetainNetworkError as err:
            raise RuntimeError(f"download Paddle markdown image failed: {value}: {err}") from err
        return response.content
    if value.startswith("data:") and "," in value:
        _, encoded = value.split(",", 1)
        return base64.b64decode(encoded)
    return base64.b64decode(value)


def materialize_paddle_markdown_artifacts(*, payload: dict, job_root: Path) -> Path | None:
    layout_results = payload.get("layoutParsingResults") or []
    if not isinstance(layout_results, list) or not layout_results:
        return None

    markdown_dir = job_markdown_dir(job_root)
    images_root = job_markdown_images_dir(job_root)
    page_texts: list[str] = []
    wrote_anything = False

    for page_index, page_payload in enumerate(layout_results, start=1):
        if not isinstance(page_payload, dict):
            continue
        markdown = page_payload.get("markdown") or {}
        if not isinstance(markdown, dict):
            continue
        text = str(markdown.get("text") or "")
        images = markdown.get("images") or {}
        if not text.strip() and not images:
            continue

        remapped_text = text
        if isinstance(images, dict) and images:
            for raw_rel_path, raw_image_payload in images.items():
                rel_path = str(raw_rel_path or "").strip().lstrip("/")
                if not rel_path:
                    continue
                target_rel_path = _target_rel_path_for_image_key(rel_path, remapped_text, page_index=page_index)
                if not target_rel_path.as_posix():
                    continue
                markdown_rel_path = Path("images") / target_rel_path
                target_path = images_root / target_rel_path
                target_path.parent.mkdir(parents=True, exist_ok=True)
                target_path.write_bytes(decode_paddle_markdown_image(str(raw_image_payload or "")))
                normalized_source = rel_path.replace("\\", "/")
                normalized_target = markdown_rel_path.as_posix()
                if not _is_page_prefixed_alias(target_rel_path.as_posix(), normalized_source):
                    remapped_text = remapped_text.replace(normalized_source, normalized_target)
                wrote_anything = True
        remapped_text = normalize_paddle_markdown_images(remapped_text, page_index=page_index)

        if remapped_text.strip():
            page_texts.append(remapped_text.strip())
            wrote_anything = True

    if not wrote_anything:
        return None

    markdown_dir.mkdir(parents=True, exist_ok=True)
    full_md_path = markdown_dir / "full.md"
    full_md_path.write_text("\n\n".join(page_texts).strip() + "\n", encoding="utf-8")
    return full_md_path


def _target_rel_path_for_image_key(rel_path: str, markdown_text: str, *, page_index: int) -> Path:
    normalized = str(rel_path or "").strip().lstrip("/").replace("\\", "/")
    if not normalized:
        return Path()
    if _PAGE_PREFIX_RE.match(normalized):
        return Path(normalized)
    for match in _IMG_SRC_RE.finditer(markdown_text):
        src = match.group(2).strip().lstrip("/").replace("\\", "/")
        if _PAGE_PREFIX_RE.match(src) and src.endswith(normalized):
            return Path(src)
    for match in _MARKDOWN_IMG_SRC_RE.finditer(markdown_text):
        src = match.group(2).strip().lstrip("/").replace("\\", "/")
        if _PAGE_PREFIX_RE.match(src) and src.endswith(normalized):
            return Path(src)
    return paddle_markdown_target_rel_path(normalized, page_index=page_index)


def _is_page_prefixed_alias(target_rel_path: str, source_rel_path: str) -> bool:
    target = str(target_rel_path or "").replace("\\", "/").lstrip("/")
    source = str(source_rel_path or "").replace("\\", "/").lstrip("/")
    return target != source and _PAGE_PREFIX_RE.match(target) and target.endswith(source)
