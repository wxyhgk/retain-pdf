from __future__ import annotations

import io
import shutil
import subprocess
from pathlib import Path

import fitz
import pikepdf
from PIL import Image
from PIL import ImageFile
from pikepdf import Name
from pikepdf import Pdf
from pikepdf import PdfImage


VECTOR_SKIP_PAGE_DRAWINGS_THRESHOLD = 100
VECTOR_SKIP_TOTAL_DRAWINGS_THRESHOLD = 300
IMAGE_RECOMPRESS_MIN_BYTES = 20_000
IMAGE_JPEG_QUALITY = 78

ImageFile.LOAD_TRUNCATED_IMAGES = True


def _page_drawing_count(page: fitz.Page) -> int:
    if hasattr(page, "get_cdrawings"):
        try:
            return len(page.get_cdrawings())
        except Exception:
            pass
    return len(page.get_drawings())


def source_pdf_has_vector_graphics(
    source_pdf_path: Path,
    *,
    start_page: int = 0,
    end_page: int = -1,
) -> bool:
    if not source_pdf_path.exists():
        return False

    doc = fitz.open(source_pdf_path)
    try:
        if len(doc) == 0:
            return False
        start = max(0, start_page)
        stop = len(doc) - 1 if end_page < 0 else min(end_page, len(doc) - 1)
        if start > stop:
            return False

        total_drawings = 0
        for page_idx in range(start, stop + 1):
            drawings = _page_drawing_count(doc[page_idx])
            total_drawings += drawings
            if drawings >= VECTOR_SKIP_PAGE_DRAWINGS_THRESHOLD:
                return True
            if total_drawings >= VECTOR_SKIP_TOTAL_DRAWINGS_THRESHOLD:
                return True
        return False
    finally:
        doc.close()


def _max_display_rect_by_xref(doc: fitz.Document) -> dict[int, tuple[float, float]]:
    max_rects: dict[int, tuple[float, float]] = {}
    for page in doc:
        for image in page.get_images(full=True):
            xref = image[0]
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                rects = []
            for rect in rects:
                width = max(0.0, float(rect.width))
                height = max(0.0, float(rect.height))
                if width <= 0.0 or height <= 0.0:
                    continue
                prev_width, prev_height = max_rects.get(xref, (0.0, 0.0))
                max_rects[xref] = (max(prev_width, width), max(prev_height, height))
    return max_rects


def _target_pixel_size(display_size_pt: tuple[float, float], dpi: int) -> tuple[int, int]:
    width_pt, height_pt = display_size_pt
    width_px = max(1, round(width_pt / 72.0 * dpi))
    height_px = max(1, round(height_pt / 72.0 * dpi))
    return width_px, height_px


def _resize_to_target(img: Image.Image, *, target_width: int, target_height: int) -> Image.Image:
    current_width, current_height = img.size
    if current_width <= target_width and current_height <= target_height:
        return img
    scale = min(target_width / max(1, current_width), target_height / max(1, current_height))
    new_size = (
        max(1, round(current_width * scale)),
        max(1, round(current_height * scale)),
    )
    return img.resize(new_size, Image.LANCZOS)


def _encode_image(img: Image.Image) -> tuple[bytes, str]:
    has_alpha = "A" in img.getbands()
    if has_alpha:
        return b"", "skip-alpha"

    rgb = img.convert("RGB")
    output = io.BytesIO()
    rgb.save(
        output,
        format="JPEG",
        quality=IMAGE_JPEG_QUALITY,
        optimize=True,
        progressive=True,
    )
    jpeg_bytes = output.getvalue()
    return jpeg_bytes, "jpeg"


def _pdf_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).lower() == "true"


def _should_skip_recompress_image(obj: pikepdf.Object, info: dict) -> tuple[bool, str]:
    bits_per_component = int(info.get("bpc") or 0)
    colorspace = info.get("colorspace")
    filters = obj.get(Name("/Filter"))
    filter_names: set[str] = set()
    if isinstance(filters, list):
        filter_names = {str(value) for value in filters}
    elif filters is not None:
        filter_names = {str(filters)}
    if _pdf_bool(obj.get(Name("/ImageMask"))):
        return True, "image-mask"
    if bits_per_component == 1:
        return True, "bitonal"
    if not colorspace:
        return True, "missing-colorspace"
    if "/JPXDecode" in filter_names:
        return True, "jpxdecode"
    return False, ""


