//! The Studio as a Mac app.
//!
//! It shows the Studio's server's `/studio` in a window: the Studio's own (`src/studio/serve.mjs`, not the blog's
//! `astro dev`). While it runs it writes `.studio-cache/server.json` (its pid and address); when that names a live
//! server the app uses it and leaves it alone. Otherwise the app runs it itself and the server lives as long as the
//! app does: its stdin is a pipe from the app, and when that closes (the app quits, or crashes) the server stops. Its
//! output goes to `.studio-cache/server.log`. When that server ends with the app still open, the app writes how it
//! ended (the signal or the exit code, and what was running then) to `.studio-cache/server-exits.log` and starts it
//! again; the log of the run before is kept as `.studio-cache/server.previous.log`. A version of the blog from before
//! the Studio had a server of its own (the last good version may be one) is run as it was: `astro dev`, its files in
//! `.astro/` (`ServerFiles`).
//!
//! A Studio that does not finish starting (its own code broken by an edit: the server does not start, or its page never
//! says it has started) is offered as it was last time it started (`.studio-cache/last-good.json`, kept by the server):
//! that commit checked out in `.studio-cache/rescue`, the articles and the rest linked to the real ones, run in safe mode.
//!
//! An app opened from the Finder gets almost no PATH, so the server is started with the
//! environment of a login shell: it finds node and cargo, and the Studio's terminal gets the
//! programs the author has in their own terminal.
//!
//! Which Studio: `STUDIO_REPO` when the app runs, or the one it was built for (build.sh); the notes are the ones its
//! `.studio-local.json` names.
//!
//! Its windows open where they were left, as large as they were (`windows.json` in the app's own folder, Application
//! Support/blog.studio.app), on a screen still there. Shutting the Studio's window hides it, as a Mac app's: the server
//! stays, and the app's icon in the Dock shows it again at once; ⌘Q quits.

mod dialogs;

use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use std::{env, fs, thread};

use serde::{Deserialize, Serialize};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent};

/// What a running server keeps in its lock file (`ServerFiles::lock`).
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
    /// When the server the app started ended by itself: it is started again, not over and over.
    ended: Mutex<Vec<Instant>>,
    /// Where the last download is going (on macOS the finished event doesn't say).
    download: Mutex<Option<PathBuf>>,
    /// What the start page offers besides its message: `rescue` (the last good version), `wait` (the Studio again).
    choices: Mutex<Vec<&'static str>>,
    /// The Studio's page is shown: the start page is not gone back to (but when the app shows it, choices on it).
    studio_open: AtomicBool,
    /// The Studio running is the last good version (its server, if it ends, started again so).
    rescuing: AtomicBool,
    /// The Studio's address, to go back to (再等等).
    studio_url: Mutex<Option<Url>>,
    /// Where each window is (by its label), as it moves; written to `windows.json` as it is shut or the app quits.
    places: Mutex<HashMap<String, Place>>,
}

/// Where a window is and how large, in points (as the screen's settings show them); and whether it fills the screen.
#[derive(Serialize, Deserialize, Clone, Copy)]
struct Place {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    #[serde(default)]
    maximized: bool,
}

fn main() {
    let app = tauri::Builder::default()
        .manage(State::default())
        .setup(|app| {
            let window = open_window(app.handle())?;
            window.with_webview(|webview| unsafe { dialogs::install(webview.inner()) })?;
            let handle = app.handle().clone();
            thread::spawn(move || match find_or_start(&handle) {
                Ok(url) => open_studio(&handle, url),
                Err(message) => offer_rescue(&handle, &message),
            });
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => note_place(window),
            // The Studio's window shut: hidden, as a Mac app's (the server stays; the Dock's icon shows it again).
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                write_places(window.app_handle());
                let _ = window.hide();
            }
            WindowEvent::Destroyed => write_places(window.app_handle()),
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("the Studio app could not start");
    app.run(|handle, event| match event {
        RunEvent::Exit => {
            write_places(handle);
            stop_started(handle);
        }
        // The app's icon clicked (or the app opened again) with its window hidden: shown again.
        RunEvent::Reopen { .. } => {
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
        _ => {}
    });
}

/// Where the windows' places are kept: in the app's own folder (Application Support/blog.studio.app).
fn places_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|folder| folder.join("windows.json"))
}

