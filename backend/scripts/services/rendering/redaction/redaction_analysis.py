from services.rendering.redaction.math_protection import collect_page_math_protection_rects
from services.rendering.redaction.math_protection import collect_page_non_math_span_heights
from services.rendering.redaction.math_protection import is_special_math_font
from services.rendering.redaction.math_protection import page_has_intrusive_math_protection
from services.rendering.redaction.text_analysis import extract_item_word_entries
from services.rendering.redaction.text_analysis import extract_page_words
from services.rendering.redaction.text_analysis import collect_page_intrusive_display_text_rects
from services.rendering.redaction.text_analysis import item_bbox_redaction_rect
from services.rendering.redaction.text_analysis import item_has_formula
from services.rendering.redaction.text_analysis import item_has_removable_text
from services.rendering.redaction.text_analysis import item_removable_text_rects
from services.rendering.redaction.text_analysis import page_has_large_background_image
from services.rendering.redaction.text_analysis import rect_intersects_intrusive_display_text
from services.rendering.redaction.text_analysis import word_entries_to_redaction_rects
from services.rendering.redaction.text_analysis import word_rect
from services.rendering.redaction.vector_analysis import collect_page_drawing_rects
from services.rendering.redaction.vector_analysis import item_should_use_cover_only
from services.rendering.redaction.vector_analysis import item_vector_overlap_stats
from services.rendering.redaction.vector_analysis import page_drawing_count
from services.rendering.redaction.vector_analysis import page_is_vector_heavy
from services.rendering.redaction.vector_analysis import page_is_vector_heavy_count
from services.rendering.redaction.vector_analysis import page_should_use_cover_only
from services.rendering.redaction.vector_analysis import page_should_use_cover_only_count


__all__ = [
    "collect_page_drawing_rects",
    "collect_page_intrusive_display_text_rects",
    "collect_page_math_protection_rects",
    "collect_page_non_math_span_heights",
    "extract_item_word_entries",
    "extract_page_words",
    "is_special_math_font",
    "item_bbox_redaction_rect",
    "item_has_formula",
    "item_has_removable_text",
    "item_removable_text_rects",
    "item_should_use_cover_only",
    "item_vector_overlap_stats",
    "page_drawing_count",
    "page_has_intrusive_math_protection",
    "page_has_large_background_image",
    "page_is_vector_heavy",
    "page_is_vector_heavy_count",
    "page_should_use_cover_only",
    "page_should_use_cover_only_count",
    "rect_intersects_intrusive_display_text",
    "word_entries_to_redaction_rects",
    "word_rect",
]
