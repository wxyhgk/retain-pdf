use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveTranslationLayoutView {
    pub pages: Vec<LiveTranslationLayoutPageView>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveTranslationLayoutPageView {
    pub page_idx: u32,
    pub width: f64,
    pub height: f64,
    pub blocks: Vec<LiveTranslationLayoutBlockView>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveTranslationLayoutBlockView {
    pub item_id: String,
    pub bbox: Vec<f64>,
    pub source_text: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typography: Option<LiveTranslationTypographyView>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveTranslationTypographyView {
    pub font_family: String,
    pub font_size_pt: f64,
    pub leading_em: f64,
    pub font_weight: u16,
    pub text_align: String,
    pub padding_top_pt: f64,
    pub padding_right_pt: f64,
    pub padding_bottom_pt: f64,
    pub padding_left_pt: f64,
    pub fit_min_font_size_pt: f64,
    pub fit_max_font_size_pt: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LiveTranslationPageView {
    pub attempt: u32,
    pub generation: u64,
    pub page_idx: u32,
    pub page_hash: String,
    pub items: Vec<LiveTranslationItemView>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LiveTranslationItemView {
    pub item_id: String,
    pub translated_text: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LiveTranslationCommitEventView {
    pub event: &'static str,
    pub seq: i64,
    pub attempt: u32,
    pub generation: u64,
    pub page_idx: u32,
    pub page_hash: String,
    pub changed_item_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
pub struct LiveTranslationEventsQuery {
    #[serde(default)]
    pub after_seq: i64,
}