fn read_places(app: &AppHandle) -> HashMap<String, Place> {
    places_file(app)
        .and_then(|file| fs::read_to_string(file).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

/// Where `window` is now, noted (written as it is shut, or the app quits). Filling the screen, where it was before is kept.
fn note_place(window: &Window) {
    let (Ok(scale), Ok(position), Ok(size)) = (window.scale_factor(), window.outer_position(), window.inner_size()) else {
        return;
    };
    let maximized = window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false);
    let state = window.state::<State>();
    let mut places = state.places.lock().unwrap();
    let was = places.get(window.label()).copied();
    let place = match (maximized, was) {
        (true, Some(was)) => Place { maximized: true, ..was },
        _ => Place {
            x: f64::from(position.x) / scale,
            y: f64::from(position.y) / scale,
            width: f64::from(size.width) / scale,
            height: f64::from(size.height) / scale,
            maximized,
        },
    };
    // Hidden, or shrunk to the Dock: not a place.
    if window.is_visible().unwrap_or(true) && !window.is_minimized().unwrap_or(false) {
        places.insert(window.label().to_owned(), place);
    }
}

/// The places noted, written over those kept (a window not opened this time keeps its own).
fn write_places(app: &AppHandle) {
    let Some(file) = places_file(app) else { return };
    let mut places = read_places(app);
    places.extend(app.state::<State>().places.lock().unwrap().iter().map(|(label, place)| (label.clone(), *place)));
    if let Some(folder) = file.parent() {
        let _ = fs::create_dir_all(folder);
    }
    if let Ok(text) = serde_json::to_string_pretty(&places) {
        let _ = fs::write(file, text);
    }
}

/// Where the window `label` was left, if a screen there now shows enough of it (a screen unplugged since: none).
fn place_of(app: &AppHandle, label: &str) -> Option<Place> {
    let place = *read_places(app).get(label)?;
    let shown = app.available_monitors().ok()?.iter().any(|monitor| {
        let scale = monitor.scale_factor();
        let (left, top) = (f64::from(monitor.position().x) / scale, f64::from(monitor.position().y) / scale);
        let (width, height) = (f64::from(monitor.size().width) / scale, f64::from(monitor.size().height) / scale);
        // Its title bar's left, on the screen: it can be dragged from there.
        place.x + 60.0 >= left && place.x + 60.0 <= left + width && place.y >= top && place.y + 20.0 <= top + height
    });
    shown.then_some(place)
}

/// A window to be made, where it was left (`place_of`), else as large as `otherwise`.
fn placed<'a>(app: &AppHandle, label: &str, builder: WebviewWindowBuilder<'a, tauri::Wry, AppHandle>, otherwise: (f64, f64)) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    match place_of(app, label) {
        Some(place) => builder.position(place.x, place.y).inner_size(place.width, place.height).maximized(place.maximized),
        None => builder.inner_size(otherwise.0, otherwise.1),
    }
}

fn open_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let handle = app.clone();
    placed(app, "main", WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into())), (1440.0, 900.0))
        .title("Studio")
        .min_inner_size(820.0, 560.0)
        // Files dropped on the page go to the page (pictures into articles, files into the file list).
        .disable_drag_drop_handler()
        .on_navigation(move |url| {
            let state = handle.state::<State>();
            // Once the Studio is open, the start page is not gone back to (⌫ and the like are "back" in
            // WebKit): it would only say 正在打开 Studio… for good.
            if url.scheme() == "tauri" {
                return !state.studio_open.load(Ordering::Relaxed);
            }
            // The start page's choices (start-page links): done here, not gone to.
            if url.scheme() == "studio-action" {
                let app = handle.clone();
                let action = url.host_str().unwrap_or_default().to_owned();
                thread::spawn(move || choose(&app, &action));
                return false;
            }
            if is_local(url) {
                state.studio_open.store(true, Ordering::Relaxed);
                return true;
            }
            // A video's player in its frame (the ```video block) loads its pages: not the Studio leaving.
            let ours = matches!(url.scheme(), "about" | "blob" | "data") || is_player(url);
            if !ours {
                open_outside(url.as_str());
            }
            ours
        })
        // `target="_blank"` and `window.open`: the blog, a file, a web page — the browser shows them; a 小程序 or the
        // AI asked into a window of its own (显示方式 › 新窗口), a window of the app's.
        .on_new_window({
            let app = app.clone();
            move |url, _| {
                if is_own_window(&url) {
                    let app = app.clone();
                    thread::spawn(move || open_own_window(&app, url));
                } else {
                    open_outside(url.as_str());
                }
                NewWindowResponse::Deny
            }
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
    let choices = window.state::<State>().choices.lock().unwrap().clone();
    let _ = window.eval(format!(
        "window.studioStatus?.({}, {error}, {})",
        serde_json::to_string(message).unwrap(),
        serde_json::to_string(&choices).unwrap()
    ));
}

/** The Studio's page in the window, and watched until it says it has started. */
fn open_studio(app: &AppHandle, url: Url) {
    *app.state::<State>().studio_url.lock().unwrap() = Some(url.clone());
    *app.state::<State>().choices.lock().unwrap() = Vec::new();
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.navigate(url.clone());
    }
    watch_start(app.clone(), url);
}

