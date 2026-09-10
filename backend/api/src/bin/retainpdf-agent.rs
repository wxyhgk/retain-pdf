use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::ExitCode;

use reqwest::{Client, Method, StatusCode};
use serde::Serialize;
use serde_json::Value;
use url::{Host, Url};

const CLI_RESPONSE_SCHEMA: &str = "retainpdf_agent_cli_response_v1";
const DEFAULT_API_URL: &str = "http://127.0.0.1:41000";
const MAX_REQUEST_BYTES: u64 = 1024 * 1024;

#[derive(Debug)]
enum AgentCommand {
    Version,
    Get { path: String },
    Post { path: String, request_file: PathBuf },
}

#[derive(Debug, PartialEq, Eq)]
enum AgentCredential {
    Capability(String),
    ApiKey(String),
}

#[derive(Debug, Serialize)]
struct CliEnvelope {
    schema: &'static str,
    ok: bool,
    http_status: Option<u16>,
    response: Option<Value>,
    error: Option<CliErrorView>,
}

#[derive(Debug, Serialize)]
struct CliErrorView {
    code: &'static str,
    message: String,
}

#[derive(Debug)]
struct CliFailure {
    code: &'static str,
    message: String,
    http_status: Option<u16>,
    response: Option<Value>,
}

impl CliFailure {
    fn usage(message: impl Into<String>) -> Self {
        Self {
            code: "invalid_arguments",
            message: message.into(),
            http_status: None,
            response: None,
        }
    }

