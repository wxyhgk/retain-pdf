use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ReaderAiChatRequest {
    pub message: String,
    #[serde(default = "default_reader_ai_scope")]
    pub scope: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub context: Option<ReaderAiContextView>,
    #[serde(default)]
    pub history: Vec<ReaderAiHistoryMessageView>,
}

#[derive(Debug, Deserialize)]
pub struct ReaderAiContextView {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub selection: Option<ReaderAiSelectionView>,
    #[serde(default)]
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReaderAiSelectionView {
    pub page: i64,
    pub rect: ReaderAiRectView,
}

#[derive(Debug, Deserialize)]
pub struct ReaderAiRectView {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReaderAiHistoryMessageView {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ReaderAiChatView {
    pub answer: String,
    pub citations: Vec<ReaderAiCitationView>,
    pub used_context: ReaderAiUsedContextView,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderAiCitationView {
    pub title: String,
    pub page: Option<i64>,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
pub struct ReaderAiUsedContextView {
    pub source: String,
    pub scope: String,
}

fn default_reader_ai_scope() -> String {
    "document".to_string()
}