/// How long a Studio is given to finish starting (its first start after its dependencies change is the slowest).
const START_PATIENCE: Duration = Duration::from_secs(150);

/// Waits for the Studio at `url` to say it has started (its article shown); one that does not is offered as it was the
/// last time it did.
fn watch_start(app: AppHandle, url: Url) {
    thread::spawn(move || {
        let deadline = Instant::now() + START_PATIENCE;
        while Instant::now() < deadline {
            if has_started(&url) {
                return;
            }
            thread::sleep(Duration::from_secs(2));
        }
        // Gone on with since (another start, a rescue): not this one's to say.
        if app.state::<State>().studio_url.lock().unwrap().as_ref() != Some(&url) {
            return;
        }
        if let Some(window) = app.get_webview_window("main") {
            app.state::<State>().studio_open.store(false, Ordering::Relaxed);
            let _ = window.navigate(Url::parse("tauri://localhost/index.html").unwrap());
        }
        offer_rescue(&app, "Studio 打开了，但两分多钟还没有启动完：可能是它自己的代码被改坏了（看 .studio-cache/server.log 和页面上的错误）。");
    });
}

/// Whether the Studio at `url` has said it started (GET /api/studio/started).
fn has_started(url: &Url) -> bool {
    let host = url.host_str().unwrap_or("localhost").trim_matches(['[', ']']).to_owned();
    let port = url.port_or_known_default().unwrap_or(80);
    let Ok(addresses) = (host.as_str(), port).to_socket_addrs() else { return false };
    for address in addresses {
        let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(800)) else { continue };
        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
        let asked = format!("GET /api/studio/started HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n");
        if stream.write_all(asked.as_bytes()).is_err() {
            continue;
        }
        let mut answer = String::new();
        let _ = stream.read_to_string(&mut answer);
        return answer.contains("\"started\":\"");
    }
    false
}

/// What went wrong said on the start page, with the last good version offered when there is one.
fn offer_rescue(app: &AppHandle, message: &str) {
    let can = blog().and_then(|repo| last_good(&repo)).is_some();
    *app.state::<State>().choices.lock().unwrap() = if can { vec!["rescue", "wait"] } else { vec!["wait"] };
    let said = if can {
        message.to_owned()
    } else {
        format!("{message}\n\n还没有记下能正常启动的版本（Studio 正常启动过一次、它的代码都提交了以后才有），没法自动退回。")
    };
    show(app, &said, true);
}

/// A choice of the start page: `rescue` (the last good version), `wait` (the Studio again, given more time).
fn choose(app: &AppHandle, action: &str) {
    match action {
        "rescue" => match rescue(app) {
            Ok(url) => open_studio(app, url),
            Err(message) => offer_rescue(app, &message),
        },
        "wait" => {
            *app.state::<State>().choices.lock().unwrap() = Vec::new();
            let url = app.state::<State>().studio_url.lock().unwrap().clone();
            match url {
                Some(url) => open_studio(app, url),
                None => match find_or_start(app) {
                    Ok(url) => open_studio(app, url),
                    Err(message) => offer_rescue(app, &message),
                },
            }
        }
        _ => {}
    }
}

