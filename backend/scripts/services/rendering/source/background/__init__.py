from services.rendering.source.background.detect import page_has_large_background_image
from services.rendering.source.background.detect import pick_primary_background_image
from services.rendering.source.background.extract import extract_image_payload
from services.rendering.source.background.extract import extract_image_rgb
from services.rendering.source.background.extract import extract_raw_stream_image
from services.rendering.source.background.extract import raw_stream_image_meta
from services.rendering.source.background.patch import (
    map_rect_to_image,
    merge_close_vertical_rects,
    rebuilt_image_bytes,
    rewrite_background_image,
    rewrite_raw_stream_image,
)

