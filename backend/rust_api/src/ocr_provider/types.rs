use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OcrProviderKind {
    Mineru,
    Paddle,
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
