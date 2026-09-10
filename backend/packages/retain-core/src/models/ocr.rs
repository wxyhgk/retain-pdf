use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrProviderKind {
    Mineru,
    Paddle,
    Local,
    Unknown,
}

impl Default for OcrProviderKind {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrTaskState {
    Queued,
    WaitingUpload,
    Running,
    Converting,
    Succeeded,
    Failed,
    Unknown,
}

impl Default for OcrTaskState {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct OcrTaskHandle {
    pub batch_id: Option<String>,
    pub task_id: Option<String>,
    pub file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct OcrProviderCapabilities {
    pub supports_remote_url_submit: bool,
    pub supports_local_file_upload: bool,
    pub supports_polling: bool,
    pub supports_download_bundle: bool,
    pub supports_extra_formats: bool,
    pub supports_formula_toggle: bool,
    pub supports_table_toggle: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct OcrProviderArtifactLayout {
    pub provider_result_json: String,
    pub provider_bundle_zip: String,
    pub provider_raw_dir: String,
    pub layout_json: String,
}

impl OcrProviderArtifactLayout {
    pub fn new(
        provider_result_json: impl Into<String>,
        provider_bundle_zip: impl Into<String>,
        provider_raw_dir: impl Into<String>,
        layout_json: impl Into<String>,
    ) -> Self {
        Self {
            provider_result_json: provider_result_json.into(),
            provider_bundle_zip: provider_bundle_zip.into(),
            provider_raw_dir: provider_raw_dir.into(),
            layout_json: layout_json.into(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
pub struct OcrProviderCredentialSpec {
    /// Canonical credential-vault kind accepted by `ocr.credential_ref`.
    #[serde(default)]
    pub credential_kind: String,
    /// Canonical request field for an opaque credential reference.
    #[serde(default)]
    pub reference_field: String,
    /// Temporary inline request field retained for older clients.
    #[serde(default)]
    pub legacy_inline_field: String,
    /// Legacy alias for `legacy_inline_field`, retained for compatibility.
    pub field: String,
    pub env: String,
    #[serde(default)]
    pub required_for: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct OcrProviderOptionSpec {
    #[serde(rename = "type")]
    pub option_type: String,
    #[serde(default)]
    pub default: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<String>,
    #[serde(default)]
    pub aliases: BTreeMap<String, String>,
    #[serde(default)]
    pub choices: Vec<String>,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct OcrProviderPublicDefinition {
    pub key: String,
    pub display_name: String,
    pub provider_kind: String,
    pub credential: Option<OcrProviderCredentialSpec>,
    #[serde(default)]
    pub options: BTreeMap<String, OcrProviderOptionSpec>,
    pub capabilities: OcrProviderCapabilities,
    pub artifact_layout: OcrProviderArtifactLayout,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrErrorCategory {
    HttpStatus,
    Unauthorized,
    CredentialExpired,
    InvalidRequest,
    ServiceUnavailable,
    UploadLinkRequestFailed,
    UnsupportedFileFormat,
    FileReadFailed,
    EmptyFile,
    FileTooLarge,
    TooManyPages,
    RemoteReadTimeout,
    QueueFull,
    ParseFailed,
    UploadedFileMissing,
    TaskNotFound,
    PermissionDenied,
    OperationNotAllowed,
    ConversionFailed,
    RetryLimitReached,
    QuotaExceeded,
    HtmlQuotaExceeded,
    FileSplitFailed,
    PageCountReadFailed,
    WebReadFailed,
    UploadFailed,
    PollTimeout,
    ProviderFailed,
    ResultDownloadFailed,
    ResultUnpackFailed,
    InvalidProviderResponse,
    Unknown,
}

impl Default for OcrErrorCategory {
    fn default() -> Self {
        Self::Unknown
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OcrProviderErrorInfo {
    pub category: OcrErrorCategory,
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub operator_hint: Option<String>,
    pub trace_id: Option<String>,
    pub http_status: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OcrTaskStatus {
    pub provider: OcrProviderKind,
    pub handle: OcrTaskHandle,
    pub state: OcrTaskState,
    pub raw_state: Option<String>,
    pub stage: Option<String>,
    pub detail: Option<String>,
    pub provider_message: Option<String>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OcrArtifactSet {
    pub full_zip_url: Option<String>,
    pub provider_result_json: Option<String>,
    pub provider_bundle_zip: Option<String>,
    pub layout_json: Option<String>,
    pub normalized_document_json: Option<String>,
    pub normalization_report_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OcrProviderDiagnostics {
    pub provider: OcrProviderKind,
    pub capabilities: Option<OcrProviderCapabilities>,
    pub handle: OcrTaskHandle,
    pub last_status: Option<OcrTaskStatus>,
    pub last_error: Option<OcrProviderErrorInfo>,
    pub artifacts: OcrArtifactSet,
}

impl OcrProviderDiagnostics {
    pub fn new(provider: OcrProviderKind) -> Self {
        Self {
            provider,
            capabilities: None,
            handle: OcrTaskHandle::default(),
            last_status: None,
            last_error: None,
            artifacts: OcrArtifactSet::default(),
        }
    }
}
