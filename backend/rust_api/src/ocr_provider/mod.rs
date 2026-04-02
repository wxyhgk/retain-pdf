pub mod mineru;
pub mod paddle;
pub mod types;

use anyhow::{bail, Result};

#[allow(unused_imports)]
pub use types::{
    OcrArtifactSet, OcrErrorCategory, OcrProviderCapabilities, OcrProviderDiagnostics,
    OcrProviderErrorInfo, OcrProviderKind, OcrTaskHandle, OcrTaskState, OcrTaskStatus,
};

pub fn parse_provider_kind(value: &str) -> OcrProviderKind {
    match value.trim().to_ascii_lowercase().as_str() {
        "mineru" => OcrProviderKind::Mineru,
        "paddle" => OcrProviderKind::Paddle,
        _ => OcrProviderKind::Unknown,
    }
}

pub fn is_supported_provider(kind: &OcrProviderKind) -> bool {
    matches!(kind, OcrProviderKind::Mineru | OcrProviderKind::Paddle)
}

pub fn require_supported_provider(value: &str) -> Result<OcrProviderKind> {
    let kind = parse_provider_kind(value);
    if !is_supported_provider(&kind) {
        bail!("unsupported OCR provider: {}", value.trim());
    }
    Ok(kind)
}

pub fn provider_capabilities(kind: &OcrProviderKind) -> Option<OcrProviderCapabilities> {
    match kind {
        OcrProviderKind::Mineru => Some(mineru::capabilities()),
        OcrProviderKind::Paddle => Some(paddle::capabilities()),
        OcrProviderKind::Unknown => None,
    }
}
