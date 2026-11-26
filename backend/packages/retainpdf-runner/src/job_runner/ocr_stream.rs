//! OCR 流式公布的清单（`ocr/stream/manifest.json`），Rust 这边只做一件事：OCR 没做成时标失败。
//!
//! 契约在 Python 的 `retainpdf_base/ocr_stream.py`：OCR provider（GLM-OCR、Paddle）每做完一片写一版清单，跟着 OCR 翻的翻译
//! worker 读它；OCR 在 Python 里失败时自己会标 `failed`。但 OCR 进程被杀（超时、空闲超时、崩了）就来不及写，翻译会一直等
//! 下一版清单，直到它自己的"多久没有进展"超时（默认半小时）。所以 OCR 子任务一结束、又不是成功，driver 就补标一次失败，
//! 翻译 worker 读到就退出。OCR 成了却没标完成时补标 `done`；拉起 OCR 和翻译之前清掉上一轮失败的清单。

use std::path::Path;

use anyhow::{Context, Result};
use serde_json::{json, Value};

const OCR_STREAM_SCHEMA: &str = "ocr_stream_v1";
const MANIFEST_RELATIVE_PATH: &str = "stream/manifest.json";

/// 把清单标成失败（`seq` 加 1，保留已公布的页数）。已经是 `done` 或 `failed` 的不动。
pub(super) fn mark_ocr_stream_failed(ocr_dir: &Path, reason: &str) -> Result<()> {
    let path = ocr_dir.join(MANIFEST_RELATIVE_PATH);
    let previous: Value = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(Value::Null);
    if previous.get("done").and_then(Value::as_bool) == Some(true)
        || previous.get("failed").and_then(Value::as_bool) == Some(true)
    {
        return Ok(());
    }
    let seq = previous.get("seq").and_then(Value::as_i64).unwrap_or(0) + 1;
    let manifest = json!({
        "schema": OCR_STREAM_SCHEMA,
        "seq": seq,
        "provider": previous.get("provider").cloned().unwrap_or(Value::Null),
        "ready_pages": previous.get("ready_pages").and_then(Value::as_i64).unwrap_or(0),
        // 就绪的页不一定连着（Paddle 按片并行），原样留着；旧清单没有这个键，读的一方按前 ready_pages 页算
        "ready_page_indices": previous.get("ready_page_indices").cloned().unwrap_or(Value::Null),
        "total_pages": previous.get("total_pages").and_then(Value::as_i64).unwrap_or(0),
        "done": false,
        "failed": true,
        "error": reason.chars().take(500).collect::<String>(),
        "document": previous.get("document").cloned().unwrap_or_else(|| json!("stream/document.v1.json")),
        "updated_at": chrono_like_now(),
    });
    // 和 Python 一样原子写：读的一方任何时候读到的都是完整的一版
    write_manifest(&path, &manifest)
}

/// OCR 子任务成功了，清单却还没标 `done`（OCR 那边没走流式公布：旧版本、不切片的路……）时补一版 done，
/// 文档指向最后的整份 `normalized/document.v1.json`。不然跟着 OCR 的翻译会一直等到自己的"多久没有进展"超时。
pub(super) fn ensure_ocr_stream_done(ocr_dir: &Path) -> Result<()> {
    let path = ocr_dir.join(MANIFEST_RELATIVE_PATH);
    let previous: Value = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(Value::Null);
    if previous.get("done").and_then(Value::as_bool) == Some(true) {
        return Ok(());
    }
    let document = ocr_dir.join("normalized").join("document.v1.json");
    let pages = std::fs::read(&document)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|doc| doc.get("pages").and_then(Value::as_array).map(Vec::len))
        .with_context(|| format!("OCR succeeded but {} is missing or unreadable", document.display()))?;
    let seq = previous.get("seq").and_then(Value::as_i64).unwrap_or(0) + 1;
    let manifest = json!({
        "schema": OCR_STREAM_SCHEMA,
        "seq": seq,
        "provider": previous.get("provider").cloned().unwrap_or(Value::Null),
        "ready_pages": pages,
        "ready_page_indices": (0..pages).collect::<Vec<_>>(),
        "total_pages": pages,
        "done": true,
        "failed": false,
        "error": "",
        "document": "normalized/document.v1.json",
        "updated_at": chrono_like_now(),
    });
    write_manifest(&path, &manifest)
}

