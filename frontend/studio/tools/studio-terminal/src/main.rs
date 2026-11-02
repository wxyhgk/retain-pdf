//! The Studio's terminal.
//!
//! The dev server starts this program and talks to it over stdin/stdout:
//!
//! - stdout, first line: `{"port":N}`, the loopback port it listens on;
//! - stdin, one line per terminal the page may open:
//!   `{"ticket":"…","cwd":"/abs/dir","env":{"K":"V"}}`;
//!   each is answered on stdout with `{"granted":"…"}` once it can be used;
//! - stdin closing means the dev server is gone: the program exits, and the
//!   shells it started lose their terminal and are hung up.
//!
//! The page connects to `ws://127.0.0.1:N/pty?ticket=…`. A ticket works once,
//! for 60 seconds, and only from a page served by localhost. Over the socket,
//! binary messages are terminal bytes both ways; text messages are JSON
//! controls: `{"type":"resize","cols":C,"rows":R}` from the page, and
//! `{"type":"exit","code":N}` to it when the shell ends.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use tokio::io::{AsyncBufReadExt, BufReader};

const TICKET_LIFETIME: Duration = Duration::from_secs(60);

#[derive(Deserialize)]
struct Grant {
    ticket: String,
    cwd: String,
    #[serde(default)]
    env: HashMap<String, String>,
}

struct Ticket {
    cwd: String,
    env: HashMap<String, String>,
    expires: Instant,
}

#[derive(Clone)]
struct AppState {
    port: u16,
    tickets: Arc<Mutex<HashMap<String, Ticket>>>,
}

#[derive(Deserialize)]
struct Connect {
    ticket: String,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Control {
    Resize { cols: u16, rows: u16 },
}

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("cannot listen on 127.0.0.1");
    let port = listener.local_addr().expect("no local address").port();
    let state = AppState {
        port,
        tickets: Arc::default(),
    };
    tokio::spawn(read_grants(state.tickets.clone()));
    say(&format!("{{\"port\":{port}}}"));

    let app = Router::new().route("/pty", get(connect)).with_state(state);
    axum::serve(listener, app).await.expect("server stopped");
}

fn say(line: &str) {
    let mut stdout = std::io::stdout().lock();
    let _ = writeln!(stdout, "{line}");
    let _ = stdout.flush();
}

/// Tickets from the dev server, until it goes away.
async fn read_grants(tickets: Arc<Mutex<HashMap<String, Ticket>>>) {
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let Ok(grant) = serde_json::from_str::<Grant>(&line) else {
            continue;
        };
        let mut tickets = tickets.lock().unwrap();
        let now = Instant::now();
        tickets.retain(|_, ticket| ticket.expires > now);
        tickets.insert(
            grant.ticket.clone(),
            Ticket {
                cwd: grant.cwd,
                env: grant.env,
                expires: now + TICKET_LIFETIME,
            },
        );
        drop(tickets);
        say(&serde_json::json!({ "granted": grant.ticket }).to_string());
    }
    std::process::exit(0);
}

async fn connect(
    State(state): State<AppState>,
    Query(query): Query<Connect>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Response {
    let header = |name: &str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
    };
    // The Host check stops a site that points its own name at 127.0.0.1 (DNS rebinding).
    if header("host") != format!("127.0.0.1:{}", state.port) || !is_local_origin(header("origin")) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let ticket = state.tickets.lock().unwrap().remove(&query.ticket);
    match ticket {
        Some(ticket) if ticket.expires > Instant::now() => {
            upgrade.on_upgrade(move |socket| async move {
                if let Err(error) = run_shell(socket, ticket).await {
                    eprintln!("studio-terminal: {error}");
                }
            })
        }
        _ => StatusCode::FORBIDDEN.into_response(),
    }
}

/// `http(s)://localhost`, `127.0.0.1` or `[::1]`, with or without a port.
fn is_local_origin(origin: &str) -> bool {
    let Some(rest) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    let port = ["localhost", "127.0.0.1", "[::1]"]
        .iter()
        .find_map(|host| rest.strip_prefix(host));
    match port {
        Some("") => true,
        Some(port) => port
            .strip_prefix(':')
            .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit())),
        None => false,
    }
}