    fn local(message: impl Into<String>) -> Self {
        Self {
            code: "local_io_failed",
            message: message.into(),
            http_status: None,
            response: None,
        }
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok((status, response)) => {
            print_json(&CliEnvelope {
                schema: CLI_RESPONSE_SCHEMA,
                ok: true,
                http_status: status.map(|status| status.as_u16()),
                response: Some(response),
                error: None,
            });
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprint_json(&CliEnvelope {
                schema: CLI_RESPONSE_SCHEMA,
                ok: false,
                http_status: error.http_status,
                response: error.response,
                error: Some(CliErrorView {
                    code: error.code,
                    message: error.message,
                }),
            });
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(Option<StatusCode>, Value), CliFailure> {
    let command = parse_command(env::args().skip(1).collect())?;
    if matches!(command, AgentCommand::Version) {
        return Ok((None, version_response()));
    }
    let api_url =
        env::var("RETAINPDF_AGENT_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string());
    let api_url = validate_api_url(&api_url)?;
    let credential = select_credential(
        env::var("RETAINPDF_AGENT_CAPABILITY").ok(),
        env::var("RETAINPDF_AGENT_API_KEY").ok(),
    )?;

    let (method, path, body) = match command {
        AgentCommand::Version => unreachable!("version returns before backend setup"),
        AgentCommand::Get { path } => (Method::GET, path, None),
        AgentCommand::Post { path, request_file } => {
            let body = read_request_file(&request_file)?;
            (Method::POST, path, Some(body))
        }
    };
    let client = Client::builder().no_proxy().build().map_err(|error| {
        CliFailure::local(format!("failed to build local HTTP client: {error}"))
    })?;
    let mut request = client.request(
        method,
        format!("{}{path}", api_url.as_str().trim_end_matches('/')),
    );
    request = match credential {
        AgentCredential::Capability(value) => request.header("X-RetainPDF-Agent-Capability", value),
        AgentCredential::ApiKey(value) => request.header("X-API-Key", value),
    };
    request = request.header("Accept", "application/json");
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request.send().await.map_err(|error| CliFailure {
        code: "backend_unavailable",
        message: format!("local RetainPDF API request failed: {error}"),
        http_status: None,
        response: None,
    })?;
    let status = response.status();
    let bytes = response.bytes().await.map_err(|error| CliFailure {
        code: "invalid_backend_response",
        message: format!("failed to read local RetainPDF API response: {error}"),
        http_status: Some(status.as_u16()),
        response: None,
    })?;
    let payload: Value = serde_json::from_slice(&bytes).map_err(|_| CliFailure {
        code: "invalid_backend_response",
        message: "local RetainPDF API returned non-JSON output".to_string(),
        http_status: Some(status.as_u16()),
        response: None,
    })?;
    if !status.is_success() {
        return Err(CliFailure {
            code: "backend_rejected_request",
            message: payload
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("local RetainPDF API rejected the request")
                .to_string(),
            http_status: Some(status.as_u16()),
            response: Some(payload),
        });
    }
    Ok((Some(status), payload))
}

fn version_response() -> Value {
    serde_json::json!({
        "schema": CLI_RESPONSE_SCHEMA,
        "version": env!("CARGO_PKG_VERSION"),
    })
}

fn select_credential(
    capability: Option<String>,
    api_key: Option<String>,
) -> Result<AgentCredential, CliFailure> {
    if let Some(value) = capability.map(|value| value.trim().to_string()) {
        if !value.is_empty() {
            return Ok(AgentCredential::Capability(value));
        }
    }
    if let Some(value) = api_key.map(|value| value.trim().to_string()) {
        if !value.is_empty() {
            return Ok(AgentCredential::ApiKey(value));
        }
    }
    Err(CliFailure::usage(
        "RETAINPDF_AGENT_CAPABILITY is required (RETAINPDF_AGENT_API_KEY is supported only for trusted bootstrap use)",
    ))
}

fn parse_command(args: Vec<String>) -> Result<AgentCommand, CliFailure> {
    let Some(area) = args.first().map(String::as_str) else {
        return Err(CliFailure::usage(usage()));
    };
    match area {
        "version" | "--version" => {
            if args.len() == 1 {
                Ok(AgentCommand::Version)
            } else {
                Err(CliFailure::usage("version does not accept arguments"))
            }
        }
        "document" => parse_document_command(&args[1..]),
        "operation" => parse_operation_command(&args[1..]),
        "help" | "--help" | "-h" => Err(CliFailure::usage(usage())),
        _ => Err(CliFailure::usage(format!(
            "unknown command area `{area}`\n{}",
            usage()
        ))),
    }
}

fn parse_document_command(args: &[String]) -> Result<AgentCommand, CliFailure> {
    if args.first().map(String::as_str) != Some("inspect") {
        return Err(CliFailure::usage(
            "expected `document inspect --document-id <id>`",
        ));
    }
    let flags = parse_flags(&args[1..])?;
    require_only_flags(&flags, &["--document-id"])?;
    let document_id = require_identifier(&flags, "--document-id")?;
    Ok(AgentCommand::Get {
        path: format!("/api/v1/documents/{document_id}"),
    })
}

fn parse_operation_command(args: &[String]) -> Result<AgentCommand, CliFailure> {
    let Some(action) = args.first().map(String::as_str) else {
        return Err(CliFailure::usage("operation action is required"));
    };
    let flags = parse_flags(&args[1..])?;
    match action {
        "create" => {
            require_only_flags(&flags, &["--request"])?;
            Ok(AgentCommand::Post {
                path: "/api/v1/internal/agent/operations".to_string(),
                request_file: require_request_file(&flags)?,
            })
        }
        "get" => {
            require_only_flags(&flags, &["--operation-id"])?;
            let operation_id = require_operation_id(&flags)?;
            Ok(AgentCommand::Get {
                path: format!("/api/v1/internal/agent/operations/{operation_id}"),
            })
        }
        "run" | "commit" | "cancel" => {
            require_only_flags(&flags, &["--operation-id", "--request"])?;
            let operation_id = require_operation_id(&flags)?;
            Ok(AgentCommand::Post {
                path: format!("/api/v1/internal/agent/operations/{operation_id}/{action}"),
                request_file: require_request_file(&flags)?,
            })
        }
        _ => Err(CliFailure::usage(format!(
            "unknown operation action `{action}`"
        ))),
    }
}

fn parse_flags(args: &[String]) -> Result<BTreeMap<String, String>, CliFailure> {
    if !args.len().is_multiple_of(2) {
        return Err(CliFailure::usage("every flag requires one value"));
    }
    let mut flags = BTreeMap::new();
    for pair in args.chunks_exact(2) {
        if !pair[0].starts_with("--") {
            return Err(CliFailure::usage(format!(
                "unexpected positional argument `{}`",
                pair[0]
            )));
        }
        if flags.insert(pair[0].clone(), pair[1].clone()).is_some() {
            return Err(CliFailure::usage(format!("duplicate flag `{}`", pair[0])));
        }
    }
    Ok(flags)
}

fn require_only_flags(
    flags: &BTreeMap<String, String>,
    allowed: &[&str],
) -> Result<(), CliFailure> {
    if let Some(unknown) = flags.keys().find(|flag| !allowed.contains(&flag.as_str())) {
        return Err(CliFailure::usage(format!("unknown flag `{unknown}`")));
    }
    Ok(())
}

fn require_identifier(flags: &BTreeMap<String, String>, name: &str) -> Result<String, CliFailure> {
    let value = flags
        .get(name)
        .ok_or_else(|| CliFailure::usage(format!("{name} is required")))?;
    rust_api::models::validate_operation_id(value).map_err(CliFailure::usage)?;
    Ok(value.clone())
}

fn require_operation_id(flags: &BTreeMap<String, String>) -> Result<String, CliFailure> {
    require_identifier(flags, "--operation-id")
}

fn require_request_file(flags: &BTreeMap<String, String>) -> Result<PathBuf, CliFailure> {
    let path = flags
        .get("--request")
        .ok_or_else(|| CliFailure::usage("--request is required"))?;
    validate_request_path_shape(Path::new(path))?;
    Ok(PathBuf::from(path))
}

fn validate_request_path_shape(path: &Path) -> Result<(), CliFailure> {
    if path.is_absolute()
        || path.extension().and_then(|value| value.to_str()) != Some("json")
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_) | Component::CurDir))
    {
        return Err(CliFailure::usage(
            "--request must be a workspace-relative .json file without parent traversal",
        ));
    }
    Ok(())
}

fn validate_api_url(value: &str) -> Result<Url, CliFailure> {
    let url = Url::parse(value).map_err(|_| {
        CliFailure::usage("RETAINPDF_AGENT_API_URL must be a valid loopback HTTP URL")
    })?;
    let loopback = match url.host() {
        Some(Host::Domain(host)) => host.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    };
    if url.scheme() != "http"
        || !loopback
        || url.port().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || !matches!(url.path(), "" | "/")
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(CliFailure::usage(
            "RETAINPDF_AGENT_API_URL must be an explicit loopback HTTP origin with a port",
        ));
    }
    Ok(url)
}

