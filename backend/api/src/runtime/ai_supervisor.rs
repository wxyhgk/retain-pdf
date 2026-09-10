//! retainpdf-ai 子服务监督器（Phase 2：监督统一，ADR-001）。
//!
//! rust_api 作为 ai_service 的唯一 supervisor：
//! - 拉起子进程并注入互通所需 env（钥匙单源：直接下发 rust 的 key 集合）
//! - 轮询 /readyz 等就绪；就绪后周期探活
//! - 子进程退出 / 连续探活失败 → 指数退避重启（有上限，探活成功即复位）
//! - rust 优雅退出时回收整棵进程树（复用 job_runner 的 terminate 工具）
//!
//! 状态经进程级原子量暴露给 ai_proxy 做快速失败：Unhealthy 时不再发起
//! 上游连接，直接返回结构化 503（前端既有 502/503 本地降级链路可接）。
//! `Disabled`（默认）下 proxy 行为与历史完全一致——开发模式手动跑
//! ai_service 不受任何影响。

use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;

use tokio::process::{Child, Command};
use tokio::sync::watch;
use tokio::task::JoinHandle;

use crate::config::{AiServiceConfig, AppConfig};
use crate::process::{configure_child_process, terminate_job_process_tree};

pub const AI_STATUS_DISABLED: u8 = 0;
pub const AI_STATUS_STARTING: u8 = 1;
pub const AI_STATUS_HEALTHY: u8 = 2;
pub const AI_STATUS_UNHEALTHY: u8 = 3;

static AI_STATUS: AtomicU8 = AtomicU8::new(AI_STATUS_DISABLED);

pub fn ai_service_status() -> u8 {
    AI_STATUS.load(Ordering::Relaxed)
}

pub fn ai_service_status_label() -> &'static str {
    match ai_service_status() {
        AI_STATUS_STARTING => "starting",
        AI_STATUS_HEALTHY => "healthy",
        AI_STATUS_UNHEALTHY => "unhealthy",
        _ => "unsupervised",
    }
}

fn set_status(status: u8) {
    AI_STATUS.store(status, Ordering::Relaxed);
}

/// 组装子进程 env（互通六件套）。已有同名外部 env 会被覆盖——单源正是目的：
/// 监督模式下 ai_service 的互通配置只应来自 rust。LLM key 等其余变量正常继承。
fn child_env(app: &AppConfig, ai: &AiServiceConfig) -> Vec<(String, String)> {
    let keys = {
        let mut sorted: Vec<_> = app.api_keys.iter().cloned().collect();
        sorted.sort();
        sorted
    };
    vec![
        ("RETAIN_AI_HOST".into(), ai.bind_host.clone()),
        ("RETAIN_AI_PORT".into(), ai.port.to_string()),
        ("RETAIN_AI_API_KEYS".into(), keys.join(",")),
        (
            "RETAIN_AI_RUST_API_KEY".into(),
            keys.first().cloned().unwrap_or_default(),
        ),
        (
            "RETAIN_AI_RUST_API_BASE".into(),
            format!("http://{}:{}", app.bind_host, app.port),
        ),
        (
            "RETAIN_AI_DATA_ROOT".into(),
            app.data_root.to_string_lossy().to_string(),
        ),
    ]
}

fn spawn_child(app: &AppConfig, ai: &AiServiceConfig) -> std::io::Result<Child> {
    let mut command = Command::new(&ai.command);
    command.args(&ai.args);
    // 自成进程组：terminate_job_process_tree 是组杀（kill(-pid)）——不建组
    // 则组杀落空、child.wait 永等（监督器 shutdown 悬挂，集成测试实证）
    configure_child_process(&mut command);
    if let Some(cwd) = &ai.cwd {
        command.current_dir(cwd);
    }
    for (key, value) in child_env(app, ai) {
        command.env(key, value);
    }
    command.kill_on_drop(true);
    command.spawn()
}

