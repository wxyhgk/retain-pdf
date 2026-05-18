use serde::{Deserialize, Serialize};

use crate::models::defaults::*;

pub const DEFAULT_SOURCE_CLEANUP_STRATEGY: &str = "pikepdf_text_strip";
pub const SOURCE_CLEANUP_STRATEGIES: &[&str] = &[
    DEFAULT_SOURCE_CLEANUP_STRATEGY,
    "pikepdf_text_strip",
    "bbox_text_strip",
    "legacy",
    "redact_restore_formulas",
];

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RenderInput {
    #[serde(default = "default_render_mode")]
    pub render_mode: String,
    #[serde(default)]
    pub compile_workers: i64,
    #[serde(default = "default_typst_font_family")]
    pub typst_font_family: String,
    #[serde(default = "default_pdf_compress_dpi")]
    pub pdf_compress_dpi: i64,
    #[serde(default)]
    pub translated_pdf_name: String,
    #[serde(default = "default_body_font_size_factor")]
    pub body_font_size_factor: f64,
    #[serde(default = "default_body_leading_factor")]
    pub body_leading_factor: f64,
    #[serde(default = "default_inner_bbox_shrink_x")]
    pub inner_bbox_shrink_x: f64,
    #[serde(default = "default_inner_bbox_shrink_y")]
    pub inner_bbox_shrink_y: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_x")]
    pub inner_bbox_dense_shrink_x: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_y")]
    pub inner_bbox_dense_shrink_y: f64,
    #[serde(default = "default_font_unify_mode")]
    pub font_unify_mode: String,
    #[serde(default = "default_source_cleanup_strategy")]
    pub source_cleanup_strategy: String,
}

impl Default for RenderInput {
    fn default() -> Self {
        Self {
            render_mode: default_render_mode(),
            compile_workers: 0,
            typst_font_family: default_typst_font_family(),
            pdf_compress_dpi: default_pdf_compress_dpi(),
            translated_pdf_name: String::new(),
            body_font_size_factor: default_body_font_size_factor(),
            body_leading_factor: default_body_leading_factor(),
            inner_bbox_shrink_x: default_inner_bbox_shrink_x(),
            inner_bbox_shrink_y: default_inner_bbox_shrink_y(),
            inner_bbox_dense_shrink_x: default_inner_bbox_dense_shrink_x(),
            inner_bbox_dense_shrink_y: default_inner_bbox_dense_shrink_y(),
            font_unify_mode: default_font_unify_mode(),
            source_cleanup_strategy: default_source_cleanup_strategy(),
        }
    }
}
