use super::*;

#[test]
fn cursor_rejects_foreign_scope_and_unbounded_values() {
    let token = cursor::Cursor::new("a", "epoch".into(), 3, 5)
        .encode()
        .unwrap();
    assert!(cursor::Cursor::decode(&token, "a").is_ok());
    assert!(cursor::Cursor::decode(&token, "b").is_err());
    assert!(cursor::Cursor::decode(&"a".repeat(4097), "a").is_err());
    let invalid = cursor::Cursor::new("a", "epoch".into(), 6, 5)
        .encode()
        .unwrap();
    assert!(cursor::Cursor::decode(&invalid, "a").is_err());
}

/// 客户端手里的游标是去掉 `ocr_only` 参数以前发的，编码要一个字节都不变。
#[test]
fn cursor_encoding_is_unchanged_after_ocr_only_scope_removal() {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    let issued = |ocr_only: bool| {
        URL_SAFE_NO_PAD.encode(format!(
            r#"{{"version":2,"owner":"a","ocr_only":{ocr_only},"epoch":"epoch","position":3,"upper":5}}"#
        ))
    };
    let token = cursor::Cursor::new("a", "epoch".into(), 3, 5).encode().unwrap();
    assert_eq!(token, issued(false));
    assert!(cursor::Cursor::decode(&issued(false), "a").is_ok());
    // 只有删掉的 `/ocr/jobs/:id/events` 发过 true 的游标。
    assert!(cursor::Cursor::decode(&issued(true), "a").is_err());
}

#[test]
fn checkpoint_reads_only_new_complete_lines() {
    let path = std::env::temp_dir().join(format!("feed-lines-{:016x}.jsonl", fastrand::u64(..)));
    std::fs::write(&path, "{\"event\":\"first\"}\n{\"event\":").unwrap();
    let source = files::inspect(path.clone()).unwrap().unwrap();
    let mut checkpoint = files::Checkpoint::default();
    let (lines, more) = files::read_batch(&source, &mut checkpoint, 10).unwrap();
    assert_eq!(lines.len(), 1);
    assert!(!more);
    let offset = checkpoint.offset;
    assert!(offset < source.size);
    let bytes = files::read_bytes();
    assert!(files::read_batch(&source, &mut checkpoint, 10)
        .unwrap()
        .0
        .is_empty());
    assert_eq!(
        files::read_bytes(),
        bytes,
        "warm unchanged file does not read historical bytes"
    );
    use std::io::Write;
    std::fs::OpenOptions::new()
        .append(true)
        .open(&path)
        .unwrap()
        .write_all(b"\"second\"}\n")
        .unwrap();
    let source = files::inspect(path.clone()).unwrap().unwrap();
    assert!(!files::changed(&source, &checkpoint).unwrap());
    let lines = files::read_batch(&source, &mut checkpoint, 10).unwrap().0;
    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0].0, offset);
    assert_eq!(checkpoint.offset, source.size);
    assert!(
        files::read_bytes() - bytes < 2048,
        "incremental read is bounded by delta and fingerprints"
    );
    std::fs::remove_file(&path).unwrap();
}

#[test]
fn checkpoint_limits_batch_bytes_even_for_large_complete_lines() {
    let path = std::env::temp_dir().join(format!("feed-batch-{:016x}.jsonl", fastrand::u64(..)));
    let line = format!("{}\n", "x".repeat(128 * 1024 - 1));
    std::fs::write(&path, line.repeat(20)).unwrap();
    let source = files::inspect(path.clone()).unwrap().unwrap();
    let mut checkpoint = files::Checkpoint::default();
    let (lines, more) = files::read_batch(&source, &mut checkpoint, 1024).unwrap();
    assert_eq!(lines.len(), 8);
    assert_eq!(checkpoint.offset, 1024 * 1024);
    assert!(more);
    let (lines, more) = files::read_batch(&source, &mut checkpoint, 1024).unwrap();
    assert_eq!(lines.len(), 8);
    assert!(more);
    let (lines, more) = files::read_batch(&source, &mut checkpoint, 1024).unwrap();
    assert_eq!(lines.len(), 4);
    assert!(!more);
    assert_eq!(checkpoint.offset, source.size);
    std::fs::remove_file(&path).unwrap();
}

/// 手动跑：在真实数据上把每个任务的进度流整页整页读出来（和 `/jobs/{id}/events` 同一段代码，从头读到尾），
/// 外加任务列表用的「当前阶段」快照，写成一行一个任务的 JSONL。改进度流的存法前后各跑一遍、逐行比，必须一样
/// （游标里的 epoch 是随机的，不写）。只读任务目录；库要给一份**副本**（会建事件流）。
/// `RETAINPDF_FEED_DATA=<数据目录> RETAINPDF_FEED_DB=<库的副本> RETAINPDF_FEED_OUT=<输出文件>
///  cargo test -p retainpdf-jobs real_feed_dump -- --ignored --nocapture`
#[test]
#[ignore]
fn real_feed_dump() {
    use std::io::Write;
    let (Ok(data), Ok(db_copy), Ok(out)) =
        (std::env::var("RETAINPDF_FEED_DATA"), std::env::var("RETAINPDF_FEED_DB"), std::env::var("RETAINPDF_FEED_OUT"))
    else {
        return;
    };
    let data = std::path::PathBuf::from(data);
    let db_copy = std::path::PathBuf::from(db_copy);
    let db = Db::new(db_copy.clone(), db_copy.parent().unwrap().join("feed-scratch"));
    db.init().unwrap();
    let mut jobs = db.list_jobs(u32::MAX, 0, None, None).unwrap();
    jobs.sort_by(|a, b| a.job_id.cmp(&b.job_id));
    let mut file = std::io::BufWriter::new(std::fs::File::create(&out).unwrap());
    let started = std::time::Instant::now();
    for job in &jobs {
        let mut items = Vec::new();
        let mut cursor = None;
        let outcome = loop {
            let query = crate::views::ListJobEventsQuery {
                limit: retainpdf_core::config::limits::MAX_JOB_EVENT_LIMIT,
                start: cursor.is_none().then_some(crate::views::ListJobEventsStart::Head),
                cursor: cursor.clone(),
            };
            match read_events(&db, &data, &job.job_id, &query) {
                Ok(page) => {
                    items.extend(page.items.into_iter().map(|item| serde_json::to_value(item).unwrap()));
                    if !page.has_more {
                        break "ok".to_string();
                    }
                    cursor = Some(page.next_cursor);
                }
                Err(error) => break format!("error: {error:?}"),
            }
        };
        let live = live_snapshot(&db, &data, job).map(|live| serde_json::to_value(live).unwrap());
        let line = serde_json::json!({"job_id": job.job_id, "outcome": outcome, "items": items, "live": live});
        writeln!(file, "{line}").unwrap();
    }
    file.flush().unwrap();
    println!("{} jobs in {:?}", jobs.len(), started.elapsed());
}
