//! The Studio as a Mac app.
//!
//! It shows the blog's dev server's `/studio` in a window. While `astro dev` runs it writes
//! `.astro/dev.json` (its pid and address); when that names a live server the app uses it and
//! leaves it alone. Otherwise the app runs `astro dev` itself and the server lives as long as the
//! app does: its stdin is a pipe from the app, and when that closes (the app quits, or crashes)
//! the server stops. Its output goes to `.astro/dev.log`, where `astro dev --background` keeps it.
//!
//! An app opened from the Finder gets almost no PATH, so the server is started with the
//! environment of a login shell: it finds node and cargo, and the Studio's terminal gets the
//! programs the author has in their own terminal.
//!
//! Which blog: `STUDIO_REPO` when the app runs, or the one it was built for (build.sh).

mod dialogs;

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::{env, fs, thread};

use serde::Deserialize;
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// What `astro dev` keeps in `.astro/dev.json` while it runs.
#[derive(Deserialize)]
struct DevServer {
    pid: i32,
    url: String,
}

#[derive(Default)]
struct State {
    /// What the start page shows: (message, is it an error).
    status: Mutex<(String, bool)>,
    /// The server the app started; it stops with the app.
    started: Mutex<Option<Child>>,
    /// Where the last download is going (on macOS the finished event doesn't say).
    download: Mutex<Option<PathBuf>>,
}

fn main() {
    let app = tauri::Builder::default()
        .manage(State::default())
        .setup(|app| {
            let window = open_window(app.handle())?;
            window.with_webview(|webview| unsafe { dialogs::install(webview.inner()) })?;
            let handle = app.handle().clone();
            thread::spawn(move || match find_or_start(&handle) {
                Ok(url) => {
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.navigate(url);
                    }
                }
                Err(message) => show(&handle, &message, true),
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("the Studio app could not start");
    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_started(handle);
        }
    });
}

fn open_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let studio_open = AtomicBool::new(false);
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Studio")
        .inner_size(1440.0, 900.0)
        .min_inner_size(820.0, 560.0)
        // Files dropped on the page go to the page (pictures into articles, files into the file list).
        .disable_drag_drop_handler()
        .on_navigation(move |url| {
            // Once the Studio is open, the start page is not gone back to (⌫ and the like are "back" in
            // WebKit): it would only say 正在打开 Studio… for good.
            if url.scheme() == "tauri" {
                return !studio_open.load(Ordering::Relaxed);
            }
            if is_local(url) {
                studio_open.store(true, Ordering::Relaxed);
                return true;
            }
            let ours = matches!(url.scheme(), "about" | "blob" | "data");
            if !ours {
                open_outside(url.as_str());
            }
            ours
        })
        // `target="_blank"` and `window.open`: the blog, a file, a web page — the browser shows them.
        .on_new_window(|url, _| {
            open_outside(url.as_str());
            NewWindowResponse::Deny
        })
        .on_download(|webview, event| {
            let state = webview.state::<State>();
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let name = destination
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .filter(|name| !name.is_empty())
                        .or_else(|| {
                            url.path_segments()
                                .and_then(|mut parts| parts.next_back())
                                .map(str::to_owned)
                        })
                        .unwrap_or_else(|| "download".into());
                    let place = free_name(&downloads(), &name);
                    *destination = place.clone();
                    *state.download.lock().unwrap() = Some(place);
                }
                DownloadEvent::Finished { success, .. } => {
                    if let (true, Some(place)) = (success, state.download.lock().unwrap().take()) {
                        let _ = Command::new("/usr/bin/open").arg("-R").arg(place).spawn();
                    }
                }
                _ => {}
            }
            true
        })
        // The start page asks for nothing: whenever it (re)loads it is told where things are.
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished && payload.url().scheme() == "tauri" {
                let (message, error) = window.state::<State>().status.lock().unwrap().clone();
                tell(&window, &message, error);
            }
        })
        .build()
}

/// Shows `message` on the start page.
fn show(app: &AppHandle, message: &str, error: bool) {
    *app.state::<State>().status.lock().unwrap() = (message.to_owned(), error);
    if let Some(window) = app.get_webview_window("main") {
        tell(&window, message, error);
    }
}

