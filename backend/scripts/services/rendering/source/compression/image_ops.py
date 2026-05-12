from __future__ import annotations

import io
import zlib

import pikepdf
from PIL import Image
from PIL import ImageFile
from pikepdf import Name
from pikepdf import PdfImage


IMAGE_RECOMPRESS_MIN_BYTES = 20_000
IMAGE_JPEG_QUALITY = 78
IMAGE_JPEG_QUALITY_CMYK = 56

ImageFile.LOAD_TRUNCATED_IMAGES = True


def resize_to_target(img: Image.Image, *, target_width: int, target_height: int) -> Image.Image:
    current_width, current_height = img.size
    if current_width <= target_width and current_height <= target_height:
        return img
    scale = min(target_width / max(1, current_width), target_height / max(1, current_height))
    new_size = (
        max(1, round(current_width * scale)),
        max(1, round(current_height * scale)),
    )
    return img.resize(new_size, Image.LANCZOS)


def encode_image(img: Image.Image) -> tuple[bytes, str, str]:
    has_alpha = "A" in img.getbands()
    if has_alpha:
        return b"", "skip-alpha", ""

    if img.mode == "CMYK":
        output = io.BytesIO()
        img.save(
            output,
            format="JPEG",
            quality=IMAGE_JPEG_QUALITY_CMYK,
            optimize=True,
            progressive=False,
        )
        return output.getvalue(), "jpeg", "/DeviceCMYK"

    if img.mode == "L":
        output = io.BytesIO()
        img.save(
            output,
            format="JPEG",
            quality=IMAGE_JPEG_QUALITY,
            optimize=True,
            progressive=False,
        )
        return output.getvalue(), "jpeg", "/DeviceGray"

    rgb = img.convert("RGB")
    output = io.BytesIO()
    rgb.save(
        output,
        format="JPEG",
        quality=IMAGE_JPEG_QUALITY,
        optimize=True,
        progressive=False,
    )
    jpeg_bytes = output.getvalue()
    return jpeg_bytes, "jpeg", "/DeviceRGB"


def encode_soft_mask(img: Image.Image) -> bytes:
    grayscale = img.convert("L")
    return zlib.compress(grayscale.tobytes(), level=9)


def pdf_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).lower() == "true"


def _first_non_none(*values: object) -> object | None:
    for value in values:
        if value is not None:
            return value
    return None


def _pdf_string(value: object | None) -> str:
    if value is None:
        return ""
    return str(value)


def should_skip_recompress_image(obj: pikepdf.Object, info: dict) -> tuple[bool, str]:
    bits_per_component = int(info.get("bpc") or 0)
    obj_colorspace = obj.get(Name("/ColorSpace"))
    colorspace_value = _first_non_none(
        obj_colorspace,
        info.get("cs-name"),
        info.get("colorspace"),
        "",
    )
    colorspace = _pdf_string(colorspace_value)
    filters = obj.get(Name("/Filter"))
    filter_names: set[str] = set()
    if isinstance(filters, list):
        filter_names = {str(value) for value in filters}
    elif filters is not None:
        filter_names = {str(filters)}
    decode = obj.get(Name("/Decode"))
    if pdf_bool(obj.get(Name("/ImageMask"))):
        return True, "image-mask"
    if obj.get(Name("/Mask")) is not None:
        return True, "mask"
    if bits_per_component == 1:
        return True, "bitonal"
    if not colorspace:
        return True, "missing-colorspace"
    if colorspace.startswith("/") and colorspace not in {"/DeviceRGB", "/DeviceCMYK", "/DeviceGray"}:
        return True, "non-device-colorspace"
    if "Separation" in colorspace or "DeviceN" in colorspace:
        return True, "complex-colorspace"
    if "/JPXDecode" in filter_names:
        return True, "jpxdecode"
    if decode is not None:
        return True, "decode-array"
    return False, ""


def load_pdf_image(obj: pikepdf.Object) -> Image.Image:
    return PdfImage(obj).as_pil_image()