/// 拉起流式 OCR 和翻译之前：上一轮留下的清单是 `failed` 的就删掉（2026-11-26，Z5 / S46）。
///
/// 不删的话，跟着 OCR 的翻译一开跑就读到上一轮的失败、立刻退出，新一轮 OCR 还没来得及公布第一版。Python 的
/// `OcrStreamWriter` 开跑时也清一次，但它在 OCR 进程里，和翻译进程谁先谁后说不准，所以这里在两个进程拉起之前先清。
/// 没写完的旧清单（进程被杀）留着：新一轮的 seq 接着它往下数。
pub(super) fn clear_failed_ocr_stream(ocr_dir: &Path) -> Result<()> {
    let path = ocr_dir.join(MANIFEST_RELATIVE_PATH);
    let previous: Value = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(Value::Null);
    if previous.get("failed").and_then(Value::as_bool) != Some(true) {
        return Ok(());
    }
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).with_context(|| format!("remove failed {}", path.display())),
    }
}

fn write_manifest(path: &Path, manifest: &Value) -> Result<()> {
    let parent = path.parent().context("ocr stream manifest has no parent")?;
    std::fs::create_dir_all(parent)?;
    // 临时文件名每次不同（以前固定 `.manifest.json.tmp`）：上一次留下的、另一个写者正在写的都碰不到这一次。
    let tmp = parent.join(format!(
        ".manifest.json.{}.{:016x}.tmp",
        std::process::id(),
        fastrand::u64(..)
    ));
    let written = std::fs::write(&tmp, serde_json::to_vec_pretty(manifest)?)
        .map_err(anyhow::Error::from)
        .and_then(|()| {
            std::fs::rename(&tmp, path).with_context(|| format!("replace {}", path.display()))
        });
    if written.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    written
}

