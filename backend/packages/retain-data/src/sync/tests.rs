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

    /// 同步文件夹在 WebDAV 上。
    fn webdav(base: &Path, name: &str, dav: &super::test_dav::TestDav, password: &str) -> Self {
        let root = base.join(name);
        fs::create_dir_all(&root).unwrap();
        let root = fs::canonicalize(&root).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        let engine = SyncEngine::with_backend(db.clone(), &root, webdav_backend(&root, dav, password), name).unwrap();
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

/// 同步文件夹里所有文件包索引里的指纹(每出现一次算一次)。
fn pack_entries(folder: &Path) -> Vec<String> {
    let mut out = Vec::new();
    for device in fs::read_dir(folder.join("devices")).unwrap() {
        let changes = device.unwrap().path().join("changes");
        for segment in fs::read_dir(changes).into_iter().flatten() {
            for line in fs::read_to_string(segment.unwrap().path()).unwrap().lines() {
                let value: serde_json::Value = serde_json::from_str(line).unwrap();
                for entry in value.get("pack").and_then(|p| p.as_array()).into_iter().flatten() {
                    out.push(entry[0].as_str().unwrap().to_string());
                }
            }
        }
    }
    out
}

fn webdav_backend(root: &Path, dav: &super::test_dav::TestDav, password: &str) -> Box<dyn super::Backend> {
    let config = super::WebDavConfig {
        url: dav.url.clone(),
        username: "nas-user".into(),
        password: password.into(),
    };
    Box::new(super::WebDavBackend::new(&config, &root.join("sync-work")).unwrap())
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
    // 同一份原文(上传与任务里各一份)只打包一次。
    let blob = sha256_file(&a.root.join(format!("uploads/{UPLOAD}/book.pdf"))).unwrap();
    assert_eq!(pack_entries(&folder).iter().filter(|sha| **sha == blob).count(), 1);

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
    // 网盘还没把文件包搬过来(改动记录段已经到了)。
    let pack = folder
        .join("devices")
        .join(a.engine.device_id().unwrap())
        .join("packs")
        .join("00000001.pack");
    let hidden = folder.join("hidden-pack");
    fs::rename(&pack, &hidden).unwrap();

    let first = b.sync();
    assert_eq!((first.parked, first.pending), (3, 3), "{first:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 0);
    assert!(!b.root.join(format!("jobs/{JOB}/source/book.pdf")).exists(), "nothing written before all files are there");

    fs::rename(&hidden, &pack).unwrap();
    let second = b.sync();
    assert_eq!((second.applied, second.pending), (3, 0), "{second:?}");
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

#[test]
fn over_webdav_a_book_arrives_with_few_requests_and_edits_merge() {
    let base = std::env::temp_dir().join(format!("retain-sync-dav-{:016x}", fastrand::u64(..)));
    let dav = super::test_dav::TestDav::start(&base.join("server"), "nas-user", "secret");
    let a = Device::webdav(&base, "a", &dav, "secret");
    let b = Device::webdav(&base, "b", &dav, "secret");
    a.add_book(DOC, JOB, UPLOAD, "succeeded");

    let before = dav.count();
    let sent = a.sync();
    let send_requests = dav.count() - before;
    assert_eq!(sent.exported, 3, "{sent:?}");
    // 文件打成一个包:请求数与文件个数无关。
    assert!(send_requests <= 16, "first send took {send_requests} requests");

    let before = dav.count();
    let got = b.sync();
    let receive_requests = dav.count() - before;
    assert_eq!((got.applied, got.pending), (3, 0), "{got:?}");
    assert!(receive_requests <= 16, "first receive took {receive_requests} requests");
    for path in [
        format!("uploads/{UPLOAD}/book.pdf"),
        format!("jobs/{JOB}/translated/page-001.json"),
        format!("jobs/{JOB}/rendered/book-translated.pdf"),
    ] {
        assert_eq!(fs::read(b.root.join(&path)).unwrap(), fs::read(a.root.join(&path)).unwrap(), "{path}");
    }
    // 下载缓存用完即删。
    assert!(fs::read_dir(b.root.join("sync-work")).map_or(true, |mut d| d.next().is_none()));

    // 没有变化的一轮只要几个请求。
    let before = dav.count();
    let idle = a.sync();
    assert_eq!((idle.exported, idle.applied), (0, 0));
    assert!(dav.count() - before <= 4, "idle cycle took {} requests", dav.count() - before);

    a.conn().execute("UPDATE documents SET title = 'Over WebDAV' WHERE document_id = ?1", params![DOC]).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));
    b.conn().execute("UPDATE documents SET reading_status = 'reading' WHERE document_id = ?1", params![DOC]).unwrap();
    a.sync();
    b.sync();
    a.sync();
    for device in [&a, &b] {
        assert_eq!(device.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Over WebDAV"));
        assert_eq!(device.text("SELECT reading_status FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("reading"));
    }
    // 写进 WebDAV 的段文件没有留下临时名。
    let leftovers: Vec<_> = fs::read_dir(dav.root.join("dav/retainpdf/devices").join(a.engine.device_id().unwrap()).join("changes"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
        .filter(|name| name.contains(".tmp-"))
        .collect();
    assert!(leftovers.is_empty(), "{leftovers:?}");
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_wrong_webdav_password_says_so_and_the_probe_checks_read_write_delete() {
    let base = std::env::temp_dir().join(format!("retain-sync-dav-{:016x}", fastrand::u64(..)));
    let dav = super::test_dav::TestDav::start(&base.join("server"), "nas-user", "secret");
    let wrong = Device::webdav(&base, "wrong", &dav, "not-the-password");
    let error = wrong.engine.run_cycle().unwrap_err();
    assert!(format!("{error:#}").contains("账号或密码不对"), "{error:#}");
    let right = Device::webdav(&base, "right", &dav, "secret");
    right.engine.probe().unwrap();
    // 探针不留痕迹。
    let left: Vec<_> = fs::read_dir(dav.root.join("dav/retainpdf")).unwrap().map(|e| e.unwrap().file_name()).collect();
    assert!(left.iter().all(|name| !name.to_string_lossy().starts_with(".probe")), "{left:?}");
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn an_interrupted_webdav_download_resumes_instead_of_starting_over() {
    use std::sync::atomic::Ordering;
    let base = std::env::temp_dir().join(format!("retain-sync-dav-{:016x}", fastrand::u64(..)));
    let dav = super::test_dav::TestDav::start(&base.join("server"), "nas-user", "secret");
    let a = Device::webdav(&base, "a", &dav, "secret");
    let b = Device::webdav(&base, "b", &dav, "secret");
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();

    // 断一次:同一轮里接着下完。
    dav.cut_downloads.store(1, Ordering::SeqCst);
    let got = b.sync();
    assert_eq!((got.applied, got.pending), (3, 0), "{got:?}");
    assert_eq!(dav.ranged.load(Ordering::SeqCst), 1, "the retry continued where it stopped");

    // 一直断:这一轮不报错,改动在等待区;下一轮从已下的部分接着下。
    let c = Device::webdav(&base, "c", &dav, "secret");
    dav.cut_downloads.store(100, Ordering::SeqCst);
    let first = c.sync();
    assert_eq!((first.applied, first.pending), (0, 3), "{first:?}");
    assert_eq!(c.count("SELECT COUNT(*) FROM jobs"), 0);
    dav.cut_downloads.store(0, Ordering::SeqCst);
    let ranged_before = dav.ranged.load(Ordering::SeqCst);
    let second = c.sync();
    assert_eq!((second.applied, second.pending), (3, 0), "{second:?}");
    assert!(dav.ranged.load(Ordering::SeqCst) > ranged_before, "resumed from the partial download");
    assert_eq!(fs::read(c.root.join(format!("jobs/{JOB}/rendered/book-translated.pdf"))).unwrap(), b"%PDF translated");
    // 续传用的半截文件下完就清掉。
    assert!(!c.root.join("sync-work").join("webdav-partial").exists());
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn dropped_webdav_connections_are_retried_within_the_cycle() {
    use std::sync::atomic::Ordering;
    let base = std::env::temp_dir().join(format!("retain-sync-dav-{:016x}", fastrand::u64(..)));
    let dav = super::test_dav::TestDav::start(&base.join("server"), "nas-user", "secret");
    let a = Device::webdav(&base, "a", &dav, "secret");
    let b = Device::webdav(&base, "b", &dav, "secret");
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    // 之后两轮里,各有几个请求连接直接断开:不影响结果。
    a.conn().execute("UPDATE documents SET title = 'Flaky' WHERE document_id = ?1", params![DOC]).unwrap();
    dav.drop_requests.store(2, Ordering::SeqCst);
    let sent = a.engine.run_cycle().expect("a dropped connection is retried");
    assert_eq!(sent.exported, 1);
    dav.drop_requests.store(2, Ordering::SeqCst);
    let got = b.engine.run_cycle().expect("a dropped connection is retried");
    assert_eq!(got.applied, 1);
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Flaky"));
    fs::remove_dir_all(base).unwrap();
}

const CONV: &str = "conv-20261001000000-cccccc";
const CALC: &str = "calc-0000000000000000000000000000000000000001";
const OP: &str = "op-20261001000000-dddddd";

impl Device {
    /// 第三期的内容:术语表、收藏截图、AI 对话、AI 计算、AI 改文档(依附于 add_book 的书)。
    fn add_ai_records(&self, calc_status: &str) -> String {
        let png = b"\x89PNG screenshot";
        let asset = super::folder::hex(&<sha2::Sha256 as sha2::Digest>::digest(png));
        self.write(&format!("assets/{}/{asset}.png", &asset[..2]), png);
        self.write(&format!("agent-calculations/{CALC}/chart-1.svg"), b"<svg/>");
        self.write(&format!("operations/{OP}/attempts/0001/outputs/candidate.pdf"), b"%PDF edited");
        self.write(&format!("operations/{OP}/attempts/0001/program/program.json"), b"{}");
        let conn = self.conn();
        conn.execute_batch(&format!(
            "INSERT INTO glossaries(glossary_id, name, entries_json, created_at, updated_at)
                 VALUES('glossary-1', '化学', '[{{\"source\":\"ligand\",\"target\":\"配体\"}}]', 't', 't');
             INSERT INTO assets(asset_id, mime, bytes, created_at) VALUES('{asset}', 'image/png', 15, 't');
             INSERT INTO favorites(favorite_id, document_id, job_id, page_idx, block_id, kind, quote_text, created_at, updated_at, asset_id)
                 VALUES('fav-1', '{DOC}', '{JOB}', 0, 'b1', 'image', '', 't', 't', '{asset}');
             INSERT INTO ai_conversations(conversation_id, title, document_id, created_at, updated_at, head_id,
                     agent_runtime_id, agent_session_cursor, agent_session_revision, agent_session_updated_at)
                 VALUES('{CONV}', '问配体', '{DOC}', 't', 't', 'm2', 'fx-a', 'session-on-a', 3, 't');
             INSERT INTO ai_messages(message_id, conversation_id, seq, role, content, created_at, parent_id)
                 VALUES('m1', '{CONV}', 1, 'user', '什么是配体?', 't', ''),
                       ('m2', '{CONV}', 2, 'assistant', '配体是……', 't', 'm1');
             INSERT INTO agent_calculation_runs(calculation_id, conversation_id, document_id, tool_name, input_refs_json,
                     input_sha256, status, created_at, updated_at)
                 VALUES('{CALC}', '{CONV}', '{DOC}', 'generate_chart', '{{}}', '{zero}', '{calc_status}', 't', 't');
             INSERT INTO agent_calculation_artifacts(artifact_id, calculation_id, kind, sha256, relative_path, mime_type, size_bytes, created_at)
                 VALUES('chart-1', '{CALC}', 'svg_chart', '{zero}', 'agent-calculations/{CALC}/chart-1.svg', 'image/svg+xml', 6, 't');
             INSERT INTO document_operations(operation_id, conversation_id, document_id, base_job_id, intent_summary,
                     status, current_attempt, created_at, updated_at)
                 VALUES('{OP}', '{CONV}', '{DOC}', '{JOB}', '把图 2 换成中文', 'committed', 1, 't', 't');
             INSERT INTO document_operation_attempts(operation_id, attempt, dispatch_id, program_sha256, manifest_json,
                     state_json, status, created_at, updated_at)
                 VALUES('{OP}', 1, 'dispatch-1', '{zero}', '{{}}', '{{}}', 'committed', 't', 't');
             INSERT INTO document_versions(version_id, document_id, operation_id, source_job_id, artifact_key,
                     content_sha256, status, created_at)
                 VALUES('ver-1', '{DOC}', '{OP}', '{JOB}', 'operations/{OP}/attempts/0001/outputs/candidate.pdf', '{zero}', 'committed', 't');
             UPDATE documents SET active_version_id = 'ver-1' WHERE document_id = '{DOC}';
             INSERT INTO document_metadata_suggestions(suggestion_id, document_id, artifact_sha256, candidates_json,
                     selected_title, created_at, updated_at)
                 VALUES('sug-1', '{DOC}', '{zero}', '[]', 'Book', 't', 't');",
            zero = "0".repeat(64),
        ))
        .unwrap();
        asset
    }
}

#[test]
fn conversations_glossaries_screenshots_and_ai_edits_arrive_but_session_cursors_stay_local() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    let asset = a.add_ai_records("completed");

    let sent = a.sync();
    // 上传、书、任务、收藏、术语表、截图、对话、计算、改文档。
    assert_eq!(sent.exported, 9, "{sent:?}");
    let got = b.sync();
    assert_eq!((got.applied, got.pending), (9, 0), "{got:?}");
    assert_eq!(b.text("SELECT name FROM glossaries WHERE glossary_id = ?1", "glossary-1").as_deref(), Some("化学"));
    assert_eq!(b.text("SELECT asset_id FROM favorites WHERE favorite_id = ?1", "fav-1"), Some(asset.clone()));
    assert_eq!(b.count("SELECT COUNT(*) FROM ai_messages"), 2);
    assert_eq!(b.text("SELECT head_id FROM ai_conversations WHERE conversation_id = ?1", CONV).as_deref(), Some("m2"));
    assert_eq!(b.count("SELECT COUNT(*) FROM agent_calculation_artifacts"), 1);
    assert_eq!(b.count("SELECT COUNT(*) FROM document_operation_attempts"), 1);
    assert_eq!(b.text("SELECT active_version_id FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("ver-1"));
    assert_eq!(b.count("SELECT COUNT(*) FROM document_metadata_suggestions"), 1);
    for path in [
        format!("assets/{}/{asset}.png", &asset[..2]),
        format!("agent-calculations/{CALC}/chart-1.svg"),
        format!("operations/{OP}/attempts/0001/outputs/candidate.pdf"),
        format!("operations/{OP}/attempts/0001/program/program.json"),
    ] {
        assert_eq!(fs::read(b.root.join(&path)).unwrap(), fs::read(a.root.join(&path)).unwrap(), "{path}");
    }
    // AI 接着哪个会话往下聊只在本机有意义:b 上从对话记录重建。
    let session = "SELECT agent_runtime_id || '|' || agent_session_cursor || '|' || agent_session_revision FROM ai_conversations WHERE conversation_id = ?1";
    assert_eq!(b.text(session, CONV).as_deref(), Some("||0"));

    // b 上接着聊(有了自己的会话),a 改了对话标题:b 收到标题,自己的会话不被覆盖;
    // b 的新消息也回到 a,a 的会话同样不动。
    b.conn()
        .execute_batch(&format!(
            "UPDATE ai_conversations SET agent_runtime_id = 'fx-b', agent_session_cursor = 'session-on-b',
                 agent_session_revision = 1, head_id = 'm3' WHERE conversation_id = '{CONV}';
             INSERT INTO ai_messages(message_id, conversation_id, seq, role, content, created_at, parent_id)
                 VALUES('m3', '{CONV}', 3, 'user', '再举个例子', 't', 'm2');"
        ))
        .unwrap();
    a.conn().execute("UPDATE ai_conversations SET title = '配体' WHERE conversation_id = ?1", params![CONV]).unwrap();
    // 只改了会话进度:没有要发的。
    a.conn().execute("UPDATE ai_conversations SET agent_session_revision = 4 WHERE conversation_id = ?1", params![CONV]).unwrap();
    a.sync();
    b.sync();
    a.sync();
    for device in [a, b] {
        assert_eq!(device.text("SELECT title FROM ai_conversations WHERE conversation_id = ?1", CONV).as_deref(), Some("配体"));
        assert_eq!(device.count("SELECT COUNT(*) FROM ai_messages"), 3);
    }
    assert_eq!(a.text(session, CONV).as_deref(), Some("fx-a|session-on-a|4"));
    assert_eq!(b.text(session, CONV).as_deref(), Some("fx-b|session-on-b|1"));

    // 删掉对话:计算随它删掉(文件也删),改文档的操作留着、只是不再指向对话。
    a.conn().execute("DELETE FROM ai_conversations WHERE conversation_id = ?1", params![CONV]).unwrap();
    a.sync();
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM ai_conversations"), 0);
    assert_eq!(b.count("SELECT COUNT(*) FROM agent_calculation_runs"), 0);
    assert!(!b.root.join(format!("agent-calculations/{CALC}")).exists());
    assert_eq!(b.text("SELECT conversation_id FROM document_operations WHERE operation_id = ?1", OP), None);
    assert_eq!(b.count("SELECT COUNT(*) FROM document_versions"), 1);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn unfinished_calculations_and_ai_edits_are_sent_once_they_end() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.add_ai_records("running");
    a.conn().execute("UPDATE document_operations SET status = 'running' WHERE operation_id = ?1", params![OP]).unwrap();
    a.sync();
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM agent_calculation_runs"), 0);
    assert_eq!(b.count("SELECT COUNT(*) FROM document_operations"), 0);

    a.conn().execute("UPDATE agent_calculation_runs SET status = 'completed' WHERE calculation_id = ?1", params![CALC]).unwrap();
    // 出了结果、等人确认:可以在另一台设备上采用。
    a.conn().execute("UPDATE document_operations SET status = 'result_ready' WHERE operation_id = ?1", params![OP]).unwrap();
    a.sync();
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM agent_calculation_runs"), 1);
    assert_eq!(b.text("SELECT status FROM document_operations WHERE operation_id = ?1", OP).as_deref(), Some("result_ready"));
    b.conn().execute("UPDATE document_operations SET status = 'committed' WHERE operation_id = ?1", params![OP]).unwrap();
    b.sync();
    a.sync();
    assert_eq!(a.text("SELECT status FROM document_operations WHERE operation_id = ?1", OP).as_deref(), Some("committed"));
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_device_that_synced_before_phase_three_sends_its_existing_conversations() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.add_ai_records("completed");
    // 模拟第三期之前:这些表没有触发器(改动没记下),登记标记还是旧写法。
    a.conn()
        .execute_batch("DELETE FROM sync_dirty WHERE kind NOT IN ('upload', 'document', 'job', 'favorite');")
        .unwrap();
    a.db.sync_state_set("seeded", "1").unwrap();
    let sent = a.sync();
    assert_eq!(sent.exported, 9, "{sent:?}");
    let got = b.sync();
    assert_eq!((got.applied, got.pending), (9, 0), "{got:?}");
    assert_eq!(b.count("SELECT COUNT(*) FROM ai_messages"), 2);
    // 登记过一次就不再重来。
    assert_eq!(a.sync().exported, 0);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_kind_this_version_does_not_know_waits_instead_of_being_dropped() {
    let (base, folder, devices) = setup(&["a", "b"]);
    let b = &devices[1];
    b.sync();
    let device = "00000000000000ee";
    let changes = folder.join("devices").join(device).join("changes");
    fs::create_dir_all(&changes).unwrap();
    let future = serde_json::json!({
        "kind": "reading_note", "key": "note-1", "clock": "1790000000000-000000-00000000000000ee", "device": device,
        "rows": {"reading_notes": [{"note_id": "note-1"}]}, "files": []
    });
    fs::write(changes.join("00000001.jsonl"), format!("{future}\n{{\"segment_end\":1}}\n")).unwrap();
    let got = b.sync();
    assert_eq!((got.rejected, got.parked, got.pending), (0, 1, 1), "{got:?}");
    let (_, pending) = b.db.sync_pending_summary(5).unwrap();
    assert!(pending[0].reason.contains("newer version"), "{pending:?}");
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn restoring_an_old_backup_takes_back_what_was_synced_since_and_does_not_push_old_content() {
    let (base, _folder, devices) = setup(&["a", "b"]);
    let (a, b) = (&devices[0], &devices[1]);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    let backup = a.db.create_backup(crate::db::backup::KIND_MANUAL).unwrap();
    let old_device = a.engine.device_id().unwrap();

    // 备份之后:a 改了书名(已同步出去),b 改了阅读状态,a 又加了一张术语表(没来得及同步)。
    a.conn().execute("UPDATE documents SET title = 'Edited after backup' WHERE document_id = ?1", params![DOC]).unwrap();
    a.sync();
    b.conn().execute("UPDATE documents SET reading_status = 'reading' WHERE document_id = ?1", params![DOC]).unwrap();
    b.sync();
    a.conn()
        .execute("INSERT INTO glossaries(glossary_id, name, entries_json, created_at, updated_at) VALUES('g-late', 'x', '[]', 't', 't')", [])
        .unwrap();

    assert_eq!(a.db.restore_backup(&backup.id).unwrap(), Ok(()));
    assert_eq!(a.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Book"));
    assert_eq!(a.count("SELECT COUNT(*) FROM sync_dirty"), 0);

    let back = a.sync();
    // 恢复出来的旧内容一条都不发;换了新设备号,原来的设备号当别的设备从头读。
    assert_eq!(back.exported, 0, "{back:?}");
    assert_ne!(a.engine.device_id().unwrap(), old_device);
    b.sync();
    for device in [a, b] {
        assert_eq!(device.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Edited after backup"));
        assert_eq!(device.text("SELECT reading_status FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("reading"));
    }
    // 没同步出去的改动随恢复没了(这就是恢复的意思)。
    assert_eq!(a.count("SELECT COUNT(*) FROM glossaries"), 0);
    // 恢复后照常同步:a 的新改动发得出去。
    a.conn().execute("UPDATE documents SET title = 'After restore' WHERE document_id = ?1", params![DOC]).unwrap();
    assert_eq!(a.sync().exported, 1);
    b.sync();
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("After restore"));
    fs::remove_dir_all(base).unwrap();
}

// ---------------------------------------------------------------- 整理同步文件夹

/// 每轮都整理、停用的包下一轮就能删、攒 4 段就整理改动记录(真实默认:每天、7 天、64 段)。
fn eager() -> super::MaintenancePolicy {
    super::MaintenancePolicy {
        every: chrono::Duration::zero(),
        compact_after_segments: 4,
        retire_grace: chrono::Duration::zero(),
        repack_below: 0.5,
        refresh_states: chrono::Duration::zero(),
    }
}

impl Device {
    fn with_policy(base: &Path, name: &str, folder: &Path, policy: super::MaintenancePolicy) -> Self {
        let mut device = Self::new(base, name, folder);
        device.engine = SyncEngine::new(device.db.clone(), &device.root, folder, name).unwrap().with_policy(policy);
        device
    }

    fn tidy(base: &Path, name: &str, folder: &Path) -> Self {
        Self::with_policy(base, name, folder, eager())
    }

    /// 默认节奏,只是每轮都重读各设备的整理状态(真实情况下最多晚十分钟)。
    fn watchful(base: &Path, name: &str, folder: &Path) -> Self {
        let policy = super::MaintenancePolicy { refresh_states: chrono::Duration::zero(), ..Default::default() };
        Self::with_policy(base, name, folder, policy)
    }

    fn dir_in(&self, folder: &Path, sub: &str) -> Vec<String> {
        let dir = folder.join("devices").join(self.engine.device_id().unwrap()).join(sub);
        let mut names: Vec<String> = fs::read_dir(dir)
            .map(|d| d.map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect())
            .unwrap_or_default();
        names.sort();
        names
    }
}

fn format_version(folder: &Path) -> (u64, String) {
    let value: serde_json::Value = serde_json::from_slice(&fs::read(folder.join("format.json")).unwrap()).unwrap();
    (value["version"].as_u64().unwrap(), value["folder_id"].as_str().unwrap().to_string())
}

#[test]
fn compaction_keeps_the_latest_records_and_late_or_new_devices_catch_up_from_the_base() {
    let (base, folder, devices) = setup(&["b"]);
    let b = &devices[0];
    let lagging = &Device::watchful(&base, "lagging", &folder);
    // 格式 2 的文件夹:整理前照常用,整理时升到 3,文件夹编号不变。
    fs::write(folder.join("format.json"), br#"{"format":"retain-pdf-sync","version":2,"folder_id":"00000000000000aa"}"#).unwrap();
    let a = Device::tidy(&base, "a", &folder);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    lagging.sync();
    for i in 0..6 {
        a.conn().execute("UPDATE documents SET title = ?1 WHERE document_id = ?2", params![format!("Title {i}"), DOC]).unwrap();
        let report = a.sync();
        if i < 2 {
            assert!(!report.maintained || report.segments_compacted == 0, "{report:?}");
        }
    }
    let state: serde_json::Value = serde_json::from_slice(
        &fs::read(folder.join("devices").join(a.engine.device_id().unwrap()).join("state.json")).unwrap(),
    )
    .unwrap();
    let new_base = state["base"].as_u64().unwrap();
    assert!(new_base > 1, "{state}");
    assert_eq!(format_version(&folder), (3, "00000000000000aa".to_string()));
    // 之前的段删了;留下的段里每个实体只有最后一条。
    let segments = a.dir_in(&folder, "changes");
    assert!(segments.iter().all(|name| name.as_str() >= format!("{new_base:08}.jsonl").as_str()), "{segments:?}");
    let records: Vec<String> = segments
        .iter()
        .flat_map(|name| {
            fs::read_to_string(folder.join("devices").join(a.engine.device_id().unwrap()).join("changes").join(name))
                .unwrap()
                .lines()
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|line| line.contains("\"kind\""))
        .collect();
    assert_eq!(records.iter().filter(|l| l.contains("\"kind\":\"document\"")).count(), 1, "{records:?}");

    // 从没同步过的设备、读到一半的设备都跟得上:书名是最后的,文件都在。
    for device in [b, lagging] {
        let got = device.sync();
        assert_eq!(got.pending, 0, "{got:?}");
        assert_eq!(device.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Title 5"));
        assert_eq!(
            fs::read(device.root.join(format!("jobs/{JOB}/rendered/book-translated.pdf"))).unwrap(),
            b"%PDF translated"
        );
    }
    // 整理之后照常同步。
    a.conn().execute("UPDATE documents SET title = 'After compaction' WHERE document_id = ?1", params![DOC]).unwrap();
    a.sync();
    b.sync();
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("After compaction"));
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_deleted_books_pack_is_retired_then_deleted_and_space_comes_back() {
    let (base, folder, devices) = setup(&["b"]);
    let b = &devices[0];
    let a = Device::tidy(&base, "a", &folder);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    let packs = a.dir_in(&folder, "packs");
    assert_eq!(packs.len(), 1);

    let conn = a.conn();
    conn.execute("DELETE FROM jobs WHERE job_id = ?1", params![JOB]).unwrap();
    conn.execute("DELETE FROM documents WHERE document_id = ?1", params![DOC]).unwrap();
    conn.execute("DELETE FROM uploads WHERE upload_id = ?1", params![UPLOAD]).unwrap();
    let first = a.sync();
    // 先登记停用,包还在(给别的设备时间看到)。
    assert_eq!((first.packs_retired, first.packs_deleted), (1, 0), "{first:?}");
    assert_eq!(a.dir_in(&folder, "packs"), packs);
    b.sync();
    assert_eq!(b.count("SELECT COUNT(*) FROM documents"), 0);
    let second = a.sync();
    assert_eq!(second.packs_deleted, 1, "{second:?}");
    assert!(second.bytes_freed > 0);
    assert!(a.dir_in(&folder, "packs").is_empty());
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_device_needing_content_from_a_retired_pack_uploads_its_own_copy() {
    let (base, folder, devices) = setup(&["c"]);
    let c = &devices[0];
    let b = &Device::watchful(&base, "b", &folder);
    let a = Device::tidy(&base, "a", &folder);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    b.sync();
    // a 删了书(包停用);b 又上传了同一个 PDF。
    let conn = a.conn();
    conn.execute("DELETE FROM jobs WHERE job_id = ?1", params![JOB]).unwrap();
    conn.execute("DELETE FROM documents WHERE document_id = ?1", params![DOC]).unwrap();
    conn.execute("DELETE FROM uploads WHERE upload_id = ?1", params![UPLOAD]).unwrap();
    assert_eq!(a.sync().packs_retired, 1);
    let again = "20261001000000-cccccc";
    b.write(&format!("uploads/{again}/book.pdf"), b"%PDF source");
    b.conn()
        .execute(
            "INSERT INTO uploads(upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash)
             VALUES(?1, 'book.pdf', ?2, 11, 3, '2026-10-02T00:00:00Z', 0, '')",
            params![again, format!("uploads/{again}/book.pdf")],
        )
        .unwrap();
    let sent = b.sync();
    // a 的包停用了:不往里引用,自己传一份。
    assert_eq!(sent.blobs_uploaded, 1, "{sent:?}");
    // a 删掉旧包;新设备照样拿到这个 PDF。
    a.sync();
    assert!(a.dir_in(&folder, "packs").is_empty());
    let got = c.sync();
    assert_eq!(got.pending, 0, "{got:?}");
    assert_eq!(fs::read(c.root.join(format!("uploads/{again}/book.pdf"))).unwrap(), b"%PDF source");
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_mostly_unused_pack_is_repacked_and_everyone_still_gets_the_live_files() {
    let (base, folder, devices) = setup(&["b", "c"]);
    let (b, c) = (&devices[0], &devices[1]);
    let a = Device::tidy(&base, "a", &folder);
    // 成品 PDF 很大:重新渲染后旧的那份占了包的大半。
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.write(&format!("jobs/{JOB}/rendered/book-translated.pdf"), &vec![b'x'; 200_000]);
    a.sync();
    b.sync();
    a.write(&format!("jobs/{JOB}/rendered/book-translated.pdf"), b"%PDF rerendered");
    a.conn().execute("UPDATE jobs SET updated_at = 'later' WHERE job_id = ?1", params![JOB]).unwrap();
    let first = a.sync();
    assert_eq!(first.packs_retired, 1, "{first:?}");
    assert!(first.bytes_repacked > 0 && first.bytes_repacked < 1_000, "only the small live files: {first:?}");
    // 读得落后的 b、从没同步过的 c:都拿得到在用的文件。
    let second = a.sync();
    assert_eq!(second.packs_deleted, 1, "{second:?}");
    assert!(second.bytes_freed > 200_000);
    for device in [b, c] {
        let got = device.sync();
        assert_eq!(got.pending, 0, "{got:?}");
        for path in [
            format!("uploads/{UPLOAD}/book.pdf"),
            format!("jobs/{JOB}/ocr/normalized/document.v1.json"),
            format!("jobs/{JOB}/rendered/book-translated.pdf"),
        ] {
            assert_eq!(fs::read(device.root.join(&path)).unwrap(), fs::read(a.root.join(&path)).unwrap(), "{path}");
        }
    }
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn a_device_from_before_format_three_compacts_by_reading_its_own_segments() {
    let (base, folder, devices) = setup(&["b"]);
    let b = &devices[0];
    let mut a = Device::new(&base, "a", &folder);
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.sync();
    for i in 0..5 {
        a.conn().execute("UPDATE documents SET title = ?1 WHERE document_id = ?2", params![format!("Old {i}"), DOC]).unwrap();
        a.sync();
    }
    // 那时还不记「每个实体最后一条在哪一段」。
    a.db.sync_clear_own_records().unwrap();
    a.engine = SyncEngine::new(a.db.clone(), &a.root, &folder, "a").unwrap().with_policy(eager());
    let report = a.sync();
    assert!(report.segments_compacted >= 4, "{report:?}");
    assert_eq!(a.dir_in(&folder, "changes").len(), 1);
    b.sync();
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Old 4"));
    assert_eq!(b.count("SELECT COUNT(*) FROM jobs"), 1);
    fs::remove_dir_all(base).unwrap();
}

#[test]
fn over_webdav_compaction_and_pack_deletion_work_and_a_new_device_still_gets_everything() {
    let base = std::env::temp_dir().join(format!("retain-sync-dav-tidy-{:016x}", fastrand::u64(..)));
    let dav = super::test_dav::TestDav::start(&base.join("server"), "nas-user", "secret");
    let mut a = Device::webdav(&base, "a", &dav, "secret");
    a.engine = SyncEngine::with_backend(a.db.clone(), &a.root, webdav_backend(&a.root, &dav, "secret"), "a")
        .unwrap()
        .with_policy(eager());
    a.add_book(DOC, JOB, UPLOAD, "succeeded");
    a.write(&format!("jobs/{JOB}/rendered/book-translated.pdf"), &vec![b'x'; 100_000]);
    a.sync();
    a.write(&format!("jobs/{JOB}/rendered/book-translated.pdf"), b"%PDF rerendered");
    a.conn().execute("UPDATE jobs SET updated_at = 'later' WHERE job_id = ?1", params![JOB]).unwrap();
    for i in 0..5 {
        a.conn().execute("UPDATE documents SET title = ?1 WHERE document_id = ?2", params![format!("Dav {i}"), DOC]).unwrap();
        a.sync();
    }
    let root = dav.root.join("dav/retainpdf/devices").join(a.engine.device_id().unwrap());
    let packs: Vec<_> = fs::read_dir(root.join("packs")).unwrap().collect();
    // 大的旧成品 PDF 所在的包重新打包后删掉了。
    let total: u64 = packs.iter().map(|p| p.as_ref().unwrap().metadata().unwrap().len()).sum();
    assert!(total < 50_000, "old pack still there: {total} bytes");
    let b = Device::webdav(&base, "b", &dav, "secret");
    let got = b.sync();
    assert_eq!(got.pending, 0, "{got:?}");
    assert_eq!(b.text("SELECT title FROM documents WHERE document_id = ?1", DOC).as_deref(), Some("Dav 4"));
    assert_eq!(fs::read(b.root.join(format!("jobs/{JOB}/rendered/book-translated.pdf"))).unwrap(), b"%PDF rerendered");
    assert_eq!(fs::read(b.root.join(format!("uploads/{UPLOAD}/book.pdf"))).unwrap(), b"%PDF source");
    fs::remove_dir_all(base).unwrap();
}
