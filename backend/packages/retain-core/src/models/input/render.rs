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

#[cfg(test)]
mod contract_tests {
    use super::*;

    /// `RENDER_OPTIONS_CONTRACT.md` 的表格是这些字段的对外契约,文档开头就写着
    /// 「Rust API 是参数契约入口,负责默认值」。代码和文档漂了就是对外撒谎。
    ///
    /// 这条曾经真漂过:文档写 auto,代码返回 typst。而 resolve_effective_render_mode()
    /// 对非 auto 一律原样返回,于是省略 render 段的客户端拿到固定 typst、不做文档分析,
    /// 同一本书从上传弹窗和从详情页翻,走的是两条渲染管线。
    const CONTRACT_DOC: &str = include_str!("../../../../../api/RENDER_OPTIONS_CONTRACT.md");

    fn documented_default(field: &str) -> String {
        let needle = format!("| `render.{field}` |");
        let line = CONTRACT_DOC
            .lines()
            .find(|line| line.starts_with(&needle))
            .unwrap_or_else(|| panic!("契约文档里没有 render.{field} 这一行 —— 文档表格的写法变了,这条测试已经失效"));
        let cell = line
            .split('|')
            .nth(3)
            .unwrap_or_else(|| panic!("render.{field} 那一行列数不对"))
            .trim()
            .trim_matches('`')
            .to_string();
        assert!(!cell.is_empty(), "render.{field} 的默认值单元格是空的");
        cell
    }

    #[test]
    fn render_mode_default_matches_the_contract_doc() {
        let input = RenderInput::default();
        assert_eq!(
            input.render_mode,
            documented_default("render_mode"),
            "render_mode 的实际默认值和 RENDER_OPTIONS_CONTRACT.md 写的不一致"
        );
    }

    #[test]
    fn string_and_number_defaults_match_the_contract_doc() {
        let input = RenderInput::default();
        assert_eq!(input.font_unify_mode, documented_default("font_unify_mode"));
        assert_eq!(
            input.source_cleanup_strategy,
            documented_default("source_cleanup_strategy")
        );
        assert_eq!(
            input.body_font_size_factor.to_string(),
            documented_default("body_font_size_factor")
        );
        assert_eq!(
            input.body_leading_factor.to_string(),
            documented_default("body_leading_factor")
        );
        assert_eq!(
            input.pdf_compress_dpi.to_string(),
            documented_default("pdf_compress_dpi")
        );
        assert_eq!(
            input.compile_workers.to_string(),
            documented_default("compile_workers")
        );
    }

    /// 自保:解析不出文档就报错,而不是静默变成空操作。
    #[test]
    fn the_contract_doc_is_still_parseable() {
        assert!(
            CONTRACT_DOC.contains("| `render.render_mode` |"),
            "契约文档的表格写法变了,上面几条测试已经挡不住漂移"
        );
    }
}
