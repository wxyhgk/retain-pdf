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
    Get {
        path: String,
    },
    Post {
        path: String,
        request_file: PathBuf,
    },
    /// 带请求体的非 POST 写操作（译文写回是 PATCH，术语表更新是 PUT）。
    Send {
        method: Method,
        path: String,
        request_file: PathBuf,
    },
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
        AgentCommand::Send {
            method,
            path,
            request_file,
        } => {
            let body = read_request_file(&request_file)?;
            (method, path, Some(body))
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
        "translation" => parse_translation_command(&args[1..]),
        "glossary" => parse_glossary_command(&args[1..]),
        "help" | "--help" | "-h" => Err(CliFailure::usage(usage())),
        _ => Err(CliFailure::usage(format!(
            "unknown command area `{area}`\n{}",
            usage()
        ))),
    }
}

fn parse_document_command(args: &[String]) -> Result<AgentCommand, CliFailure> {
    // inspect：文档元数据；usage：这本书花了多少 token（全部任务加上问这本书时的助手）。
    let suffix = match args.first().map(String::as_str) {
        Some("inspect") => "",
        Some("usage") => "/usage",
        _ => {
            return Err(CliFailure::usage(
                "expected `document inspect|usage --document-id <id>`",
            ))
        }
    };
    let flags = parse_flags(&args[1..])?;
    require_only_flags(&flags, &["--document-id"])?;
    let document_id = require_identifier(&flags, "--document-id")?;
    Ok(AgentCommand::Get {
        path: format!("/api/v1/documents/{document_id}{suffix}"),
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

/// 译文精修用的单请求命令。每条只对应一个 HTTP 请求；组合逻辑（合并 QA 与
/// 精修报告、术语写入后列受影响的块）在宿主 broker 里，不在这里。
fn parse_translation_command(args: &[String]) -> Result<AgentCommand, CliFailure> {
    let Some(action) = args.first().map(String::as_str) else {
        return Err(CliFailure::usage("translation action is required"));
    };
    let flags = parse_flags(&args[1..])?;
    let report = |suffix: &str| -> Result<AgentCommand, CliFailure> {
        require_only_flags(&flags, &["--job-id"])?;
        let job_id = require_identifier(&flags, "--job-id")?;
        Ok(AgentCommand::Get {
            path: format!("/api/v1/jobs/{job_id}/{suffix}"),
        })
    };
    match action {
        "qa" => report("translation/qa"),
        "refine-report" => report("translation/refine-report"),
        "fit-report" => report("render/fit-report"),
        "item" | "revisions" => {
            require_only_flags(&flags, &["--job-id", "--item-id"])?;
            let job_id = require_identifier(&flags, "--job-id")?;
            let item_id = require_identifier(&flags, "--item-id")?;
            let suffix = if action == "revisions" { "/revisions" } else { "" };
            Ok(AgentCommand::Get {
                path: format!("/api/v1/jobs/{job_id}/translation/items/{item_id}{suffix}"),
            })
        }
        "revise" => {
            require_only_flags(&flags, &["--job-id", "--item-id", "--request"])?;
            let job_id = require_identifier(&flags, "--job-id")?;
            let item_id = require_identifier(&flags, "--item-id")?;
            Ok(AgentCommand::Send {
                method: Method::PATCH,
                path: format!("/api/v1/jobs/{job_id}/translation/items/{item_id}"),
                request_file: require_request_file(&flags)?,
            })
        }
        "retry-stage" => {
            require_only_flags(&flags, &["--job-id", "--request"])?;
            let job_id = require_identifier(&flags, "--job-id")?;
            Ok(AgentCommand::Post {
                path: format!("/api/v1/jobs/{job_id}/retry-stage"),
                request_file: require_request_file(&flags)?,
            })
        }
        _ => Err(CliFailure::usage(format!(
            "unknown translation action `{action}`"
        ))),
    }
}

fn parse_glossary_command(args: &[String]) -> Result<AgentCommand, CliFailure> {
    let Some(action) = args.first().map(String::as_str) else {
        return Err(CliFailure::usage("glossary action is required"));
    };
    let flags = parse_flags(&args[1..])?;
    match action {
        "list" => {
            require_only_flags(&flags, &[])?;
            Ok(AgentCommand::Get {
                path: "/api/v1/glossaries".to_string(),
            })
        }
        "get" => {
            require_only_flags(&flags, &["--glossary-id"])?;
            let glossary_id = require_identifier(&flags, "--glossary-id")?;
            Ok(AgentCommand::Get {
                path: format!("/api/v1/glossaries/{glossary_id}"),
            })
        }
        "create" => {
            require_only_flags(&flags, &["--request"])?;
            Ok(AgentCommand::Post {
                path: "/api/v1/glossaries".to_string(),
                request_file: require_request_file(&flags)?,
            })
        }
        "update" => {
            require_only_flags(&flags, &["--glossary-id", "--request"])?;
            let glossary_id = require_identifier(&flags, "--glossary-id")?;
            Ok(AgentCommand::Send {
                method: Method::PUT,
                path: format!("/api/v1/glossaries/{glossary_id}"),
                request_file: require_request_file(&flags)?,
            })
        }
        _ => Err(CliFailure::usage(format!(
            "unknown glossary action `{action}`"
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
    "usage:\n  retainpdf-agent version\n  retainpdf-agent document inspect|usage --document-id <id>\n  retainpdf-agent operation create --request <relative.json>\n  retainpdf-agent operation get --operation-id <id>\n  retainpdf-agent operation run --operation-id <id> --request <relative.json>\n  retainpdf-agent operation commit --operation-id <id> --request <relative.json>\n  retainpdf-agent operation cancel --operation-id <id> --request <relative.json>\n  retainpdf-agent translation qa|refine-report|fit-report --job-id <id>\n  retainpdf-agent translation item|revisions --job-id <id> --item-id <id>\n  retainpdf-agent translation revise --job-id <id> --item-id <id> --request <relative.json>\n  retainpdf-agent translation retry-stage --job-id <id> --request <relative.json>\n  retainpdf-agent glossary list\n  retainpdf-agent glossary get --glossary-id <id>\n  retainpdf-agent glossary create --request <relative.json>\n  retainpdf-agent glossary update --glossary-id <id> --request <relative.json>"
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

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn document_usage_reads_the_book_usage_summary() {
        let usage = parse_command(args(&["document", "usage", "--document-id", "doc-1"]))
            .expect("usage");
        assert!(matches!(usage, AgentCommand::Get { path } if path == "/api/v1/documents/doc-1/usage"));
        assert!(parse_command(args(&["document", "delete", "--document-id", "doc-1"])).is_err());
    }

    #[test]
    fn translation_commands_map_to_one_fixed_request_each() {
        let qa = parse_command(args(&["translation", "qa", "--job-id", "job-1"])).expect("qa");
        assert!(matches!(qa, AgentCommand::Get { path } if path == "/api/v1/jobs/job-1/translation/qa"));
        let refine = parse_command(args(&["translation", "refine-report", "--job-id", "job-1"]))
            .expect("refine report");
        assert!(matches!(refine, AgentCommand::Get { path }
            if path == "/api/v1/jobs/job-1/translation/refine-report"));
        let fit = parse_command(args(&["translation", "fit-report", "--job-id", "job-1"]))
            .expect("fit report");
        assert!(matches!(fit, AgentCommand::Get { path } if path == "/api/v1/jobs/job-1/render/fit-report"));
        let history = parse_command(args(&[
            "translation", "revisions", "--job-id", "job-1", "--item-id", "p003-b004",
        ]))
        .expect("revisions");
        assert!(matches!(history, AgentCommand::Get { path }
            if path == "/api/v1/jobs/job-1/translation/items/p003-b004/revisions"));
        let revise = parse_command(args(&[
            "translation", "revise", "--job-id", "job-1", "--item-id", "p003-b004",
            "--request", "requests/r.json",
        ]))
        .expect("revise");
        assert!(matches!(revise, AgentCommand::Send { method, path, .. }
            if method == Method::PATCH && path == "/api/v1/jobs/job-1/translation/items/p003-b004"));
        let retry = parse_command(args(&[
            "translation", "retry-stage", "--job-id", "job-1", "--request", "requests/r.json",
        ]))
        .expect("retry");
        assert!(matches!(retry, AgentCommand::Post { path, .. } if path == "/api/v1/jobs/job-1/retry-stage"));
        let update = parse_command(args(&[
            "glossary", "update", "--glossary-id", "glossary-1", "--request", "requests/g.json",
        ]))
        .expect("glossary update");
        assert!(matches!(update, AgentCommand::Send { method, path, .. }
            if method == Method::PUT && path == "/api/v1/glossaries/glossary-1"));
        assert!(matches!(
            parse_command(args(&["glossary", "list"])).expect("list"),
            AgentCommand::Get { path } if path == "/api/v1/glossaries"
        ));
    }

    #[test]
    fn translation_commands_reject_traversal_and_unknown_flags() {
        for bad in [
            args(&["translation", "qa", "--job-id", "../job"]),
            args(&["translation", "item", "--job-id", "job-1", "--item-id", "a/b"]),
            args(&["translation", "revise", "--job-id", "job-1", "--item-id", "p1"]),
            args(&["translation", "qa", "--job-id", "job-1", "--extra", "x"]),
            args(&["translation", "delete", "--job-id", "job-1"]),
            args(&["glossary", "list", "--glossary-id", "g"]),
        ] {
            assert!(parse_command(bad.clone()).is_err(), "accepted {bad:?}");
        }
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