def _compress_pdf_images_only_impl(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    if dpi <= 0 or not pdf_path.exists():
        return False

    doc = fitz.open(pdf_path)
    pdf = Pdf.open(pdf_path)
    changed = 0
    skipped_small = 0
    skipped_not_better = 0
    skipped_alpha = 0
    skipped_missing = 0
    skipped_special = 0
    skipped_broken = 0
    original_size = pdf_path.stat().st_size
    temp_path = pdf_path.with_name(f"{pdf_path.stem}.tmp-images-only.pdf")
    try:
        display_rects = _max_display_rect_by_xref(doc)
        if not display_rects:
            return False
        xrefs = sorted(display_rects)
        for xref in xrefs:
            info = doc.extract_image(xref)
            raw = info.get("image", b"")
            if not raw or len(raw) < IMAGE_RECOMPRESS_MIN_BYTES:
                skipped_small += 1
                continue

            target_width, target_height = _target_pixel_size(display_rects[xref], dpi)
            if target_width <= 0 or target_height <= 0:
                continue

            try:
                obj = pdf.objects[xref - 1]
            except Exception:
                skipped_missing += 1
                continue
            should_skip, skip_reason = _should_skip_recompress_image(obj, info)
            if should_skip:
                skipped_special += 1
                print(
                    f"image-only compress: skip xref={xref} reason={skip_reason}",
                    flush=True,
                )
                continue
            try:
                image = PdfImage(obj).as_pil_image()
            except Exception:
                skipped_missing += 1
                continue
            try:
                resized = _resize_to_target(image, target_width=target_width, target_height=target_height)
                encoded, encoded_ext = _encode_image(resized)
            except OSError as exc:
                skipped_broken += 1
                print(
                    f"image-only compress: skip xref={xref} reason=broken-image-data error={type(exc).__name__}: {exc}",
                    flush=True,
                )
                continue
            if not encoded:
                skipped_alpha += 1
                continue
            if len(encoded) >= len(raw):
                skipped_not_better += 1
                continue

            obj.write(encoded, filter=Name("/DCTDecode"), decode_parms=None)
            obj[Name("/Width")] = resized.width
            obj[Name("/Height")] = resized.height
            obj[Name("/BitsPerComponent")] = 8
            obj[Name("/ColorSpace")] = Name("/DeviceRGB")
            for key in ("/SMask", "/Mask", "/DecodeParms"):
                if Name(key) in obj:
                    del obj[Name(key)]
            changed += 1
            print(
                f"image-only compress: xref={xref} ->{encoded_ext} "
                f"{len(raw)}->{len(encoded)} bytes size={image.size}->{resized.size}",
                flush=True,
            )

        if not changed:
            print(
                f"image-only compress: changed=0 skipped_small={skipped_small} "
                f"skipped_not_better={skipped_not_better} skipped_alpha={skipped_alpha} "
                f"skipped_missing={skipped_missing} skipped_special={skipped_special} "
                f"skipped_broken={skipped_broken}",
                flush=True,
            )
            return False

        pdf.save(
            temp_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=True,
        )
    finally:
        pdf.close()
        doc.close()

    try:
        new_size = temp_path.stat().st_size
        if new_size >= original_size:
            print(
                f"image-only compress: rollback size {original_size}->{new_size} "
                f"(no net savings, changed={changed}, skipped_small={skipped_small}, "
                f"skipped_not_better={skipped_not_better}, skipped_alpha={skipped_alpha}, "
                f"skipped_missing={skipped_missing}, skipped_special={skipped_special}, "
                f"skipped_broken={skipped_broken})",
                flush=True,
            )
            return False
        temp_path.replace(pdf_path)
        print(
            f"image-only compress: changed={changed} skipped_small={skipped_small} "
            f"skipped_not_better={skipped_not_better} skipped_alpha={skipped_alpha} "
            f"skipped_missing={skipped_missing} skipped_special={skipped_special} "
            f"skipped_broken={skipped_broken} "
            f"size {original_size}->{new_size} "
            f"saved={original_size - new_size}",
            flush=True,
        )
        return True
    finally:
        if "temp_path" in locals() and temp_path.exists():
            temp_path.unlink(missing_ok=True)


def build_image_compressed_pdf_copy(
    source_pdf_path: Path,
    output_pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    if dpi <= 0 or not source_pdf_path.exists():
        return False
    if source_pdf_path.resolve() == output_pdf_path.resolve():
        return _compress_pdf_images_only_impl(output_pdf_path, dpi=dpi)

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_pdf_path, output_pdf_path)
    changed = _compress_pdf_images_only_impl(output_pdf_path, dpi=dpi)
    if not changed:
        output_pdf_path.unlink(missing_ok=True)
        return False
    return True


def compress_pdf_images_only(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    return _compress_pdf_images_only_impl(pdf_path, dpi=dpi)


def compress_pdf_with_ghostscript(
    pdf_path: Path,
    *,
    dpi: int = 200,
    source_pdf_path: Path | None = None,
    render_mode: str | None = None,
    start_page: int = 0,
    end_page: int = -1,
) -> bool:
    if dpi <= 0:
        return False
    gs_bin = shutil.which("gs")
    if not gs_bin:
        return False
    if not pdf_path.exists():
        return False
    if render_mode == "overlay" and source_pdf_path and source_pdf_has_vector_graphics(
        source_pdf_path,
        start_page=start_page,
        end_page=end_page,
    ):
        print(
            "skip Ghostscript: vector-heavy source PDF detected for overlay mode",
            flush=True,
        )
        return False

    temp_path = pdf_path.with_name(f"{pdf_path.stem}.tmp-compressed.pdf")
    command = [
        gs_bin,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.6",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dDownsampleColorImages=true",
        f"-dColorImageResolution={dpi}",
        "-dDownsampleGrayImages=true",
        f"-dGrayImageResolution={dpi}",
        "-dDownsampleMonoImages=false",
        f"-sOutputFile={temp_path}",
        str(pdf_path),
    ]
    try:
        proc = subprocess.run(command, capture_output=True, text=True)
        if proc.returncode != 0 or not temp_path.exists():
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            return False
        temp_path.replace(pdf_path)
        return True
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
