use std::net::TcpListener;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use rust_api::config::AppConfig;
use rust_api::RunningServers;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
struct DesktopConfig {
    mineru_token: String,
    model_api_key: String,
    first_run_completed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopBootstrapPayload {
    runtime_config: FrontRuntimeConfig,
    app_status: DesktopAppStatus,
    first_run_completed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FrontRuntimeConfig {
    api_base: String,
    x_api_key: String,
    mineru_token: String,
    model_api_key: String,
    model: &'static str,
    base_url: &'static str,
    desktop_mode: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAppStatus {
    server_ready: bool,
    first_run_completed: bool,
    api_base: String,
    output_dir: String,
    version: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveDesktopConfigPayload {
    mineru_token: String,
    model_api_key: String,
}

struct DesktopState {
    config_path: PathBuf,
    data_dir: PathBuf,
    resource_root: PathBuf,
    python_bin: PathBuf,
    api_key: String,
    port: u16,
    simple_port: u16,
    config: Mutex<DesktopConfig>,
    servers: Mutex<Option<RunningServers>>,
}

impl DesktopState {
    fn output_dir(&self) -> PathBuf {
        self.data_dir.join("jobs")
    }

    fn api_base(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

#[tauri::command]
async fn load_desktop_config(
    app: AppHandle,
    state: State<'_, DesktopState>,
) -> Result<DesktopBootstrapPayload, String> {
    let config = state.config.lock().await.clone();
    if config.first_run_completed {
        ensure_server_running(&app, &state)
            .await
            .map_err(|err| err.to_string())?;
    }
    build_bootstrap_payload(&app, &state, &config)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
async fn save_desktop_config(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: SaveDesktopConfigPayload,
) -> Result<DesktopBootstrapPayload, String> {
    let mut config = state.config.lock().await;
    config.mineru_token = payload.mineru_token.trim().to_string();
    config.model_api_key = payload.model_api_key.trim().to_string();
    config.first_run_completed =
        !(config.mineru_token.is_empty() || config.model_api_key.is_empty());
    persist_desktop_config(&state.config_path, &config).map_err(|err| err.to_string())?;
    drop(config);

    restart_server(&app, &state)
        .await
        .map_err(|err| err.to_string())?;

    let config = state.config.lock().await.clone();
    build_bootstrap_payload(&app, &state, &config)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
async fn get_app_status(
    app: AppHandle,
    state: State<'_, DesktopState>,
) -> Result<DesktopAppStatus, String> {
    let config = state.config.lock().await.clone();
    build_app_status(&app, &state, &config)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
async fn open_output_directory(state: State<'_, DesktopState>) -> Result<(), String> {
    std::fs::create_dir_all(state.output_dir()).map_err(|err| err.to_string())?;
    open::that(state.output_dir()).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
async fn export_diagnostics(state: State<'_, DesktopState>) -> Result<String, String> {
    let diagnostics_dir = state.data_dir.join("diagnostics");
    std::fs::create_dir_all(&diagnostics_dir).map_err(|err| err.to_string())?;
    let path = diagnostics_dir.join(format!("diagnostics-{}.json", chrono_like_timestamp()));
    let config = state.config.lock().await.clone();
    let payload = serde_json::json!({
        "config_path": state.config_path,
        "api_base": state.api_base(),
        "output_dir": state.output_dir(),
        "first_run_completed": config.first_run_completed,
    });
    let text = serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?;
    std::fs::write(&path, text).map_err(|err| err.to_string())?;
    Ok(path.display().to_string())
}

fn chrono_like_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now.to_string()
}

fn persist_desktop_config(path: &Path, config: &DesktopConfig) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(config)?;
    std::fs::write(path, text)?;
    Ok(())
}

fn load_persisted_config(path: &Path) -> Result<DesktopConfig> {
    if !path.exists() {
        return Ok(DesktopConfig::default());
    }
    let text = std::fs::read_to_string(path)?;
    let config: DesktopConfig = serde_json::from_str(&text)?;
    Ok(config)
}

fn pick_free_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn resolve_resource_root(app: &AppHandle) -> Result<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let scripts_dir = resource_dir.join("scripts");
        if scripts_dir.exists() {
            return Ok(resource_dir);
        }
    }
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for candidate in manifest_dir.ancestors() {
        if candidate.join("backend").join("rust_api").exists() && candidate.join("frontend").exists() {
            return Ok(candidate.to_path_buf());
        }
    }
    Err(anyhow!(
        "failed to infer repository root from desktop_app/src-tauri location"
    ))
}

fn resolve_python_bin(app: &AppHandle, resource_root: &Path) -> PathBuf {
    if let Ok(value) = std::env::var("DESKTOP_PYTHON_BIN") {
        return PathBuf::from(value);
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let embedded = resource_dir.join("python").join("python.exe");
        if embedded.exists() {
            return embedded;
        }
        let embedded_unix = resource_dir.join("python").join("python");
        if embedded_unix.exists() {
            return embedded_unix;
        }
    }
    let repo_embedded = resource_root.join("backend").join("python").join("python.exe");
    if repo_embedded.exists() {
        return repo_embedded;
    }
    let repo_embedded_unix = resource_root.join("backend").join("python").join("python");
    if repo_embedded_unix.exists() {
        return repo_embedded_unix;
    }
    let local = resource_root
        .join(".venv")
        .join("Scripts")
        .join("python.exe");
    if local.exists() {
        return local;
    }
    let local_unix = resource_root.join(".venv").join("bin").join("python");
    if local_unix.exists() {
        return local_unix;
    }
    PathBuf::from("python")
}

async fn build_app_status(
    app: &AppHandle,
    state: &DesktopState,
    config: &DesktopConfig,
) -> Result<DesktopAppStatus> {
    let server_ready = check_health(&state.api_base()).await;
    Ok(DesktopAppStatus {
        server_ready,
        first_run_completed: config.first_run_completed,
        api_base: state.api_base(),
        output_dir: state.output_dir().display().to_string(),
        version: app.package_info().version.to_string(),
    })
}

async fn build_bootstrap_payload(
    app: &AppHandle,
    state: &DesktopState,
    config: &DesktopConfig,
) -> Result<DesktopBootstrapPayload> {
    Ok(DesktopBootstrapPayload {
        runtime_config: FrontRuntimeConfig {
            api_base: state.api_base(),
            x_api_key: state.api_key.clone(),
            mineru_token: config.mineru_token.clone(),
            model_api_key: config.model_api_key.clone(),
            model: "deepseek-chat",
            base_url: "https://api.deepseek.com/v1",
            desktop_mode: true,
        },
        app_status: build_app_status(app, state, config).await?,
        first_run_completed: config.first_run_completed,
    })
}

async fn check_health(api_base: &str) -> bool {
    let client = reqwest::Client::new();
    match client.get(format!("{api_base}/health")).send().await {
        Ok(response) => response.status() == StatusCode::OK,
        Err(_) => false,
    }
}

async fn wait_for_health(api_base: &str) -> Result<()> {
    for _ in 0..60 {
        if check_health(api_base).await {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    Err(anyhow!("desktop rust_api health check timed out"))
}

async fn ensure_server_running(app: &AppHandle, state: &DesktopState) -> Result<()> {
    {
        let servers = state.servers.lock().await;
        if servers.is_some() && check_health(&state.api_base()).await {
            return Ok(());
        }
    }
    restart_server(app, state).await
}

async fn restart_server(app: &AppHandle, state: &DesktopState) -> Result<()> {
    if let Some(running) = state.servers.lock().await.take() {
        running.shutdown().await?;
    }

    let config = state.config.lock().await.clone();
    if !config.first_run_completed {
        return Ok(());
    }

    if state.python_bin != PathBuf::from("python") && !state.python_bin.exists() {
        return Err(anyhow!(
            "desktop python runtime missing: {}",
            state.python_bin.display()
        ));
    }

    let app_config = AppConfig::from_desktop(
        state.resource_root.clone(),
        state.data_dir.clone(),
        state.python_bin.display().to_string(),
        state.port,
        state.simple_port,
        state.api_key.clone(),
    )?;
    let running = rust_api::spawn_servers(app_config);
    *state.servers.lock().await = Some(running);
    wait_for_health(&state.api_base()).await?;
    app.emit("desktop://server-ready", ()).ok();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .context("failed to resolve app_data_dir")?;
            std::fs::create_dir_all(&app_data_dir)?;
            let config_path = app_data_dir.join("config.json");
            let resource_root = resolve_resource_root(app.handle())?;
            let python_bin = resolve_python_bin(app.handle(), &resource_root);
            let config = load_persisted_config(&config_path).unwrap_or_default();

            app.manage(DesktopState {
                config_path,
                data_dir: app_data_dir,
                resource_root,
                python_bin,
                api_key: format!("desktop-{}", fastrand::u64(..)),
                port: pick_free_port()?,
                simple_port: pick_free_port()?,
                config: Mutex::new(config),
                servers: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_desktop_config,
            save_desktop_config,
            get_app_status,
            open_output_directory,
            export_diagnostics
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<DesktopState>();
                    if let Some(running) = state.servers.lock().await.take() {
                        let _ = running.shutdown().await;
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