fn tell(window: &WebviewWindow, message: &str, error: bool) {
    let _ = window.eval(format!(
        "window.studioStatus?.({}, {error})",
        serde_json::to_string(message).unwrap()
    ));
}

/// The Studio's address: the running server's, or one started for the blog.
fn find_or_start(app: &AppHandle) -> Result<Url, String> {
    let repo = blog().ok_or("找不到博客的文件夹。在博客里运行 tools/studio-app/build.sh 重新生成这个应用，或者用 STUDIO_REPO 指明文件夹。")?;
    let server = match running(&repo) {
        Some(server) => server,
        None => {
            show(app, "正在启动服务器…", false);
            start(app, &repo)?
        }
    };
    let url = Url::parse(&server.url)
        .and_then(|url| url.join("studio"))
        .map_err(|error| format!("服务器的地址不对：{error}"))?;
    show(app, "正在打开 Studio…", false);
    wait_for(&url, Duration::from_secs(60))?;
    Ok(url)
}

fn blog() -> Option<PathBuf> {
    env::var_os("STUDIO_REPO")
        .map(PathBuf::from)
        .or_else(|| option_env!("STUDIO_REPO").map(PathBuf::from))
        .filter(|repo| repo.join("astro.config.mjs").is_file())
}

/// The blog's dev server, if one is running.
fn running(repo: &Path) -> Option<DevServer> {
    let server: DevServer =
        serde_json::from_str(&fs::read_to_string(repo.join(".astro/dev.json")).ok()?).ok()?;
    (unsafe { libc::kill(server.pid, 0) } == 0).then_some(server)
}

/// The server's lifeline: when its stdin (a pipe from the app) closes, it removes its lock file and
/// stops. Run in the blog's folder, where the lock file is.
const LIFELINE: &str = "data:text/javascript,import{readFileSync,rmSync}from'node:fs';process.stdin.on('end',()=>{try{if(JSON.parse(readFileSync('.astro/dev.json','utf8')).pid===process.pid)rmSync('.astro/dev.json')}catch{}process.kill(process.pid,'SIGTERM')}).resume()";

fn start(app: &AppHandle, repo: &Path) -> Result<DevServer, String> {
    let env = login_env();
    let node = which("node", env.get("PATH").map_or("", String::as_str))
        .ok_or("找不到 node。在终端里装好 node（node --version 能用）以后再打开。")?;
    let log_path = repo.join(".astro/dev.log");
    let _ = fs::create_dir_all(repo.join(".astro"));
    let log = File::create(&log_path).map_err(|error| format!("没能写 .astro/dev.log：{error}"))?;
    let mut child = Command::new(node)
        .args([
            "--import",
            LIFELINE,
            "node_modules/astro/bin/astro.mjs",
            "dev",
        ])
        .current_dir(repo)
        .env_clear()
        .envs(&env)
        // Keeps astro from going into the background by itself when it thinks an AI agent ran it (then
        // it would outlive the app); the lock file then says "background", so `astro dev stop` and
        // `astro dev logs` work on it too.
        .env("ASTRO_DEV_BACKGROUND", "1")
        .stdin(Stdio::piped())
        .stdout(log.try_clone().map_err(|error| error.to_string())?)
        .stderr(log)
        .spawn()
        .map_err(|error| format!("没能启动服务器：{error}"))?;
    let deadline = Instant::now() + Duration::from_secs(90);
    loop {
        if let Some(server) = running(repo).filter(|server| server.pid == child.id() as i32) {
            *app.state::<State>().started.lock().unwrap() = Some(child);
            return Ok(server);
        }
        let ended = child.try_wait().ok().flatten().is_some();
        if ended || Instant::now() > deadline {
            let _ = child.kill();
            let said = fs::read_to_string(&log_path).unwrap_or_default();
            let tail: Vec<&str> = said.lines().rev().take(12).collect();
            return Err(format!(
                "服务器没能启动。它最后说：\n{}\n\n完整记录在博客的 .astro/dev.log。",
                tail.into_iter().rev().collect::<Vec<_>>().join("\n")
            ));
        }
        thread::sleep(Duration::from_millis(200));
    }
}