fn read_request_file(path: &Path) -> Result<Value, CliFailure> {
    validate_request_path_shape(path)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| CliFailure::local(format!("failed to inspect request file: {error}")))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(CliFailure::local(
            "request path must be a regular non-symlink file",
        ));
    }
    if metadata.len() > MAX_REQUEST_BYTES {
        return Err(CliFailure::local("request file exceeds 1 MiB"));
    }
    let workspace = env::current_dir()
        .and_then(|path| path.canonicalize())
        .map_err(|error| CliFailure::local(format!("failed to resolve workspace: {error}")))?;
    let resolved = path
        .canonicalize()
        .map_err(|error| CliFailure::local(format!("failed to resolve request file: {error}")))?;
    if !resolved.starts_with(&workspace) {
        return Err(CliFailure::local(
            "request file escapes the current workspace",
        ));
    }
    let bytes = fs::read(&resolved)
        .map_err(|error| CliFailure::local(format!("failed to read request file: {error}")))?;
    let payload: Value = serde_json::from_slice(&bytes)
        .map_err(|error| CliFailure::local(format!("request file is not valid JSON: {error}")))?;
    if !payload.is_object() {
        return Err(CliFailure::local("request JSON must be an object"));
    }
    Ok(payload)
}

fn usage() -> &'static str {
    "usage:\n  retainpdf-agent version\n  retainpdf-agent document inspect --document-id <id>\n  retainpdf-agent operation create --request <relative.json>\n  retainpdf-agent operation get --operation-id <id>\n  retainpdf-agent operation run --operation-id <id> --request <relative.json>\n  retainpdf-agent operation commit --operation-id <id> --request <relative.json>\n  retainpdf-agent operation cancel --operation-id <id> --request <relative.json>"
}

