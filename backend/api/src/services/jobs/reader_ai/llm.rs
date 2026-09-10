use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::api::{ReaderAiChatRequest, ReaderAiHistoryMessageView};

use super::config::ReaderAiConfig;
use super::retrieval::RetrievedChunk;

const DEFAULT_READER_TEMPERATURE: f32 = 0.2;

fn reader_temperature() -> f32 {
    std::env::var("RUST_API_READER_TEMPERATURE")
        .ok()
        .and_then(|value| value.trim().parse::<f32>().ok())
        .filter(|value| value.is_finite() && *value >= 0.0 && *value <= 2.0)
        .unwrap_or(DEFAULT_READER_TEMPERATURE)
}

pub(super) async fn complete_reader_answer(
    config: &ReaderAiConfig,
    request: &ReaderAiChatRequest,
    chunks: &[RetrievedChunk],
) -> Result<String, AppError> {
    let messages = build_messages(request, chunks);
    let payload = ChatCompletionRequest {
        model: config.model.clone(),
        messages,
        temperature: reader_temperature(),
    };
    let url = format!("{}/chat/completions", config.base_url);
    let reader_llm = retain_core::config::ReaderLlmConfig::from_env();
    let client = reqwest::Client::builder()
        .connect_timeout(reader_llm.connect_timeout)
        .timeout(reader_llm.timeout)
        .build()
        .map_err(|err| AppError::internal(format!("failed to build AI HTTP client: {err}")))?;
    let response = client
        .post(url)
        .bearer_auth(&config.api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|err| AppError::bad_gateway(format!("AI model request failed: {err}")))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| AppError::bad_gateway(format!("AI model response read failed: {err}")))?;
    if status == StatusCode::TOO_MANY_REQUESTS {
        return Err(AppError::too_many_requests(provider_error_message(body)));
    }
    if !status.is_success() {
        return Err(AppError::bad_gateway(provider_error_message(body)));
    }
    let parsed: ChatCompletionResponse = serde_json::from_str(&body)
        .map_err(|err| AppError::bad_gateway(format!("AI model returned invalid JSON: {err}")))?;
    parsed
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|answer| !answer.is_empty())
        .ok_or_else(|| AppError::bad_gateway("AI model returned an empty answer"))
}

fn build_messages(request: &ReaderAiChatRequest, chunks: &[RetrievedChunk]) -> Vec<ChatMessage> {
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: reader_system_prompt(),
    }];
    messages.extend(history_messages(&request.history));
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: format!(
            "用户问题：{}\n\n可用文档片段：\n{}",
            request.message.trim(),
            format_context(chunks)
        ),
    });
    messages
}

fn history_messages(history: &[ReaderAiHistoryMessageView]) -> Vec<ChatMessage> {
    history
        .iter()
        .filter_map(|item| {
            let role = item.role.trim();
            let content = item.content.trim();
            if content.is_empty() || !matches!(role, "user" | "assistant") {
                return None;
            }
            Some(ChatMessage {
                role: role.to_string(),
                content: content.chars().take(2_000).collect(),
            })
        })
        .take(12)
        .collect()
}

fn reader_system_prompt() -> String {
    [
        "你是 RetainPDF 的文档阅读助手。",
        "只能基于提供的文档片段回答，不要编造未给出的事实。",
        "如果片段不足以回答，直接说明证据不足。",
        "回答使用用户提问的语言，尽量简洁，并在必要时提到依据来自哪些片段标题。",
    ]
    .join("\n")
}

fn format_context(chunks: &[RetrievedChunk]) -> String {
    chunks
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let page = item
                .chunk
                .page
                .map(|page| page.to_string())
                .unwrap_or_else(|| "unknown".to_string());
            format!(
                "[{}] title={} page={} score={:.2}\n{}",
                index + 1,
                item.chunk.title,
                page,
                item.score,
                item.chunk.text
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn provider_error_message(body: String) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "AI model service failed".to_string();
    }
    format!("AI model service failed: {trimmed}")
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: String,
}