type Failure = Box<dyn std::error::Error + Send + Sync>;

async fn run_shell(socket: WebSocket, ticket: Ticket) -> Result<(), Failure> {
    let pty = native_pty_system().openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut command = CommandBuilder::new(&shell);
    command.arg("-l");
    command.cwd(&ticket.cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    for (key, value) in &ticket.env {
        command.env(key, value);
    }
    let mut child = pty.slave.spawn_command(command)?;
    drop(pty.slave);
    let shell_group = child.process_id();
    let master: Arc<Mutex<Box<dyn MasterPty + Send>>> = Arc::new(Mutex::new(pty.master));

    // The PTY is read and written on threads of their own: both block.
    let mut reader = master.lock().unwrap().try_clone_reader()?;
    let (output_tx, mut output) = tokio::sync::mpsc::channel::<Vec<u8>>(64);
    std::thread::spawn(move || {
        let mut buffer = [0u8; 16 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if output_tx.blocking_send(buffer[..n].to_vec()).is_err() {
                        break;
                    }
                }
            }
        }
    });
    let mut writer = master.lock().unwrap().take_writer()?;
    let (input, input_rx) = std::sync::mpsc::channel::<Vec<u8>>();
    std::thread::spawn(move || {
        for bytes in input_rx {
            if writer
                .write_all(&bytes)
                .and_then(|()| writer.flush())
                .is_err()
            {
                break;
            }
        }
    });

    let (mut sink, mut stream) = socket.split();
    let mut page_left = false;
    loop {
        tokio::select! {
            bytes = output.recv() => match bytes {
                Some(bytes) => {
                    if sink.send(Message::Binary(bytes.into())).await.is_err() {
                        page_left = true;
                        break;
                    }
                }
                // The shell closed its terminal: it has exited.
                None => break,
            },
            message = stream.next() => match message {
                Some(Ok(Message::Binary(bytes))) => {
                    let _ = input.send(bytes.to_vec());
                }
                Some(Ok(Message::Text(text))) => {
                    if let Ok(Control::Resize { cols, rows }) = serde_json::from_str::<Control>(&text) {
                        let size = PtySize { rows: rows.max(1), cols: cols.max(1), pixel_width: 0, pixel_height: 0 };
                        let _ = master.lock().unwrap().resize(size);
                    }
                }
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => {
                    page_left = true;
                    break;
                }
                Some(Ok(_)) => {}
            },
        }
    }

    if page_left {
        // Hang up the shell and everything it started, as closing a terminal window does.
        if let Some(pid) = shell_group {
            unsafe { libc::killpg(pid as libc::pid_t, libc::SIGHUP) };
        }
        drop(master);
        let _ = tokio::task::spawn_blocking(move || {
            std::thread::sleep(Duration::from_secs(2));
            if matches!(child.try_wait(), Ok(None)) {
                let _ = child.kill();
            }
            let _ = child.wait();
        })
        .await;
    } else {
        let status = tokio::task::spawn_blocking(move || child.wait()).await??;
        let exit = serde_json::json!({ "type": "exit", "code": status.exit_code() }).to_string();
        let _ = sink.send(Message::Text(exit.into())).await;
        let _ = sink.close().await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_local_origin;

    #[test]
    fn only_local_pages_may_connect() {
        for origin in [
            "http://localhost:4321",
            "http://127.0.0.1:4400",
            "http://[::1]:4321",
            "https://localhost",
        ] {
            assert!(is_local_origin(origin), "{origin}");
        }
        for origin in [
            "",
            "null",
            "http://localhost.evil.example",
            "http://localhost:4321.evil.example",
            "http://127.0.0.1.nip.io:4321",
            "http://evil.example",
            "file://",
            "http://localhost:",
        ] {
            assert!(!is_local_origin(origin), "{origin}");
        }
    }
}
