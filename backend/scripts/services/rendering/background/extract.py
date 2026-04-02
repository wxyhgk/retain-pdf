from __future__ import annotations

from io import BytesIO

import fitz
from PIL import Image


def extract_image_rgb(doc: fitz.Document, xref: int) -> Image.Image | None:
    try:
        payload = doc.extract_image(xref)
    except Exception:
        payload = None
    if payload and payload.get("image"):
        try:
            image = Image.open(BytesIO(payload["image"]))
            return image.convert("RGB")
        except Exception:
            pass
    try:
        pix = fitz.Pixmap(doc, xref)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return image
    except Exception:
        return None


def extract_image_payload(doc: fitz.Document, xref: int) -> dict | None:
    try:
        payload = doc.extract_image(xref)
    except Exception:
        payload = None
    return payload if payload and payload.get("image") else None


def _pdf_bool(value: str) -> bool:
    return str(value or "").strip().lower() == "true"


def _pdf_name(value: str) -> str:
    return str(value or "").strip()


def _pdf_int(value: str, default: int = 0) -> int:
    try:
        return int(str(value or "").strip())
    except Exception:
        return default


def raw_stream_image_meta(doc: fitz.Document, xref: int) -> dict | None:
    filter_type, filter_value = doc.xref_get_key(xref, "Filter")
    width_type, width_value = doc.xref_get_key(xref, "Width")
    height_type, height_value = doc.xref_get_key(xref, "Height")
    bpc_type, bpc_value = doc.xref_get_key(xref, "BitsPerComponent")
    image_mask_type, image_mask_value = doc.xref_get_key(xref, "ImageMask")
    colorspace_type, colorspace_value = doc.xref_get_key(xref, "ColorSpace")

    if filter_type != "name" or _pdf_name(filter_value) != "/FlateDecode":
        return None

    width = _pdf_int(width_value)
    height = _pdf_int(height_value)
    bits_per_component = _pdf_int(bpc_value)
    image_mask = image_mask_type == "bool" and _pdf_bool(image_mask_value)
    color_space = _pdf_name(colorspace_value) if colorspace_type == "name" else ""

    if width <= 0 or height <= 0:
        return None
    if image_mask and bits_per_component == 1:
        return {
            "mode": "1",
            "width": width,
            "height": height,
            "fill": 1,
        }
    if bits_per_component == 8 and color_space == "/DeviceGray":
        return {
            "mode": "L",
            "width": width,
            "height": height,
            "fill": 255,
        }
    if bits_per_component == 8 and color_space == "/DeviceRGB":
        return {
            "mode": "RGB",
            "width": width,
            "height": height,
            "fill": (255, 255, 255),
        }
    return None


def extract_raw_stream_image(doc: fitz.Document, xref: int, meta: dict) -> Image.Image | None:
    try:
        raw = doc.xref_stream(xref)
        return Image.frombytes(meta["mode"], (meta["width"], meta["height"]), raw)
    except Exception:
        return None


__all__ = [
    "extract_image_payload",
    "extract_image_rgb",
    "extract_raw_stream_image",
    "raw_stream_image_meta",
]