/// The commit kept as the last good version (`.studio-cache/last-good.json`), if any.
fn last_good(repo: &Path) -> Option<String> {
    let text = fs::read_to_string(repo.join(".studio-cache/last-good.json")).ok()?;
    let kept: serde_json::Value = serde_json::from_str(&text).ok()?;
    let commit = kept.get("commit")?.as_str()?.to_owned();
    (commit.len() >= 7 && commit.chars().all(|c| c.is_ascii_hexdigit())).then_some(commit)
}

/// What a rescue links to the real ones: the author's things, and what the code needs that git does not hold.
const LINKED: &[&str] = &["blog", "apps", "chats", ".studio-settings.json", ".studio-trash", ".studio-local.json", "node_modules", "third_party/milkdown"];

/// The last good version made ready in `.studio-cache/rescue` (checked out, the author's things linked in): its folder.
fn prepare_rescue(repo: &Path, commit: &str, git: &Path) -> Result<PathBuf, String> {
    let place = repo.join(".studio-cache").join("rescue");
    let run = |dir: &Path, args: &[&str]| -> Result<(), String> {
        let done = Command::new(git).arg("-C").arg(dir).args(args).output().map_err(|error| error.to_string())?;
        if done.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&done.stderr).trim().to_owned()) }
    };
    // Links first let go (never followed): git puts back what it holds there, then they are linked again.
    for name in LINKED {
        let at = place.join(name);
        if fs::symlink_metadata(&at).map(|meta| meta.file_type().is_symlink()).unwrap_or(false) {
            let _ = fs::remove_file(&at);
        }
    }
    if place.join(".git").exists() {
        run(&place, &["checkout", "--detach", "--force", commit])?;
    } else {
        let _ = run(repo, &["worktree", "prune"]);
        let _ = fs::create_dir_all(place.parent().unwrap());
        run(repo, &["worktree", "add", "--detach", "--force", &place.to_string_lossy(), commit])?;
    }
    for name in LINKED {
        let real = repo.join(name);
        if fs::symlink_metadata(&real).is_err() {
            continue;
        }
        let at = place.join(name);
        // What git checked out there (blog/, apps/: the version's copies) makes room; only ever inside the rescue.
        if at.starts_with(&place) {
            match fs::symlink_metadata(&at) {
                Ok(meta) if meta.is_dir() => fs::remove_dir_all(&at).map_err(|error| error.to_string())?,
                Ok(_) => fs::remove_file(&at).map_err(|error| error.to_string())?,
                Err(_) => {}
            }
        }
        if let Some(parent) = at.parent() {
            let _ = fs::create_dir_all(parent);
        }
        std::os::unix::fs::symlink(&real, &at).map_err(|error| format!("{name}：{error}"))?;
    }
    Ok(place)
}

/// The Studio as it was the last time it started: made ready, its server started there (safe mode), the one before
/// stopped. Its address.
fn rescue(app: &AppHandle) -> Result<Url, String> {
    let repo = blog().ok_or("找不到 Studio 的文件夹。")?;
    let commit = last_good(&repo).ok_or("还没有记下能正常启动的版本。")?;
    show(app, &format!("正在准备上次能正常启动的版本（{}）…", &commit[..7]), false);
    let env = login_env();
    let git = which("git", env.get("PATH").map_or("", String::as_str)).unwrap_or_else(|| PathBuf::from("/usr/bin/git"));
    let place = prepare_rescue(&repo, &commit, &git).map_err(|error| format!("没能准备上次的版本：{error}"))?;
    stop_started(app);
    app.state::<State>().rescuing.store(true, Ordering::Relaxed);
    show(app, "正在启动上次能正常启动的版本…", false);
    let server = start_in(app, &place, &[("STUDIO_RESCUE", "1")])?;
    let url = Url::parse(&server.url)
        .and_then(|url| url.join("studio?safe=rescue"))
        .map_err(|error| format!("服务器的地址不对：{error}"))?;
    wait_for(&url, Duration::from_secs(60))?;
    Ok(url)
}

/// The Studio's address: the running server's, or one started for the blog.
fn find_or_start(app: &AppHandle) -> Result<Url, String> {
    let repo = blog().ok_or("找不到 Studio 的文件夹。在 Studio 的仓库里运行 tools/studio-app/build.sh 重新生成这个应用，或者用 STUDIO_REPO 指明文件夹。")?;
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
        .filter(|repo| repo.join("src/studio/serve.mjs").is_file())
}