/// The environment the author's terminal has: a login, interactive shell's.
fn login_env() -> HashMap<String, String> {
    const MARK: &str = "\0studio-env\0";
    let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let said = Command::new(&shell)
        .args(["-lic", r"printf '\0studio-env\0'; env -0"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()
        .and_then(|mut child| {
            let mut out = child.stdout.take()?;
            let reader = thread::spawn(move || {
                let mut bytes = Vec::new();
                let _ = out.read_to_end(&mut bytes);
                bytes
            });
            let deadline = Instant::now() + Duration::from_secs(15);
            while child.try_wait().ok()?.is_none() {
                if Instant::now() > deadline {
                    let _ = child.kill();
                    return None;
                }
                thread::sleep(Duration::from_millis(50));
            }
            reader.join().ok()
        });
    let found: HashMap<String, String> = said
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .and_then(|text| text.split_once(MARK).map(|(_, env)| env.to_owned()))
        .map(|env| {
            env.split('\0')
                .filter_map(|pair| pair.split_once('='))
                .map(|(k, v)| (k.to_owned(), v.to_owned()))
                .collect()
        })
        .unwrap_or_default();
    if found.contains_key("PATH") {
        return found;
    }
    // The shell didn't answer: this process's environment, with the usual places added.
    let mut env: HashMap<String, String> = env::vars().collect();
    let home = env.get("HOME").cloned().unwrap_or_default();
    let usual = [
        format!("{home}/.local/bin"),
        format!("{home}/.cargo/bin"),
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
    ];
    let path = env.get("PATH").cloned().unwrap_or_default();
    env.insert("PATH".into(), format!("{}:{path}", usual.join(":")));
    env
}

fn which(program: &str, path: &str) -> Option<PathBuf> {
    env::split_paths(path)
        .map(|dir| dir.join(program))
        .find(|file| file.is_file())
}

/// Waits until the server takes connections.
fn wait_for(url: &Url, patience: Duration) -> Result<(), String> {
    let host = url
        .host_str()
        .unwrap_or("localhost")
        .trim_matches(['[', ']']);
    let port = url.port_or_known_default().unwrap_or(80);
    let deadline = Instant::now() + patience;
    loop {
        let reached = (host, port)
            .to_socket_addrs()
            .map(|mut addresses| {
                addresses.any(|address| {
                    TcpStream::connect_timeout(&address, Duration::from_millis(500)).is_ok()
                })
            })
            .unwrap_or(false);
        if reached {
            return Ok(());
        }
        if Instant::now() > deadline {
            return Err(format!("服务器（{url}）一直没有回应。"));
        }
        thread::sleep(Duration::from_millis(200));
    }
}

/// Stops the server the app started (closing its lifeline) and waits a little for it to tidy up.
fn stop_started(app: &AppHandle) {
    let Some(mut child) = app.state::<State>().started.lock().unwrap().take() else {
        return;
    };
    drop(child.stdin.take());
    let deadline = Instant::now() + Duration::from_secs(5);
    while child.try_wait().ok().flatten().is_none() {
        if Instant::now() > deadline {
            let _ = child.kill();
            break;
        }
        thread::sleep(Duration::from_millis(50));
    }
}

fn is_local(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "ws")
        && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
}

fn open_outside(url: &str) {
    let _ = Command::new("/usr/bin/open").arg(url).spawn();
}

fn downloads() -> PathBuf {
    PathBuf::from(env::var("HOME").unwrap_or_default()).join("Downloads")
}

/// `name` in `dir`, or `name (2)` and so on when that is taken.
fn free_name(dir: &Path, name: &str) -> PathBuf {
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .map_or(name.into(), |stem| stem.to_string_lossy().into_owned());
    let ext = path
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();
    (1..)
        .map(|n| {
            dir.join(if n == 1 {
                name.to_owned()
            } else {
                format!("{stem} ({n}){ext}")
            })
        })
        .find(|place| !place.exists())
        .unwrap()
}
