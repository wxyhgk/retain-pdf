from __future__ import annotations

from pathlib import Path

import fitz
import pikepdf
from pikepdf import Name
from pikepdf import Pdf

from services.rendering.compress.analysis import max_display_rect_by_xref
from services.rendering.compress.analysis import target_pixel_size
from services.rendering.compress.image_ops import encode_image
from services.rendering.compress.image_ops import IMAGE_RECOMPRESS_MIN_BYTES
from services.rendering.compress.image_ops import load_pdf_image
from services.rendering.compress.image_ops import resize_to_target
from services.rendering.compress.image_ops import should_skip_recompress_image
from services.rendering.compress.save_ops import replace_if_smaller


def compress_pdf_images_only_impl(
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
        display_rects = max_display_rect_by_xref(doc)
        if not display_rects:
            return False
        for xref in sorted(display_rects):
            info = doc.extract_image(xref)
            raw = info.get("image", b"")
            if not raw or len(raw) < IMAGE_RECOMPRESS_MIN_BYTES:
                skipped_small += 1
                continue

            target_width, target_height = target_pixel_size(display_rects[xref], dpi)
            if target_width <= 0 or target_height <= 0:
                continue

            try:
                obj = pdf.objects[xref - 1]
            except Exception:
                skipped_missing += 1
                continue
            try:
                original_stream = bytes(obj.read_raw_bytes())
            except Exception:
                original_stream = b""
            original_encoded_len = len(original_stream) if original_stream else len(raw)

            should_skip, skip_reason = should_skip_recompress_image(obj, info)
            if should_skip:
                skipped_special += 1
                print(f"image-only compress: skip xref={xref} reason={skip_reason}", flush=True)
                continue

            try:
                image = load_pdf_image(obj)
            except Exception:
                skipped_missing += 1
                continue

            try:
                resized = resize_to_target(image, target_width=target_width, target_height=target_height)
                encoded, encoded_ext, encoded_colorspace = encode_image(resized)
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
            if len(encoded) >= original_encoded_len:
                skipped_not_better += 1
                continue

            obj.write(encoded, filter=Name("/DCTDecode"), decode_parms=None)
            obj[Name("/Width")] = resized.width
            obj[Name("/Height")] = resized.height
            obj[Name("/BitsPerComponent")] = 8
            obj[Name("/ColorSpace")] = Name(encoded_colorspace or "/DeviceRGB")
            for key in ("/SMask", "/Mask", "/DecodeParms"):
                if Name(key) in obj:
                    del obj[Name(key)]
            changed += 1
            print(
                f"image-only compress: xref={xref} ->{encoded_ext} "
                f"{original_encoded_len}->{len(encoded)} bytes size={image.size}->{resized.size}",
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
            object_stream_mode=pikepdf.ObjectStreamMode.preserve,
            compress_streams=True,
            recompress_flate=True,
        )
    finally:
        pdf.close()
        doc.close()

    try:
        return replace_if_smaller(
            temp_path,
            pdf_path,
            original_size=original_size,
            changed=changed,
            skipped_small=skipped_small,
            skipped_not_better=skipped_not_better,
            skipped_alpha=skipped_alpha,
            skipped_missing=skipped_missing,
            skipped_special=skipped_special,
            skipped_broken=skipped_broken,
        )
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
