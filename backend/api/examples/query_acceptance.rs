//! Isolated HTTP acceptance fixture. No provider/worker is started.
//! Usage: cargo run -p retainpdf-api --example query_acceptance -- <empty-temp-dir> [port]
//! Fixture controls: <fixture-runtime> --resume-ui | --terminal
use std::{
    fs,
    io::{BufWriter, Write},
    path::PathBuf,
    sync::Arc,
};

use anyhow::{ensure, Context, Result};
use chrono::{Duration, Utc};
use rusqlite::{params, Connection};
use retainpdf_api::{
    build_app, build_state,
    config::AppConfig,
    db::Db,
    models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind, WorkflowKind},
    AppState,
};
use serde_json::json;

fn seed_job(state: &AppState, id: &str, count: i64) -> Result<()> {
    let root = state.config.output_root.join(id);
    fs::create_dir_all(root.join("logs"))?;
    let mut job = JobSnapshot::new(
        id.into(),
        CreateJobInput {
            workflow: WorkflowKind::Book,
            ..Default::default()
        },
        vec![],
    );
    job.status = JobStatusKind::Running;
    job.started_at = Some(Utc::now().to_rfc3339());
    job.stage = Some("translating".into());
    job.stage_detail = Some("隔离验收：翻译进度".into());
    job.progress_current = Some(count);
    job.progress_total = Some(count + 100);
    job.artifacts = Some(JobArtifacts {
        job_root: Some(root.to_string_lossy().into_owned()),
        ..Default::default()
    });
    state.db.save_job(&job)?;
    let mut conn = Connection::open(&state.config.jobs_db_path)?;
    let tx = conn.transaction()?;
    let mut file = BufWriter::new(fs::File::create(root.join("logs/pipeline_events.jsonl"))?);
    let start = Utc::now() - Duration::seconds(count + 60);
    {
        let mut insert = tx.prepare("INSERT INTO events(job_id,seq,ts,level,stage,stage_detail,event,message,progress_current,progress_total) VALUES(?1,?2,?3,'info','translating',?4,'stage_progress',?4,?2,?5)")?;
        for seq in 1..=count {
            let ts = (start + Duration::seconds(seq)).to_rfc3339();
            let message = format!("{id} event-{seq:06}");
            if seq % 2 == 1 {
                insert.execute(params![id, seq, ts, message, count + 100])?;
            } else {
                writeln!(
                    file,
                    "{}",
                    json!({"job_id":id,"ts":ts,"seq":seq,"stage":"translating","stage_detail":message,"level":"info","event_type":"stage_progress","message":message,"progress_current":seq,"progress_total":count+100})
                )?;
            }
        }
    }
    file.flush()?;
    tx.commit()?;
    Ok(())
}

fn seed_library(state: &AppState) -> Result<()> {
    let mut conn = Connection::open(&state.config.jobs_db_path)?;
    let tx = conn.transaction()?;
    {
        let mut insert = tx.prepare("INSERT INTO jobs(job_id,workflow,status_json,created_at,updated_at,command_json,request_json,stage,stage_detail,log_tail_json) SELECT ?1,workflow,'\"failed\"',created_at,?2,command_json,request_json,'failed',?3,'[]' FROM jobs WHERE job_id='acceptance-ui'")?;
        for n in 0..12_001 {
            let id = format!("acceptance-library-{n:05}");
            insert.execute(params![
                id,
                format!("2025-01-01T00:{:02}:{:02}Z", n / 60 % 60, n % 60),
                if n == 0 {
                    "acceptance-needle-beyond-10000"
                } else {
                    "synthetic library fixture"
                }
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

fn set_ui_status(root: &std::path::Path, terminal: bool) -> Result<()> {
    ensure!(
        root.file_name().and_then(|name| name.to_str()) == Some("runtime")
            && root
                .parent()
                .and_then(|parent| parent.file_name())
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("retain-api-acceptance.")),
        "not an acceptance fixture"
    );
    let path = root.join("data/db/jobs.db");
    ensure!(path.is_file(), "fixture database missing");
    let db = Db::new(path, root.join("data"));
    let mut job = db.get_job("acceptance-ui")?;
    let now = Utc::now().to_rfc3339();
    job.status = if terminal {
        JobStatusKind::Succeeded
    } else {
        JobStatusKind::Running
    };
    job.updated_at = now.clone();
    job.finished_at = terminal.then_some(now);
    job.stage = Some(if terminal { "finished" } else { "translating" }.into());
    // Use the real write path: runtime.terminal_reason is "succeeded", not a
    // fabricated "done" signal or PDF artifact that could mask client bugs.
    db.save_job(&job)?;
    if terminal {
        db.append_event(
            "acceptance-ui",
            "info",
            Some("finished".into()),
            None,
            None,
            None,
            "job_succeeded",
            None,
            "browser-terminal-event",
            None,
            None,
            None,
            None,
            None,
        )?;
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let root = PathBuf::from(
        std::env::args()
            .nth(1)
            .context("pass an empty temporary directory")?,
    )
    .canonicalize()?;
    let action = std::env::args().nth(2);
    if matches!(action.as_deref(), Some("--terminal" | "--resume-ui")) {
        return set_ui_status(&root, action.as_deref() == Some("--terminal"));
    }
    ensure!(
        fs::read_dir(&root)?.next().is_none(),
        "fixture directory must be empty; refusing to alter existing data"
    );
    let port: u16 = action.unwrap_or_else(|| "42831".into()).parse()?;
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
    let mut config = AppConfig::from_desktop(
        root.join("resources"),
        root.join("data"),
        "/usr/bin/false".into(),
        port,
        0,
        "local-acceptance-only".into(),
    )?;
    config.jobs_service = Default::default();
    let state = build_state(Arc::new(config))?;
    for (id, count) in [
        ("acceptance-ui", 1200),
        ("acceptance-1k", 1000),
        ("acceptance-10k", 10_000),
        ("acceptance-100k", 100_000),
        ("acceptance-concurrent", 1000),
    ] {
        seed_job(&state, id, count)?;
    }
    seed_library(&state)?;
    println!(
        "READY http://127.0.0.1:{port}; pid={}; synthetic_data={}",
        std::process::id(),
        root.display()
    );
    axum::serve(listener, build_app(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