fn chrono_like_now() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs_f64())
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "retainpdf-ocr-stream-{name}-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now()
        ));
        std::fs::create_dir_all(dir.join("stream")).unwrap();
        dir
    }

    fn read(dir: &Path) -> Value {
        serde_json::from_slice(&std::fs::read(dir.join(MANIFEST_RELATIVE_PATH)).unwrap()).unwrap()
    }

    #[test]
    fn a_killed_ocr_is_announced_so_the_waiting_translation_stops() {
        let dir = temp_dir("killed");
        std::fs::write(
            dir.as_path().join(MANIFEST_RELATIVE_PATH),
            r#"{"schema":"ocr_stream_v1","seq":3,"provider":"glm_ocr","ready_pages":20,"total_pages":120,"done":false,"failed":false,"error":"","document":"stream/document.v1.json"}"#,
        )
        .unwrap();
        mark_ocr_stream_failed(dir.as_path(), "OCR child failed: no progress for 1800s").unwrap();
        let manifest = read(dir.as_path());
        assert_eq!(manifest["seq"], 4, "翻译只认比上一版新的清单");
        assert_eq!(manifest["failed"], true);
        assert_eq!(manifest["ready_pages"], 20);
        assert_eq!(manifest["total_pages"], 120);
        assert_eq!(manifest["error"], "OCR child failed: no progress for 1800s");

        // 就绪的页不连着（Paddle 后面的片先做完）：标失败时原样留着
        let gappy = temp_dir("killed-gappy");
        std::fs::write(
            gappy.as_path().join(MANIFEST_RELATIVE_PATH),
            r#"{"schema":"ocr_stream_v1","seq":2,"provider":"paddle","ready_pages":2,"ready_page_indices":[20,21],"total_pages":34,"done":false,"failed":false}"#,
        )
        .unwrap();
        mark_ocr_stream_failed(gappy.as_path(), "killed").unwrap();
        assert_eq!(read(gappy.as_path())["ready_page_indices"], json!([20, 21]));
    }

    #[test]
    fn a_successful_ocr_without_a_finished_stream_gets_one_pointing_at_the_final_document() {
        let dir = temp_dir("ensure-done");
        std::fs::create_dir_all(dir.join("normalized")).unwrap();
        std::fs::write(dir.join("normalized/document.v1.json"), r#"{"pages":[{},{},{}]}"#).unwrap();
        std::fs::write(
            dir.join(MANIFEST_RELATIVE_PATH),
            r#"{"schema":"ocr_stream_v1","seq":2,"ready_pages":1,"total_pages":3,"done":false,"failed":false}"#,
        )
        .unwrap();
        ensure_ocr_stream_done(dir.as_path()).unwrap();
        let manifest = read(dir.as_path());
        assert_eq!((manifest["seq"].clone(), manifest["done"].clone(), manifest["ready_pages"].clone()), (json!(3), json!(true), json!(3)));
        assert_eq!(manifest["document"], "normalized/document.v1.json");
        assert_eq!(manifest["ready_page_indices"], json!([0, 1, 2]));
        // 已经 done 的不动
        ensure_ocr_stream_done(dir.as_path()).unwrap();
        assert_eq!(read(dir.as_path())["seq"], 3);
    }

    /// 以前临时文件名固定是 `.manifest.json.tmp`：上一次写到一半留下的（这里用同名目录模拟占着）、或者两个写者同时写，
    /// 都会让这一次写失败或互相踩。临时文件名要每次不同。
    #[test]
    fn a_leftover_temporary_does_not_block_the_next_manifest_write() {
        let dir = temp_dir("leftover-tmp");
        std::fs::create_dir_all(dir.join("stream/.manifest.json.tmp")).unwrap();
        mark_ocr_stream_failed(dir.as_path(), "killed").unwrap();
        assert_eq!(read(dir.as_path())["failed"], true);
        let leftovers: Vec<_> = std::fs::read_dir(dir.join("stream"))
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp") && name != ".manifest.json.tmp")
            .collect();
        assert!(leftovers.is_empty(), "临时文件没换上也没删掉: {leftovers:?}");
    }

    /// 拉起之前只清上一轮失败的清单；没写完的（被杀的）、做完的都留着，新一轮的 seq 接着它数。
    #[test]
    fn only_a_failed_manifest_is_cleared_before_a_new_streaming_run() {
        let failed = temp_dir("clear-failed");
        std::fs::write(
            failed.join(MANIFEST_RELATIVE_PATH),
            r#"{"schema":"ocr_stream_v1","seq":3,"ready_pages":1,"total_pages":3,"done":false,"failed":true}"#,
        )
        .unwrap();
        clear_failed_ocr_stream(failed.as_path()).unwrap();
        assert!(!failed.join(MANIFEST_RELATIVE_PATH).exists());

        let unfinished = temp_dir("keep-unfinished");
        let body = r#"{"schema":"ocr_stream_v1","seq":4,"ready_pages":2,"total_pages":3,"done":false,"failed":false}"#;
        std::fs::write(unfinished.join(MANIFEST_RELATIVE_PATH), body).unwrap();
        clear_failed_ocr_stream(unfinished.as_path()).unwrap();
        assert_eq!(read(unfinished.as_path())["seq"], 4);

        clear_failed_ocr_stream(temp_dir("clear-missing").as_path()).unwrap();
    }

    #[test]
    fn a_finished_stream_is_left_alone_and_a_missing_one_is_created() {
        let done = temp_dir("done");
        let finished = r#"{"schema":"ocr_stream_v1","seq":5,"ready_pages":9,"total_pages":9,"done":true,"failed":false}"#;
        std::fs::write(done.as_path().join(MANIFEST_RELATIVE_PATH), finished).unwrap();
        mark_ocr_stream_failed(done.as_path(), "late").unwrap();
        assert_eq!(read(done.as_path())["done"], true);

        // OCR 还没公布第一版就挂了：也要有一版失败的清单，翻译建计划时在等第一版
        let empty = temp_dir("empty");
        mark_ocr_stream_failed(empty.as_path(), "spawn failed").unwrap();
        let manifest = read(empty.as_path());
        assert_eq!((manifest["seq"].clone(), manifest["failed"].clone()), (json!(1), json!(true)));
    }
}