/// Where a server of a blog says it runs (its lock), and keeps what it said (its log, the one before, how it ended).
struct ServerFiles {
    /// The Studio's own server (`src/studio/serve.mjs`), or (a version from before it had one) Astro's.
    own: bool,
    lock: &'static str,
    log: &'static str,
    previous: &'static str,
    exits: &'static str,
}

fn server_files(repo: &Path) -> ServerFiles {
    if repo.join("src/studio/serve.mjs").is_file() {
        ServerFiles {
            own: true,
            lock: ".studio-cache/server.json",
            log: ".studio-cache/server.log",
            previous: ".studio-cache/server.previous.log",
            exits: ".studio-cache/server-exits.log",
        }
    } else {
        ServerFiles {
            own: false,
            lock: ".astro/dev.json",
            log: ".astro/dev.log",
            previous: ".astro/dev.previous.log",
            exits: ".astro/dev-exits.log",
        }
    }
}

/// The blog's Studio server, if one is running.
fn running(repo: &Path) -> Option<DevServer> {
    let server: DevServer =
        serde_json::from_str(&fs::read_to_string(repo.join(server_files(repo).lock)).ok()?).ok()?;
    (unsafe { libc::kill(server.pid, 0) } == 0).then_some(server)
}

/// The server's lifeline: when its stdin (a pipe from the app) closes, it removes its lock file (either kind's, the one
/// naming it) and stops. Run in the blog's folder, where the lock file is. `--import` runs it in each worker thread
/// too (pi resizes a picture it reads in one), whose stdin is no pipe and ends at once: there it does nothing, or the
/// server would stop whenever a worker starts.
const LIFELINE: &str = "data:text/javascript,import{readFileSync,rmSync}from'node:fs';import{isMainThread}from'node:worker_threads';if(isMainThread)process.stdin.on('end',()=>{for(const f of['.studio-cache/server.json','.astro/dev.json'])try{if(JSON.parse(readFileSync(f,'utf8')).pid===process.pid)rmSync(f)}catch{}process.kill(process.pid,'SIGTERM')}).resume()";

fn start(app: &AppHandle, repo: &Path) -> Result<DevServer, String> {
    start_in(app, repo, &[])
}