async fn terminate_child(child: &mut Child, grace_secs: u64, poll_ms: u64) {
    if let Some(pid) = child.id() {
        if terminate_job_process_tree(pid, grace_secs, poll_ms)
            .await
            .is_ok()
        {
            let _ = child.wait().await;
            return;
        }
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
}

async fn probe(client: &reqwest::Client, url: &str) -> bool {
    matches!(client.get(url).send().await, Ok(resp) if resp.status().is_success())
}

/// sleep 与 shutdown 竞速；返回 true = 收到退出信号
async fn sleep_or_shutdown(duration: Duration, shutdown: &mut watch::Receiver<bool>) -> bool {
    if *shutdown.borrow() {
        return true;
    }
    tokio::select! {
        _ = tokio::time::sleep(duration) => false,
        _ = shutdown.changed() => true,
    }
}

enum RunOutcome {
    Shutdown,
    Restart,
}

async fn run_once(
    app: &AppConfig,
    ai: &AiServiceConfig,
    client: &reqwest::Client,
    health_url: &str,
    shutdown: &mut watch::Receiver<bool>,
) -> RunOutcome {
    set_status(AI_STATUS_STARTING);
    let grace = app.job_runner.worker_terminate_grace_secs;
    let poll = app.job_runner.worker_terminate_poll_ms;

    let mut child = match spawn_child(app, ai) {
        Ok(child) => child,
        Err(error) => {
            tracing::warn!("ai_supervisor: spawn failed: {error}");
            set_status(AI_STATUS_UNHEALTHY);
            return RunOutcome::Restart;
        }
    };
    tracing::info!(
        "ai_supervisor: spawned `{} {}` (pid {:?})",
        ai.command,
        ai.args.join(" "),
        child.id()
    );

    // —— 就绪等待 ——
    let deadline = tokio::time::Instant::now() + ai.startup_timeout;
    loop {
        if *shutdown.borrow() {
            terminate_child(&mut child, grace, poll).await;
            return RunOutcome::Shutdown;
        }
        if let Ok(Some(status)) = child.try_wait() {
            tracing::warn!("ai_supervisor: exited during startup: {status}");
            set_status(AI_STATUS_UNHEALTHY);
            return RunOutcome::Restart;
        }
        if probe(client, health_url).await {
            break;
        }
        if tokio::time::Instant::now() >= deadline {
            tracing::warn!("ai_supervisor: readyz not ready within startup timeout");
            set_status(AI_STATUS_UNHEALTHY);
            terminate_child(&mut child, grace, poll).await;
            return RunOutcome::Restart;
        }
        if sleep_or_shutdown(Duration::from_millis(250), shutdown).await {
            terminate_child(&mut child, grace, poll).await;
            return RunOutcome::Shutdown;
        }
    }
    set_status(AI_STATUS_HEALTHY);
    tracing::info!("ai_supervisor: healthy at {health_url}");

    // —— 看护循环 ——
    let mut consecutive_failures: u32 = 0;
    loop {
        if sleep_or_shutdown(ai.health_interval, shutdown).await {
            terminate_child(&mut child, grace, poll).await;
            return RunOutcome::Shutdown;
        }
        if let Ok(Some(status)) = child.try_wait() {
            tracing::warn!("ai_supervisor: process exited: {status}");
            set_status(AI_STATUS_UNHEALTHY);
            return RunOutcome::Restart;
        }
        if probe(client, health_url).await {
            if consecutive_failures > 0 {
                tracing::info!("ai_supervisor: health recovered");
            }
            consecutive_failures = 0;
            set_status(AI_STATUS_HEALTHY);
            continue;
        }
        consecutive_failures += 1;
        tracing::warn!(
            "ai_supervisor: health probe failed ({consecutive_failures}/{})",
            ai.health_fail_threshold
        );
        if consecutive_failures >= ai.health_fail_threshold {
            set_status(AI_STATUS_UNHEALTHY);
            terminate_child(&mut child, grace, poll).await;
            return RunOutcome::Restart;
        }
    }
}

/// 启动监督循环。返回 None 表示未开启（Disabled，行为与历史一致）。
pub fn spawn_ai_supervisor(
    app: std::sync::Arc<AppConfig>,
    shutdown: watch::Receiver<bool>,
) -> Option<JoinHandle<()>> {
    let ai = app.ai_service.clone();
    if !ai.supervise {
        return None;
    }
    set_status(AI_STATUS_STARTING);
    Some(tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .connect_timeout(ai.health_probe_connect_timeout)
            .timeout(ai.health_probe_timeout)
            .build()
            .expect("build ai supervisor client");
        let health_url = ai.health_url();
        let mut shutdown = shutdown;
        let mut backoff = ai.backoff_initial;
        loop {
            let healthy_before = ai_service_status() == AI_STATUS_HEALTHY;
            match run_once(&app, &ai, &client, &health_url, &mut shutdown).await {
                RunOutcome::Shutdown => break,
                RunOutcome::Restart => {
                    // 上一轮健康运行过 → 退避复位；连续失败 → 指数增长
                    backoff = if healthy_before {
                        ai.backoff_initial
                    } else {
                        (backoff * 2).min(ai.backoff_max)
                    };
                    tracing::info!("ai_supervisor: restarting in {backoff:?}");
                    if sleep_or_shutdown(backoff, &mut shutdown).await {
                        break;
                    }
                }
            }
        }
        set_status(AI_STATUS_DISABLED);
        tracing::info!("ai_supervisor: stopped");
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 集成:永不健康的子进程 → 启动超时 → 退避重启循环;shutdown 后
    /// 监督任务干净退出(不悬挂)且状态复位。不监听端口,探活全失败,稳定。
    #[tokio::test]
    async fn supervisor_restarts_on_startup_timeout_and_exits_on_shutdown() {
        let mut app = crate::config::AppConfig::from_desktop(
            std::env::temp_dir().join("ai-sup-test-res"),
            std::env::temp_dir().join("ai-sup-test-data"),
            "python3".to_string(),
            0,
            1,
            "k".to_string(),
        )
        .expect("test config");
        app.ai_service = AiServiceConfig {
            supervise: true,
            command: "/bin/sh".to_string(),
            args: vec!["-c".to_string(), "sleep 30".to_string()],
            cwd: None,
            bind_host: "127.0.0.1".to_string(),
            port: 1, // 无人监听,探活必失败
            startup_timeout: std::time::Duration::from_millis(300),
            health_interval: std::time::Duration::from_millis(50),
            health_fail_threshold: 1,
            backoff_initial: std::time::Duration::from_millis(50),
            backoff_max: std::time::Duration::from_millis(100),
            health_probe_connect_timeout: std::time::Duration::from_secs(1),
            health_probe_timeout: std::time::Duration::from_secs(2),
        };
        let (tx, rx) = tokio::sync::watch::channel(false);
        let handle = spawn_ai_supervisor(std::sync::Arc::new(app), rx).expect("supervise enabled");

        // 跑过至少一轮 启动超时→重启:状态应停在 starting/unhealthy,绝不 healthy
        tokio::time::sleep(std::time::Duration::from_millis(900)).await;
        assert_ne!(ai_service_status(), AI_STATUS_HEALTHY);
        assert_ne!(ai_service_status(), AI_STATUS_DISABLED, "监督应在运行中");

        let _ = tx.send(true);
        tokio::time::timeout(std::time::Duration::from_secs(10), handle)
            .await
            .expect("supervisor must exit promptly on shutdown")
            .expect("supervisor task join");
        assert_eq!(ai_service_status(), AI_STATUS_DISABLED, "退出后状态复位");
    }

    #[test]
    fn status_labels_cover_all_states() {
        set_status(AI_STATUS_DISABLED);
        assert_eq!(ai_service_status_label(), "unsupervised");
        set_status(AI_STATUS_STARTING);
        assert_eq!(ai_service_status_label(), "starting");
        set_status(AI_STATUS_HEALTHY);
        assert_eq!(ai_service_status_label(), "healthy");
        set_status(AI_STATUS_UNHEALTHY);
        assert_eq!(ai_service_status_label(), "unhealthy");
        set_status(AI_STATUS_DISABLED);
    }
}
