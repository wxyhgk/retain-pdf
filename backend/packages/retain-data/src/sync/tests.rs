//! 两台(或三台)模拟设备通过一个普通目录同步。

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

use super::folder::sha256_file;
use super::{SyncEngine, SyncReport};
use crate::db::Db;

struct Device {
    root: PathBuf,
    db: Db,
    engine: SyncEngine,
}

impl Device {
    fn new(base: &Path, name: &str, folder: &Path) -> Self {
        let root = base.join(name);
        fs::create_dir_all(&root).unwrap();
        let root = fs::canonicalize(&root).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        let engine = SyncEngine::new(db.clone(), &root, folder, name).unwrap();
        Self { root, db, engine }
    }

    fn conn(&self) -> Connection {
        let conn = Connection::open(self.root.join("db").join("jobs.db")).unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn
    }

    fn sync(&self) -> SyncReport {
        self.engine.run_cycle().unwrap()
    }

    fn write(&self, relative: &str, bytes: &[u8]) {
        let path = self.root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    fn text(&self, sql: &str, key: &str) -> Option<String> {
        self.conn()
            .query_row(sql, params![key], |row| row.get::<_, Option<String>>(0))
            .ok()
            .flatten()
    }

    fn count(&self, sql: &str) -> i64 {
        self.conn().query_row(sql, [], |row| row.get(0)).unwrap()
    }

    /// 一本书:上传、文档、任务(带产物登记、流水线记录与文件)。
    fn add_book(&self, document_id: &str, job_id: &str, upload_id: &str, status: &str) {
        let root = self.root.to_string_lossy().to_string();
        self.write(&format!("uploads/{upload_id}/book.pdf"), b"%PDF source");
        self.write(&format!("documents/{document_id}/thumbnail.jpg"), b"jpeg");
        self.write(&format!("jobs/{job_id}/source/book.pdf"), b"%PDF source");
        self.write(&format!("jobs/{job_id}/ocr/normalized/document.v1.json"), br#"{"pages":[]}"#);
        self.write(&format!("jobs/{job_id}/translated/page-001.json"), br#"[{"t":"x"}]"#);
        self.write(&format!("jobs/{job_id}/rendered/book-translated.pdf"), b"%PDF translated");
        self.write(&format!("jobs/{job_id}/rendered/typst/book-overlays/book-overlay.pdf"), b"%PDF overlay");
        self.write(&format!("jobs/{job_id}/rendered/typst/cache/scratch.bin"), b"cache");
        self.write(&format!("jobs/{job_id}/artifacts/render_prewarm/prewarm.json"), b"{}");
        self.write(&format!("jobs/{job_id}/artifacts/render_prewarm/render_source_prewarm_manifest.json"), b"{\"blocks\":[]}");
        self.write(&format!("jobs/{job_id}/artifacts/{job_id}-layout.docx"), b"docx");
        let conn = self.conn();
        conn.execute(
            "INSERT INTO uploads(upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash)
             VALUES(?1, 'book.pdf', ?2, 11, 3, '2026-10-01T00:00:00Z', 0, '')",
            params![upload_id, format!("uploads/{upload_id}/book.pdf")],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO documents(document_id, title, source_filename, page_count, bytes, active_job_id, added_at, updated_at)
             VALUES(?1, 'Book', 'book.pdf', 3, 11, ?2, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')",
            params![document_id, job_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_title_state(document_id, source, locked, updated_at) VALUES(?1, 'user', 1, 't')",
            params![document_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO jobs(job_id, workflow, status_json, created_at, updated_at, upload_id, pid, command_json, request_json, log_tail_json, document_id)
             VALUES(?1, '\"book\"', ?2, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', ?3, 4242, ?4, '{}', '[]', ?5)",
            params![
                job_id,
                format!("\"{status}\""),
                upload_id,
                format!("[\"python\", \"--spec\", \"{root}/jobs/{job_id}/specs/translate.spec.json\"]"),
                document_id
            ],
        )
        .unwrap();
        for (key, path) in [
            ("source_pdf", format!("jobs/{job_id}/source/book.pdf")),
            ("translated_pdf", format!("jobs/{job_id}/rendered/book-translated.pdf")),
            ("typst_render_pdf", format!("jobs/{job_id}/rendered/typst/book-overlays/book-overlay.pdf")),
            ("job_root", format!("jobs/{job_id}")),
        ] {
            conn.execute(
                "INSERT INTO job_artifact_entries(job_id, artifact_key, artifact_group, artifact_kind, relative_path, content_type, ready, created_at, updated_at)
                 VALUES(?1, ?2, 'g', 'k', ?3, 'application/pdf', 1, 't', 't')",
                params![job_id, key, path],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO pipeline_attempts(job_id, attempt, generation, status, worker_id, created_at, updated_at)
             VALUES(?1, 1, 1, 'succeeded', 'w', 't', 't')",
            params![job_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pipeline_stages(job_id, attempt, stage_key, stage_order, generation, status, created_at, updated_at)
             VALUES(?1, 1, 'translate', 1, 1, 'succeeded', 't', 't')",
            params![job_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pipeline_units(job_id, attempt, stage_key, unit_key, unit_order, generation, status, page_index, page_hash, committed_at, updated_at)
             VALUES(?1, 1, 'translate', 'page-1', 1, 1, 'committed', 0, 'abc', 't', 't')",
            params![job_id],
        )
        .unwrap();
    }
}

fn setup(devices: &[&str]) -> (PathBuf, PathBuf, Vec<Device>) {
    let base = std::env::temp_dir().join(format!("retain-sync-test-{:016x}", fastrand::u64(..)));
    let folder = base.join("cloud").join("RetainPDF");
    fs::create_dir_all(&folder).unwrap();
    let list = devices.iter().map(|name| Device::new(&base, name, &folder)).collect();
    (base, folder, list)
}

const DOC: &str = "d0c0000000000000000000000000000000000000000000000000000000000001";
const JOB: &str = "20261001000000-aaaaaa";
const UPLOAD: &str = "20261001000000-bbbbbb";

#[test]
fn a_book_arrives_whole_with_paths_rewritten_and_caches_left_behind() {
    let (base, folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");

    let sent = a.sync();
    assert_eq!(sent.exported, 3, "upload, document, job: {sent:?}");
    assert!(folder.join("format.json").is_file());

    let got = b.sync();
    assert_eq!((got.applied, got.pending), (3, 0), "{got:?}");
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Book"));
    assert_eq!(b.count("SELECT COUNT(*) FROM document_title_state"), 1);
    assert_eq!(b.count("SELECT COUNT(*) FROM pipeline_units"), 1);
    assert_eq!(b.count("SELECT COUNT(*) FROM job_artifact_entries"), 4);
    // 进程号不跟过来;命令里的数据目录换成本机的。
    assert_eq!(b.text("SELECT CAST(pid AS TEXT) FROM jobs WHERE job_id = ?1", JOB), None);
    let command = b.text("SELECT command_json FROM jobs WHERE job_id = ?1", JOB).unwrap();
    assert!(command.contains(&format!("{}/jobs/{JOB}/specs", b.root.display())), "{command}");
    assert!(!command.contains(&a.root.to_string_lossy().to_string()));
    // 文件:原文、OCR、译文、成品、登记过的叠加层都在;渲染缓存与 Word 不带。
    for path in [
        format!("uploads/{UPLOAD}/book.pdf"),
        format!("documents/{DOC}/thumbnail.jpg"),
        format!("jobs/{JOB}/source/book.pdf"),
        format!("jobs/{JOB}/ocr/normalized/document.v1.json"),
        format!("jobs/{JOB}/translated/page-001.json"),
        format!("jobs/{JOB}/rendered/book-translated.pdf"),
        format!("jobs/{JOB}/rendered/typst/book-overlays/book-overlay.pdf"),
        format!("jobs/{JOB}/artifacts/render_prewarm/render_source_prewarm_manifest.json"),
    ] {
        assert_eq!(fs::read(b.root.join(&path)).unwrap(), fs::read(a.root.join(&path)).unwrap(), "{path}");
    }
    for path in [
        format!("jobs/{JOB}/rendered/typst/cache/scratch.bin"),
        format!("jobs/{JOB}/artifacts/render_prewarm/prewarm.json"),
        format!("jobs/{JOB}/artifacts/{JOB}-layout.docx"),
    ] {
        assert!(!b.root.join(&path).exists(), "{path} should stay behind");
    }
    // 同一份原文只存一次。
    let blob = sha256_file(&a.root.join(format!("uploads/{UPLOAD}/book.pdf"))).unwrap();
    assert!(folder.join("blobs").join(&blob[..2]).join(&blob).is_file());

    // 收到的改动不会被当成本机改动再发出去;再跑也没有新东西。
    assert_eq!(b.count("SELECT COUNT(*) FROM sync_dirty"), 0);
    assert_eq!(b.sync().exported, 0);
    let again = a.sync();
    assert_eq!((again.exported, again.applied), (0, 0), "{again:?}");
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn edits_to_different_fields_on_two_devices_both_survive() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();

    a.conn().execute("UPDATE documents SET title = 'Quantum Chemistry' WHERE document_id = ?1", params![DOC]).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    b.conn().execute("UPDATE documents SET reading_status = 'reading' WHERE document_id = ?1", params![DOC]).unwrap();
    a.sync();
    b.sync(); // 收到 a 的书名,保留自己的阅读状态,并把合并结果发出去
    a.sync();
    for device in [a, b] {
        assert_eq!(device.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Quantum Chemistry"));
        assert_eq!(device.text("SELECT reading_status FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("reading"));
    }
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn the_later_edit_of_the_same_field_wins_everywhere() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();

    a.conn().execute("UPDATE documents SET title = 'From A' WHERE document_id = ?1", params![DOC]).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    b.conn().execute("UPDATE documents SET title = 'From B' WHERE document_id = ?1", params![DOC]).unwrap();
    // 先后顺序故意反过来:晚改的 b 先同步。
    b.sync();
    a.sync();
    b.sync();
    a.sync();
    for device in [a, b] {
        assert_eq!(device.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("From B"));
    }
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_deleted_book_goes_away_everywhere_and_stays_away() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    // b 上生成的渲染缓存(不同步的东西)也要随任务删掉。
    b.write(&format!("jobs/{JOB}/rendered/typst/cache/local.bin"), b"cache");

    let conn = a.conn();
    conn.execute("DELETE FROM jobs WHERE job_id = ?1", params![JOB]).unwrap();
    conn.execute("DELETE FROM uploads WHERE upload_id = ?1", params![UPLOAD]).unwrap();
    conn.execute("DELETE FROM documents WHERE document_id = ?1", params![DOC]).unwrap();
    fs::remove_dir_all(a.root.join("jobs").join(JOB)).unwrap();
    let sent = a.sync();
    assert_eq!(sent.exported, 3, "{sent:?}");

    let got = b.sync();
    assert_eq!(got.deleted, 3, "{got:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM documents"), 0);
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 0);
    assert_eq!(b.count("SELECT COUNT(*) FROM pipeline_units"), 0);
    assert!(!b.root.join("jobs").join(JOB).exists());
    assert!(!b.root.join("uploads").join(UPLOAD).exists());
    assert!(!b.root.join("documents").join(DOC).exists());
    // 不会复活。
    assert_eq!(b.sync().exported, 0);
    a.sync();
    assert_eq!(a.count("SELECT COUNT(*) FROM documents"), 0);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_change_waits_until_its_files_arrive() {
    let (base, folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    // 网盘还没把这份文件搬过来。
    let sha = sha256_file(&a.root.join(format!("jobs/{JOB}/translated/page-001.json"))).unwrap();
    let blob = folder.join("blobs").join(&sha[..2]).join(&sha);
    let hidden = folder.join("hidden-blob");
    fs::rename(&blob, &hidden).unwrap();

    let first = b.sync();
    assert_eq!((first.parked, first.pending), (1, 1), "{first:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 0);
    assert!(!b.root.join(format!("jobs/{JOB}/source/book.pdf")).exists(), "nothing written before all files are there");

    fs::rename(&hidden, &blob).unwrap();
    let second = b.sync();
    assert_eq!((second.applied, second.pending), (1, 0), "{second:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 1);
    assert!(b.root.join(format!("jobs/{JOB}/translated/page-001.json")).is_file());
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn running_jobs_are_sent_once_they_end() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "running");
    a.sync();
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM documents"), 1);
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 0);

    a.conn().execute("UPDATE jobs SET status_json = '\"succeeded\"' WHERE job_id = ?1", params![JOB]).unwrap();
    a.sync();
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 1);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_favorite_waits_for_its_job_from_another_device() {
    // c 收藏了 a 的任务;b 先读到 c 的收藏、后读到 a 的任务。
    let (base, folder, devices) = setup(&["a", "b", "c"]);
    let (a, b, c) = (&devices[0], &devices[1], &devices[2]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    c.sync();
    c.conn()
        .execute(
            "INSERT INTO favorites(favorite_id, document_id, job_id, page_idx, block_id, quote_text, created_at, updated_at)
             VALUES('fav-1', ?1, ?2, 0, 'b1', 'quote', 't', 't')",
            params![DOC, JOB],
        )
        .unwrap();
    c.sync();
    // 让 b 的这一轮只看得到 c 的改动:把 a 的改动记录暂时藏起来。
    let a_dir = folder.join("devices").join(a.engine.device_id().unwrap());
    let a_hidden = base.join("a-hidden");
    fs::rename(&a_dir, &a_hidden).unwrap();
    let first = b.sync();
    assert_eq!(first.pending, 1, "{first:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM favorites"), 0);
    fs::rename(&a_hidden, &a_dir).unwrap();
    let second = b.sync();
    assert_eq!(second.pending, 0, "{second:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM favorites"), 1);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn half_written_segments_and_malicious_paths_are_not_applied() {
    let (base, folder, devices) = setup(&["a", "b"]);
    let b = &devices[1];
    b.sync();
    let device = "00000000000000ff";
    let changes = folder.join("devices").join(device).join("changes");
    fs::create_dir_all(&changes).unwrap();
    let evil = serde_json::json!({
        "kind": "upload", "key": "x1", "clock": "1790000000000-000000-00000000000000ff", "device": device,
        "rows": {"uploads": [{"upload_id": "x1", "filename": "f", "stored_path": "uploads/x1/f",
            "bytes": 1, "page_count": 1, "uploaded_at": "t", "developer_mode": 0}]},
        "files": [{"path": "../../outside.txt", "sha256": "a".repeat(64), "size": 1}]
    });
    // 第一段没有结束标记:还没同步完整,不读。
    fs::write(changes.join("00000001.jsonl"), format!("{evil}\n")).unwrap();
    let first = b.sync();
    assert_eq!((first.applied, first.rejected), (0, 0), "{first:?}");
    assert_eq!(b.db.sync_cursor(device).unwrap(), 0);
    // 补上结束标记:读到了,但路径越界,整条丢弃。
    fs::write(changes.join("00000001.jsonl"), format!("{evil}\n{{\"segment_end\":1}}\n")).unwrap();
    let second = b.sync();
    assert_eq!((second.applied, second.rejected), (0, 1), "{second:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM uploads"), 0);
    assert!(!base.join("outside.txt").exists());
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_rerendered_job_replaces_its_files_on_the_other_device() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    // 在 a 上重新渲染:成品换了名字和内容,登记跟着换。
    fs::remove_file(a.root.join(format!("jobs/{JOB}/rendered/book-translated.pdf"))).unwrap();
    a.write(&format!("jobs/{JOB}/rendered/book-v2-translated.pdf"), b"%PDF translated v2");
    a.conn()
        .execute(
            "UPDATE job_artifact_entries SET relative_path = ?2 WHERE job_id = ?1 AND artifact_key = 'translated_pdf'",
            params![JOB, format!("jobs/{JOB}/rendered/book-v2-translated.pdf")],
        )
        .unwrap();
    a.sync();
    let got = b.sync();
    assert_eq!((got.applied, got.files_written, got.files_removed), (1, 1, 1), "{got:?}");
    assert_eq!(fs::read(b.root.join(format!("jobs/{JOB}/rendered/book-v2-translated.pdf"))).unwrap(), b"%PDF translated v2");
    assert!(!b.root.join(format!("jobs/{JOB}/rendered/book-translated.pdf")).exists());
    // 原文同时被上传和任务管理着,任务的变化不会把它删掉。
    assert!(b.root.join(format!("uploads/{UPLOAD}/book.pdf")).is_file());
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn an_edit_made_after_a_delete_brings_the_item_back_an_older_one_does_not() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    let collection = "col-1";
    let create = |device: &Device| {
        device
            .conn()
            .execute(
                "INSERT INTO collections(collection_id, name, created_at) VALUES(?1, 'Reading list', 't')",
                params![collection],
            )
            .unwrap();
    };
    create(a);
    a.sync();
    b.sync();
    // b 先改名,a 后删:删除更晚,改名被删除盖过。
    b.conn().execute("UPDATE collections SET name = 'Old edit' WHERE collection_id = ?1", params![collection]).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    a.conn().execute("DELETE FROM collections WHERE collection_id = ?1", params![collection]).unwrap();
    b.sync();
    a.sync();
    b.sync();
    for device in [a, b] {
        assert_eq!(device.count("SELECT COUNT(*) FROM collections"), 0);
    }
    // 删除之后 b 又建了回来(同一个编号):更晚,保留。
    std::thread::sleep(std::time::Duration::from_millis(5));
    create(b);
    b.sync();
    a.sync();
    for device in [a, b] {
        assert_eq!(device.count("SELECT COUNT(*) FROM collections"), 1);
    }
    fs::remove_dir_all(base).unwrap();
}

/// 书库在各设备上看到的样子(比较用)。
fn library_snapshot(device: &Device) -> Vec<String> {
    let conn = device.conn();
    let mut out = Vec::new();
    for sql in [
        "SELECT document_id || ':' || title || ':' || reading_status FROM documents ORDER BY 1",
        "SELECT collection_id || ':' || name FROM collections ORDER BY 1",
        "SELECT collection_id || ':' || document_id FROM collection_documents ORDER BY 1",
        "SELECT favorite_id || ':' || note FROM favorites ORDER BY 1",
        "SELECT job_id FROM jobs ORDER BY 1",
    ] {
        let mut stmt = conn.prepare(sql).unwrap();
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();
        out.extend(rows.map(Result::unwrap));
        out.push("--".into());
    }
    out
}

#[test]
fn three_devices_converge_whatever_the_order_of_edits_and_syncs() {
    for seed in 1..=6u64 {
        let (base, _folder, devices) = setup(&["a", "b", "c"]);
        let mut rng = fastrand::Rng::with_seed(seed);
        devices[0].add_book(DOC, JOB, UPLOAD, "succeeded");
        devices[0].sync();
        devices[0]
            .conn()
            .execute("INSERT INTO collections(collection_id, name, created_at) VALUES('col-1', 'C', 't')", [])
            .unwrap();
        devices[0].sync();
        for device in &devices[1..] {
            device.sync();
        }
        for step in 0..40 {
            let device = &devices[rng.usize(..devices.len())];
            let conn = device.conn();
            let has_doc: i64 = conn.query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0)).unwrap();
            let has_col: i64 = conn.query_row("SELECT COUNT(*) FROM collections", [], |r| r.get(0)).unwrap();
            match rng.u8(..7) {
                0 if has_doc > 0 => {
                    conn.execute("UPDATE documents SET title = ?1", params![format!("t{step}")]).unwrap();
                }
                1 if has_doc > 0 => {
                    conn.execute("UPDATE documents SET reading_status = ?1", params![format!("s{step}")]).unwrap();
                }
                2 if has_doc > 0 && has_col > 0 => {
                    conn.execute(
                        "INSERT OR IGNORE INTO collection_documents(collection_id, document_id, added_at) VALUES('col-1', ?1, 't')",
                        params![DOC],
                    )
                    .unwrap();
                }
                3 => {
                    conn.execute("DELETE FROM collection_documents", []).unwrap();
                }
                4 if has_col > 0 => {
                    conn.execute("UPDATE collections SET name = ?1", params![format!("c{step}")]).unwrap();
                }
                5 if has_doc > 0 => {
                    let has_job: i64 = conn.query_row("SELECT COUNT(*) FROM jobs", [], |r| r.get(0)).unwrap();
                    if has_job > 0 {
                        conn.execute(
                            "INSERT INTO favorites(favorite_id, document_id, job_id, page_idx, block_id, quote_text, note, created_at, updated_at)
                             VALUES(?1, ?2, ?3, 0, 'b', 'q', 'n', 't', 't')
                             ON CONFLICT(favorite_id) DO UPDATE SET note = excluded.note",
                            params![format!("fav-{}", rng.u8(..3)), DOC, JOB],
                        )
                        .unwrap();
                    }
                }
                _ => {
                    drop(conn);
                    device.sync();
                }
            }
            // 制造同一毫秒内与跨毫秒的改动。
            if rng.bool() {
                std::thread::sleep(std::time::Duration::from_millis(2));
            }
        }
        // 都安静下来:每台设备轮流同步,直到一整圈没有任何新东西。
        for _ in 0..10 {
            let mut quiet = true;
            for device in &devices {
                let report = device.sync();
                if report.exported + report.applied > 0 {
                    quiet = false;
                }
            }
            if quiet {
                break;
            }
        }
        let first = library_snapshot(&devices[0]);
        for device in &devices[1..] {
            assert_eq!(library_snapshot(device), first, "seed {seed}");
        }
        for device in &devices {
            assert_eq!(device.db.sync_pending().unwrap().len(), 0, "seed {seed}: nothing left waiting");
        }
        fs::remove_dir_all(base).unwrap();
    }
}

/// 把整个数据目录复制到另一处(换电脑最常见的做法),在那里打开。
fn copy_device(from: &Device, base: &Path, name: &str, folder: &Path) -> Device {
    let root = base.join(name);
    let status = std::process::Command::new("cp").arg("-R").arg(&from.root).arg(&root).status().unwrap();
    assert!(status.success());
    let root = fs::canonicalize(&root).unwrap();
    let db = Db::new(root.join("db").join("jobs.db"), root.clone());
    db.init().unwrap();
    let engine = SyncEngine::new(db.clone(), &root, folder, name).unwrap();
    Device { root, db, engine }
}

#[test]
fn a_copied_data_directory_becomes_a_new_device_and_both_keep_syncing() {
    let (base, folder, devices) = setup(&["a"]);
    let a = &devices[0];
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    let a_id = a.engine.device_id().unwrap();
    let copy = copy_device(a, &base, "a-copy", &folder);
    // 复制之后原设备又改了一次(写了新的一段)。
    a.conn().execute("UPDATE documents SET title = 'After copy' WHERE document_id = ?1", params![DOC]).unwrap();
    a.sync();

    let first = copy.sync();
    assert!(first.device_renewed, "{first:?}");
    assert_ne!(copy.engine.device_id().unwrap(), a_id);
    // 原设备复制之后写的那段照样读到。
    assert_eq!(copy.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("After copy"));
    // 两台设备各写各的目录,之后的改动互相都收得到。
    copy.conn().execute("UPDATE documents SET reading_status = 'reading' WHERE document_id = ?1", params![DOC]).unwrap();
    copy.sync();
    a.sync();
    assert_eq!(a.text("SELECT reading_status FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("reading"));
    assert!(!copy.sync().device_renewed);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn switching_to_another_sync_folder_sends_the_whole_library_again() {
    let (base, folder, devices) = setup(&["a"]);
    let a = &devices[0];
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    assert_eq!(a.sync().exported, 3);
    let other = base.join("cloud").join("Another");
    let moved = SyncEngine::new(a.db.clone(), &a.root, &other, "a").unwrap();
    let report = moved.run_cycle().unwrap();
    assert!(report.folder_changed);
    assert_eq!(report.exported, 3, "{report:?}");
    // 同一个文件夹换了路径(比如网盘目录改了名):不算换文件夹。
    let renamed = base.join("cloud").join("Renamed");
    fs::rename(&other, &renamed).unwrap();
    let again = SyncEngine::new(a.db.clone(), &a.root, &renamed, "a").unwrap().run_cycle().unwrap();
    assert!(!again.folder_changed);
    assert_eq!(again.exported, 0);
    let _ = folder;
    fs::remove_dir_all(base).unwrap();
}