fn print_json(value: &impl Serialize) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).expect("serialize CLI response")
    );
}

fn eprint_json(value: &impl Serialize) {
    eprintln!(
        "{}",
        serde_json::to_string_pretty(value).expect("serialize CLI error")
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_a_local_command_with_a_stable_schema_and_version() {
        assert!(matches!(
            parse_command(vec!["version".to_string()]).expect("parse version"),
            AgentCommand::Version
        ));
        assert_eq!(
            version_response(),
            serde_json::json!({
                "schema": "retainpdf_agent_cli_response_v1",
                "version": env!("CARGO_PKG_VERSION"),
            })
        );
        assert!(parse_command(vec!["version".to_string(), "extra".to_string()]).is_err());
    }

    #[test]
    fn parses_only_the_fixed_operation_command_grammar() {
        let command = parse_command(vec![
            "operation".to_string(),
            "run".to_string(),
            "--operation-id".to_string(),
            "op-safe-1".to_string(),
            "--request".to_string(),
            "requests/run.json".to_string(),
        ])
        .expect("parse command");
        assert!(matches!(
            command,
            AgentCommand::Post { path, request_file }
                if path.ends_with("/op-safe-1/run")
                    && request_file == Path::new("requests/run.json")
        ));
    }

    #[test]
    fn rejects_shell_syntax_in_operation_identity() {
        let error = parse_command(vec![
            "operation".to_string(),
            "get".to_string(),
            "--operation-id".to_string(),
            "op-safe;cat".to_string(),
        ])
        .expect_err("reject command injection");
        assert_eq!(error.code, "invalid_arguments");
    }

    #[test]
    fn request_path_must_stay_relative_and_json() {
        for path in ["../request.json", "/tmp/request.json", "request.txt"] {
            assert!(validate_request_path_shape(Path::new(path)).is_err());
        }
        validate_request_path_shape(Path::new("requests/create.json"))
            .expect("accept safe request path");
    }

    #[test]
    fn rejects_unknown_or_duplicate_flags() {
        assert!(parse_command(vec![
            "operation".to_string(),
            "get".to_string(),
            "--operation-id".to_string(),
            "op-safe".to_string(),
            "--extra".to_string(),
            "value".to_string(),
        ])
        .is_err());
        assert!(parse_command(vec![
            "document".to_string(),
            "inspect".to_string(),
            "--document-id".to_string(),
            "doc-a".to_string(),
            "--document-id".to_string(),
            "doc-b".to_string(),
        ])
        .is_err());
    }

    #[test]
    fn backend_origin_must_be_explicit_loopback_http() {
        for value in [
            "https://127.0.0.1:41000",
            "http://example.com:41000",
            "http://localhost:41000@evil.example",
            "http://localhost:41000/api",
            "http://localhost",
        ] {
            assert!(validate_api_url(value).is_err(), "accepted {value}");
        }
        validate_api_url("http://127.0.0.1:41000").expect("IPv4 loopback");
        validate_api_url("http://[::1]:41000").expect("IPv6 loopback");
        validate_api_url("http://localhost:41000").expect("localhost");
    }

    #[test]
    fn short_lived_capability_is_preferred_over_full_api_key() {
        let selected = select_credential(
            Some("rpdfcap1.payload.signature".to_string()),
            Some("full-api-key".to_string()),
        )
        .expect("select capability");
        assert_eq!(
            selected,
            AgentCredential::Capability("rpdfcap1.payload.signature".to_string())
        );
    }

    #[test]
    fn missing_credential_error_does_not_echo_secret_material() {
        let error = select_credential(Some("   ".to_string()), None).expect_err("missing");
        assert!(!error.message.contains("rpdfcap1"));
        assert!(!error.message.contains("X-API-Key"));
    }
}