/// The server started in `repo` (the blog, or the last good version of it), with `extra` in its environment.
fn start_in(app: &AppHandle, repo: &Path, extra: &[(&str, &str)]) -> Result<DevServer, String> {
    let env = login_env();
    let node = which("node", env.get("PATH").map_or("", String::as_str))
        .ok_or("找不到 node。在终端里装好 node（node --version 能用）以后再打开。")?;
    let files = server_files(repo);
    let log_path = repo.join(files.log);
    if let Some(folder) = log_path.parent() {
        let _ = fs::create_dir_all(folder);
    }
    let _ = fs::rename(&log_path, repo.join(files.previous));
    let log = File::create(&log_path).map_err(|error| format!("没能写 {}：{error}", files.log))?;
    // The Studio's own server, announcing itself (its lock file); a version without one, `astro dev`.
    let program: &[&str] = if files.own {
        &["src/studio/serve.mjs"]
    } else {
        &["node_modules/astro/bin/astro.mjs", "dev"]
    };
    let mut child = Command::new(node)
        .args(["--import", LIFELINE])
        .args(program)
        .current_dir(repo)
        .env_clear()
        .envs(&env)
        // Keeps astro from going into the background by itself when it thinks an AI agent ran it (then
        // it would outlive the app); the lock file then says "background", so `astro dev stop` and
        // `astro dev logs` work on it too.
        .env("ASTRO_DEV_BACKGROUND", "1")
        .envs(extra.iter().copied())
        .stdin(Stdio::piped())
        .stdout(log.try_clone().map_err(|error| error.to_string())?)
        .stderr(log)
        .spawn()
        .map_err(|error| format!("没能启动服务器：{error}"))?;
    let deadline = Instant::now() + Duration::from_secs(90);
    loop {
        if let Some(server) = running(repo).filter(|server| server.pid == child.id() as i32) {
            *app.state::<State>().started.lock().unwrap() = Some(child);
            watch_started(app.clone(), repo.to_path_buf());
            return Ok(server);
        }
        let ended = child.try_wait().ok().flatten().is_some();
        if ended || Instant::now() > deadline {
            let _ = child.kill();
            let said = fs::read_to_string(&log_path).unwrap_or_default();
            let tail: Vec<&str> = said.lines().rev().take(12).collect();
            return Err(format!(
                "服务器没能启动。它最后说：\n{}\n\n完整记录在博客的 {}。",
                tail.into_iter().rev().collect::<Vec<_>>().join("\n"),
                files.log
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

/// Waits for the server the app started to end. When it ends with the app still open (the app
/// takes it when it quits), says how in its exits log (`ServerFiles::exits`) and starts it again: the page
/// reconnects by itself (Vite's client reloads it once the server answers).
fn watch_started(app: AppHandle, repo: PathBuf) {
    thread::spawn(move || {
        let state = app.state::<State>();
        let status = loop {
            thread::sleep(Duration::from_millis(300));
            let mut started = state.started.lock().unwrap();
            let Some(child) = started.as_mut() else {
                return;
            };
            if let Ok(Some(status)) = child.try_wait() {
                started.take();
                break status;
            }
        };
        let how = match status.signal() {
            Some(signal) => format!("被信号 {signal}（{}）结束", signal_name(signal)),
            None => format!("自己退出了，退出码 {}", status.code().unwrap_or(-1)),
        };
        note_exit(&repo, &how);
        let recent = {
            let mut ended = state.ended.lock().unwrap();
            ended.retain(|at| at.elapsed() < Duration::from_secs(120));
            ended.push(Instant::now());
            ended.len()
        };
        if recent > 3 {
            show(&app, &format!("服务器两分钟里停了 {recent} 次（这次{how}），不再自动重启。经过记在博客的 {}，退出 Studio 再打开试试。", server_files(&repo).exits), true);
            return;
        }
        // The last good version running: started again as it is, not the broken one.
        let again = if state.rescuing.load(Ordering::Relaxed) { rescue(&app) } else { find_or_start(&app) };
        match again {
            Ok(url) => {
                // Started on another port (the old one still taken): the window goes there.
                if let Some(window) = app.get_webview_window("main") {
                    let moved = window.url().map_or(true, |now| {
                        now.port_or_known_default() != url.port_or_known_default()
                    });
                    if moved {
                        let _ = window.navigate(url);
                    }
                }
            }
            Err(message) => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.navigate(Url::parse("tauri://localhost/index.html").unwrap());
                }
                show(&app, &message, true);
            }
        }
    });
}

fn signal_name(signal: i32) -> &'static str {
    match signal {
        libc::SIGHUP => "SIGHUP",
        libc::SIGINT => "SIGINT，像 Ctrl-C",
        libc::SIGKILL => "SIGKILL，被强行杀掉",
        libc::SIGTERM => "SIGTERM，被叫停",
        libc::SIGABRT => "SIGABRT，node 自己崩了",
        libc::SIGSEGV => "SIGSEGV，node 自己崩了",
        libc::SIGBUS => "SIGBUS，node 自己崩了",
        libc::SIGPIPE => "SIGPIPE",
        _ => "别的信号",
    }
}

/// Adds to the exits log (`ServerFiles::exits`): when, how, the end of the server's log, and the node, npm and
/// kill programs running then (who might have stopped it).
fn note_exit(repo: &Path, how: &str) {
    let when = Command::new("/bin/date")
        .arg("+%F %T")
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_owned())
        .unwrap_or_default();
    let files = server_files(repo);
    let log = fs::read_to_string(repo.join(files.log)).unwrap_or_default();
    let tail: Vec<&str> = log.lines().rev().take(15).collect();
    let running = Command::new("/bin/ps")
        .args(["-axww", "-o", "pid,ppid,etime,command"])
        .output()
        .map(|out| {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|line| {
                    ["node", "npm", "astro", "kill", "pi "]
                        .iter()
                        .any(|word| line.contains(word))
                })
                .map(|line| line.chars().take(240).collect::<String>())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let said = format!(
        "==== {when} 服务器{how}\n-- 它的记录最后几行：\n{}\n-- 当时在跑的：\n{running}\n\n",
        tail.into_iter().rev().collect::<Vec<_>>().join("\n")
    );
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(repo.join(files.exits))
    {
        let _ = file.write_all(said.as_bytes());
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

/// The Studio's page for a 小程序 or the AI in a window of its own (StudioWindow.astro).
fn is_own_window(url: &Url) -> bool {
    is_local(url) && url.path() == "/studio/window"
}

/// The window a 小程序 (`?app=<id>`) or the AI (`?ai`) is asked into: one for each, brought forward when it is open
/// already; sized as asked (`w`, `h`), named (`title`). Its links out go to the browser, as the Studio's do.
fn open_own_window(app: &AppHandle, url: Url) {
    let asked: HashMap<String, String> = url.query_pairs().into_owned().collect();
    let label = match asked.get("app") {
        Some(id) => {
            let kept: String = id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect();
            format!("app-{kept}")
        }
        None => "ai".to_owned(),
    };
    let size = |key: &str, otherwise: f64| asked.get(key).and_then(|value| value.parse::<f64>().ok()).unwrap_or(otherwise).clamp(240.0, 3000.0);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.navigate(url);
        let _ = window.set_focus();
        return;
    }
    let handle = app.clone();
    let closer = (app.clone(), label.clone());
    let title = asked.get("title").cloned().unwrap_or_else(|| "Studio".to_owned());
    // Where it was left last time; the first time, as large as the page asks.
    let built = placed(app, &label, WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url)), (size("w", 460.0), size("h", 760.0)))
        .title(title)
        .min_inner_size(280.0, 200.0)
        .disable_drag_drop_handler()
        // The page's title is the window's; `studio:close` asks it shut (put back into the Studio, its 显示方式):
        // WebKit lets a page shut only a window it opened itself.
        .on_document_title_changed(|window, title| {
            if title == "studio:close" {
                thread::spawn(move || {
                    let _ = window.close();
                });
            } else if !title.is_empty() {
                let _ = window.set_title(&title);
            }
        })
        .on_navigation(move |url| {
            // Put back into the Studio (its 显示方式): shut. WebKit lets a page shut only a window it opened itself, so
            // the page asks by going to studio-action://close.
            if url.scheme() == "studio-action" {
                if url.host_str() == Some("close") {
                    let (app, label) = closer.clone();
                    thread::spawn(move || {
                        if let Some(window) = app.get_webview_window(&label) {
                            let _ = window.close();
                        }
                    });
                }
                return false;
            }
            let ours = is_local(url) || matches!(url.scheme(), "about" | "blob" | "data");
            if !ours {
                open_outside(url.as_str());
            }
            ours
        })
        .on_new_window(move |url, _| {
            if is_own_window(&url) {
                let app = handle.clone();
                thread::spawn(move || open_own_window(&app, url));
            } else {
                open_outside(url.as_str());
            }
            NewWindowResponse::Deny
        })
        .build();
    if let Err(error) = built {
        eprintln!("[studio-app] 没能打开窗口 {label}：{error}");
    }
}

/// The sites of the video players a ```video block shows (Bilibili's, YouTube's) and what they load in
/// their frames. WebKit asks about a frame's pages as about the window's; the players' frames may not
/// take the window (`sandbox`), so these are only ever theirs.
const PLAYER_SITES: &[&str] = &[
    "bilibili.com",
    "hdslb.com",
    "biliapi.net",
    "youtube-nocookie.com",
    "youtube.com",
    "ytimg.com",
    "googlevideo.com",
    "google.com",
    "gstatic.com",
    "doubleclick.net",
];

fn is_player(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some_and(|host| {
            PLAYER_SITES.iter().any(|site| {
                host == *site
                    || host
                        .strip_suffix(site)
                        .is_some_and(|rest| rest.ends_with('.'))
            })
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    fn git(dir: &Path, args: &[&str]) -> String {
        let done = Command::new("git").arg("-C").arg(dir).args(args).output().unwrap();
        assert!(done.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&done.stderr));
        String::from_utf8_lossy(&done.stdout).trim().to_owned()
    }

    /// The last good version made ready: checked out as it was, the author's things the real ones (written there, they
    /// are written in the blog), made ready again for another commit without anything of the blog's touched.
    #[test]
    fn rescue_is_the_last_good_commit_with_the_real_articles() {
        let repo = env::temp_dir().join(format!("studio-rescue-{}", std::process::id()));
        let _ = fs::remove_dir_all(&repo);
        fs::create_dir_all(repo.join("src")).unwrap();
        fs::create_dir_all(repo.join("blog/note")).unwrap();
        fs::write(repo.join("src/main.ts"), "good").unwrap();
        fs::write(repo.join("blog/note/index.md"), "# 旧的").unwrap();
        git(&repo, &["init", "-q"]);
        git(&repo, &["config", "user.email", "test@example.com"]);
        git(&repo, &["config", "user.name", "test"]);
        git(&repo, &["add", "."]);
        git(&repo, &["commit", "-qm", "good"]);
        let good = git(&repo, &["rev-parse", "HEAD"]);
        fs::create_dir_all(repo.join(".studio-cache")).unwrap();
        fs::write(repo.join(".studio-cache/last-good.json"), format!("{{\"commit\":\"{good}\",\"at\":\"now\"}}")).unwrap();
        assert_eq!(last_good(&repo).as_deref(), Some(good.as_str()));
        // Broken since, and an article written since (not committed).
        fs::write(repo.join("src/main.ts"), "broken").unwrap();
        git(&repo, &["commit", "-qam", "broken"]);
        fs::write(repo.join("blog/note/index.md"), "# 新写的").unwrap();
        fs::write(repo.join(".studio-settings.json"), "{}").unwrap();

        let place = prepare_rescue(&repo, &good, Path::new("git")).unwrap();
        assert_eq!(fs::read_to_string(place.join("src/main.ts")).unwrap(), "good");
        assert_eq!(fs::read_to_string(place.join("blog/note/index.md")).unwrap(), "# 新写的");
        assert!(fs::symlink_metadata(place.join("blog")).unwrap().file_type().is_symlink());
        assert!(fs::symlink_metadata(place.join(".studio-settings.json")).unwrap().file_type().is_symlink());
        fs::write(place.join("blog/note/index.md"), "# 安全启动里写的").unwrap();
        assert_eq!(fs::read_to_string(repo.join("blog/note/index.md")).unwrap(), "# 安全启动里写的");

        // Again (another start of it): the same, the blog untouched.
        let again = prepare_rescue(&repo, &good, Path::new("git")).unwrap();
        assert_eq!(again, place);
        assert_eq!(fs::read_to_string(repo.join("blog/note/index.md")).unwrap(), "# 安全启动里写的");
        assert_eq!(fs::read_to_string(repo.join("src/main.ts")).unwrap(), "broken");
        let _ = fs::remove_dir_all(&repo);
    }

    /// The lifeline: a worker thread started (as pi's for a picture) leaves the server and its lock file be; the app's
    /// pipe closed stops it, its lock file gone.
    #[test]
    fn a_worker_thread_does_not_stop_the_server() {
        let Some(node) = which("node", &env::var("PATH").unwrap_or_default()) else {
            return eprintln!("no node: skipped");
        };
        let dir = env::temp_dir().join(format!("studio-lifeline-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(".studio-cache")).unwrap();
        fs::write(dir.join("worker.mjs"), "setTimeout(() => {}, 100);").unwrap();
        fs::write(
            dir.join("server.mjs"),
            "import { writeFileSync } from 'node:fs';\n\
             import { Worker } from 'node:worker_threads';\n\
             writeFileSync('.studio-cache/server.json', JSON.stringify({ pid: process.pid }));\n\
             new Worker(new URL('./worker.mjs', import.meta.url)).on('exit', () => console.log('worker over'));\n",
        )
        .unwrap();
        let mut server = Command::new(node)
            .args(["--import", LIFELINE, "server.mjs"])
            .current_dir(&dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let mut said = String::new();
        let mut out = std::io::BufReader::new(server.stdout.take().unwrap());
        std::io::BufRead::read_line(&mut out, &mut said).unwrap();
        assert_eq!(said.trim(), "worker over");
        thread::sleep(Duration::from_millis(300));
        assert!(server.try_wait().unwrap().is_none(), "the server stopped when a worker started");
        assert!(dir.join(".studio-cache/server.json").exists());

        drop(server.stdin.take());
        let status = server.wait().unwrap();
        assert_eq!(status.signal(), Some(libc::SIGTERM));
        assert!(!dir.join(".studio-cache/server.json").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
