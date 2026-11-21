use std::fs;
use std::path::PathBuf;

use rusqlite::params;

use super::*;
use crate::models::api::FtsBlockRow;
use crate::models::domain::{now_iso, JobStatusKind, UploadRecord, WorkflowKind};

struct TestDbFs {
    root: PathBuf,
    data_root: PathBuf,
    db_path: PathBuf,
}

impl TestDbFs {
    fn new(test_name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "rust-api-db-documents-{test_name}-{}",
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        let db_path = root.join("db").join("jobs.db");
        fs::create_dir_all(&data_root).expect("create data root");
        fs::create_dir_all(db_path.parent().expect("db parent")).expect("create db dir");
        Self {
            root,
            data_root,
            db_path,
        }
    }

    fn db(&self) -> Db {
        Db::new(self.db_path.clone(), self.data_root.clone())
    }
}

impl Drop for TestDbFs {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn upload_with_hash(upload_id: &str, hash: &str) -> UploadRecord {
    UploadRecord {
        upload_id: upload_id.to_string(),
        filename: "paper.pdf".to_string(),
        stored_path: "uploads/x/paper.pdf".to_string(),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: hash.to_string(),
    }
}


fn insert_succeeded_job(
    db: &Db,
    document_id: &str,
    job_id: &str,
    workflow: WorkflowKind,
    finished_at: &str,
) {
    let conn = db.connect().expect("connect");
    conn.execute(
        r#"
        INSERT INTO jobs (
            job_id, workflow, status, created_at, updated_at, finished_at,
            command_json, request_json, log_tail_json, document_id
        ) VALUES (?1, ?2, ?3, ?4, ?4, ?4, '[]', '{}', '[]', ?5)
        "#,
        params![
            job_id,
            workflow.as_str(),
            JobStatusKind::Succeeded.as_str(),
            finished_at,
            document_id,
        ],
    )
    .expect("insert succeeded job");
}

fn seed_document(db: &Db, upload_id: &str, bytes: &[u8]) -> String {
    let document_id = sha256_hex(bytes);
    let upload = upload_with_hash(upload_id, &document_id);
    db.save_upload(&upload).expect("save upload");
    db.upsert_document_from_upload(&upload)
        .expect("upsert document");
    document_id
}

#[test]
fn versioned_migrations_are_idempotent() {
    let fs = TestDbFs::new("migrations");
    let db = fs.db();
    db.init().expect("first init");
    db.init().expect("second init");
    let conn = rusqlite::Connection::open(&fs.db_path).expect("open");
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .expect("user_version");
    // 与迁移阶梯动态同步（写死数字曾在 v3 加入后过期红了一轮）
    assert_eq!(version, crate::db::schema::versioned_migration_count());
}

#[test]
fn same_content_hash_upserts_single_document() {
    let fs = TestDbFs::new("dedupe");
    let db = fs.db();
    db.init().expect("init");
    let hash = sha256_hex(b"same pdf bytes");
    // 生产路径:save_upload 先于 upsert_document(列表过滤依赖 upload 存在)
    let up1 = upload_with_hash("up-1", &hash);
    db.save_upload(&up1).expect("save up-1");
    db.upsert_document_from_upload(&up1).expect("first upsert");
    let up2 = upload_with_hash("up-2", &hash);
    db.save_upload(&up2).expect("save up-2");
    db.upsert_document_from_upload(&up2).expect("second upsert");
    let documents = db
        .list_documents(10, 0, None, None, None)
        .expect("list documents");
    assert_eq!(documents.len(), 1);
    assert_eq!(documents[0].document_id, hash);
    assert_eq!(documents[0].title, "paper");
}

#[test]
fn reconcile_active_job_prefers_non_ocr_success_over_newer_ocr_job() {
    let fs = TestDbFs::new("reconcile-prefers-non-ocr");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-reconcile", b"reconcile workflow priority");
    insert_succeeded_job(
        &db,
        &document_id,
        "job-book",
        WorkflowKind::Book,
        "2026-01-01T00:00:00Z",
    );
    insert_succeeded_job(
        &db,
        &document_id,
        "job-ocr",
        WorkflowKind::Ocr,
        "2026-02-01T00:00:00Z",
    );
    db.set_document_active_job(&document_id, "job-missing", None)
        .expect("set stale active job");

    db.reconcile_document_active_job(&document_id)
        .expect("reconcile active job");

    let document = db.get_document(&document_id).expect("get document");
    assert_eq!(document.active_job_id.as_deref(), Some("job-book"));

    db.delete_job("job-book").expect("delete book job");
    db.reconcile_document_active_job(&document_id)
        .expect("fallback reconcile to ocr");
    let document = db.get_document(&document_id).expect("get document");
    assert_eq!(document.active_job_id.as_deref(), Some("job-ocr"));
}

#[test]
fn active_job_backfill_prefers_non_ocr_success_over_newer_ocr_job() {
    let fs = TestDbFs::new("backfill-prefers-non-ocr");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-backfill", b"backfill workflow priority");
    insert_succeeded_job(
        &db,
        &document_id,
        "job-book",
        WorkflowKind::Book,
        "2026-01-01T00:00:00Z",
    );
    insert_succeeded_job(
        &db,
        &document_id,
        "job-ocr",
        WorkflowKind::Ocr,
        "2026-02-01T00:00:00Z",
    );

    backfill::backfill_active_jobs(&db).expect("backfill active jobs");

    let document = db.get_document(&document_id).expect("get document");
    assert_eq!(document.active_job_id.as_deref(), Some("job-book"));
}

#[test]
fn backfill_links_artifact_reuse_job_and_refreshes_active_job() {
    let fs = TestDbFs::new("backfill-artifact-reuse-link");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-artifact-source", b"artifact reuse source");
    insert_succeeded_job(
        &db,
        &document_id,
        "job-ocr-source",
        WorkflowKind::Ocr,
        "2026-01-01T00:00:00Z",
    );
    let conn = db.connect().expect("connect");
    conn.execute(
        r#"
        INSERT INTO jobs (
            job_id, workflow, status, created_at, updated_at, finished_at,
            command_json, request_json, log_tail_json
        ) VALUES (?1, ?2, ?3, ?4, ?4, ?4, '[]', ?5, '[]')
        "#,
        params![
            "job-translation-reuse",
            WorkflowKind::Translate.as_str(),
            JobStatusKind::Succeeded.as_str(),
            "2026-02-01T00:00:00Z",
            serde_json::json!({
                "source": {"artifact_job_id": "job-ocr-source"}
            })
            .to_string(),
        ],
    )
    .expect("insert artifact reuse job");
    drop(conn);
    db.set_document_active_job(&document_id, "job-ocr-source", None)
        .expect("set old active job");

    backfill::run(&db).expect("run library backfill");

    let linked_document = db
        .get_document_by_job_id("job-translation-reuse")
        .expect("lookup linked document")
        .expect("artifact reuse job should be linked");
    assert_eq!(linked_document.document_id, document_id);
    let document = db.get_document(&document_id).expect("get document");
    assert_eq!(
        document.active_job_id.as_deref(),
        Some("job-translation-reuse")
    );
}

#[test]
fn fts_rows_use_exact_asset_caption_for_empty_image_block() {
    let fs = TestDbFs::new("fts-asset-caption");
    let job_root = fs.root.join("job-asset-caption");
    let normalized = job_root.join("ocr/normalized/document.v1.json");
    std::fs::create_dir_all(normalized.parent().expect("normalized parent"))
        .expect("normalized dir");
    std::fs::write(
        &normalized,
        serde_json::to_vec(&serde_json::json!({
            "assets": {
                "asset-figure": {
                    "uri": "md/images/page-1/imgs/figure.png",
                    "caption": "Absorption spectrum under applied field"
                }
            },
            "pages": [{
                "page_index": 0,
                "blocks": [{
                    "block_id": "p001-b0004",
                    "text": "",
                    "type": "image",
                    "content": {
                        "kind": "image",
                        "asset_ids": ["asset-figure"]
                    }
                }]
            }]
        }))
        .expect("normalized json"),
    )
    .expect("write normalized");

    let rows = build_fts_rows_from_job_dir(&job_root).expect("build fts rows");

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].block_id, "p001-b0004");
    assert_eq!(
        rows[0].source_text,
        "Absorption spectrum under applied field"
    );
}

#[test]
fn fts_trigram_matches_chinese_and_short_query_falls_back() {
    let fs = TestDbFs::new("fts");
    let db = fs.db();
    db.init().expect("init");
    let hash = sha256_hex(b"fts doc");
    db.upsert_document_from_upload(&upload_with_hash("up-1", &hash))
        .expect("upsert");
    db.replace_document_fts(
        &hash,
        "job-1",
        &[FtsBlockRow {
            page_idx: 2,
            block_id: "p003-b0001".to_string(),
            source_text: "vibrationally resolved optical spectra".to_string(),
            translated_text: "振动分辨光学光谱的有效计算方法".to_string(),
        }],
    )
    .expect("fts insert");
    let hits = db.search_blocks("光学光谱", 10, None).expect("search zh");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].document_id, hash);
    assert_eq!(hits[0].page_idx, 2);
    assert_eq!(hits[0].block_id, "p003-b0001");
    // 2 字符查询走 LIKE 回退
    let short_hits = db.search_blocks("光谱", 10, None).expect("search short");
    assert_eq!(short_hits.len(), 1);
    // 单文档过滤：不存在的 document_id 应无命中
    let scoped_miss = db
        .search_blocks("光学光谱", 10, Some("no-such-doc"))
        .expect("search scoped miss");
    assert!(scoped_miss.is_empty());
    let scoped_hit = db
        .search_blocks("光学光谱", 10, Some(&hash))
        .expect("search scoped hit");
    assert_eq!(scoped_hit.len(), 1);
    // 重建幂等:再次替换后仍只有一行
    db.replace_document_fts(
        &hash,
        "job-2",
        &[FtsBlockRow {
            page_idx: 2,
            block_id: "p003-b0001".to_string(),
            source_text: "updated".to_string(),
            translated_text: "更新后的光学光谱".to_string(),
        }],
    )
    .expect("fts rebuild");
    let rebuilt = db
        .search_blocks("光学光谱", 10, None)
        .expect("search rebuilt");
    assert_eq!(rebuilt.len(), 1);
    assert_eq!(rebuilt[0].job_id, "job-2");
}

#[test]
fn update_document_fields_manages_tags_and_status() {
    let fs = TestDbFs::new("patch");
    let db = fs.db();
    db.init().expect("init");
    let hash = sha256_hex(b"patch doc");
    let up = upload_with_hash("up-1", &hash);
    db.save_upload(&up).expect("save upload");
    db.upsert_document_from_upload(&up).expect("upsert");
    let updated = db
        .update_document_fields(
            &hash,
            Some("光谱计算方法综述"),
            Some("reading"),
        )
        .expect("patch");
    assert_eq!(updated.title, "光谱计算方法综述");
    assert_eq!(updated.reading_status, "reading");
}

/// 建一篇文档并设好标题：`upload_with_hash` 的文件名是写死的，
/// 文本搜索要同时验标题列与文件名列，所以这里让调用方两者都能指定。
fn seed_titled_document(
    db: &crate::db::Db,
    seed: &str,
    filename: &str,
    title: Option<&str>,
) -> String {
    let hash = sha256_hex(seed.as_bytes());
    let mut upload = upload_with_hash(&format!("up-{seed}"), &hash);
    upload.filename = filename.to_string();
    upload.stored_path = format!("uploads/x/{filename}");
    db.save_upload(&upload).expect("save upload");
    db.upsert_document_from_upload(&upload).expect("upsert");
    if let Some(title) = title {
        db.update_document_fields(&hash, Some(title), None)
            .expect("set title");
    }
    hash
}

#[test]
fn document_text_search_matches_title_or_filename() {
    let fs = TestDbFs::new("doc-search");
    let db = fs.db();
    db.init().expect("init");
    seed_titled_document(&db, "a", "spectra.pdf", Some("光谱计算方法综述"));
    seed_titled_document(
        &db,
        "b",
        "attention-is-all-you-need.pdf",
        Some("Attention Is All You Need"),
    );
    seed_titled_document(&db, "c", "misc.pdf", Some("无关文档"));

    // 标题命中
    let by_title = db
        .list_documents(10, 0, None, None, Some("光谱"))
        .expect("search by title");
    assert_eq!(by_title.len(), 1);
    assert_eq!(by_title[0].title, "光谱计算方法综述");

    // 文件名命中（标题里没有 "attention" 之外的线索时，文件名也应算）
    let by_filename = db
        .list_documents(10, 0, None, None, Some("all-you-need"))
        .expect("search by filename");
    assert_eq!(by_filename.len(), 1);

    // 大小写不敏感（SQLite LIKE 对 ASCII 默认不敏感）
    let case_insensitive = db
        .list_documents(10, 0, None, None, Some("ATTENTION"))
        .expect("search case-insensitive");
    assert_eq!(case_insensitive.len(), 1);

    // count 与 list 用同一套过滤
    assert_eq!(
        db.count_documents(None, None, Some("光谱"))
            .expect("count"),
        1
    );

    // 无命中
    let miss = db
        .list_documents(10, 0, None, None, Some("不存在的词"))
        .expect("search miss");
    assert!(miss.is_empty());
}

#[test]
fn document_text_search_escapes_like_wildcards() {
    // 不转义的话，标题里的 % 和 _ 会被当通配符：搜 "50%" 会命中一切。
    let fs = TestDbFs::new("doc-search-escape");
    let db = fs.db();
    db.init().expect("init");
    seed_titled_document(&db, "pct", "a.pdf", Some("压缩率 50% 报告"));
    seed_titled_document(&db, "plain", "b.pdf", Some("压缩率 5099 报告"));
    seed_titled_document(&db, "under", "c.pdf", Some("run_id 说明"));
    seed_titled_document(&db, "nounder", "d.pdf", Some("runXid 说明"));

    let percent = db
        .list_documents(10, 0, None, None, Some("50%"))
        .expect("search percent");
    assert_eq!(percent.len(), 1, "% 必须当字面量，不能匹配 5099");
    assert_eq!(percent[0].title, "压缩率 50% 报告");

    let underscore = db
        .list_documents(10, 0, None, None, Some("run_id"))
        .expect("search underscore");
    assert_eq!(underscore.len(), 1, "_ 必须当字面量，不能匹配 runXid");
    assert_eq!(underscore[0].title, "run_id 说明");
}

#[test]
fn document_text_search_combines_with_other_filters() {
    let fs = TestDbFs::new("doc-search-combo");
    let db = fs.db();
    db.init().expect("init");
    let reading = sha256_hex(b"combo-reading");
    let mut up = upload_with_hash("up-combo-1", &reading);
    up.filename = "spectra-a.pdf".to_string();
    db.save_upload(&up).expect("save");
    db.upsert_document_from_upload(&up).expect("upsert");
    db.update_document_fields(&reading, Some("光谱 A"), Some("reading"))
        .expect("patch a");

    let unread = sha256_hex(b"combo-unread");
    let mut up2 = upload_with_hash("up-combo-2", &unread);
    up2.filename = "spectra-b.pdf".to_string();
    db.save_upload(&up2).expect("save");
    db.upsert_document_from_upload(&up2).expect("upsert");
    db.update_document_fields(&unread, Some("光谱 B"), Some("unread"))
        .expect("patch b");

    // 两篇都含「光谱」，但只有一篇是 reading
    let both = db
        .list_documents(10, 0, None, None, Some("光谱"))
        .expect("search only");
    assert_eq!(both.len(), 2);

    let narrowed = db
        .list_documents(10, 0, Some("reading"), None, Some("光谱"))
        .expect("search + status");
    assert_eq!(narrowed.len(), 1);
    assert_eq!(narrowed[0].title, "光谱 A");

    assert_eq!(
        db.count_documents(Some("reading"), None, Some("光谱"))
            .expect("count combined"),
        1
    );
}

#[test]
fn document_text_search_ignores_blank_query() {
    // 空串/纯空白不应变成 "%%" 把全库当命中——它应当等价于「不过滤」。
    let fs = TestDbFs::new("doc-search-blank");
    let db = fs.db();
    db.init().expect("init");
    seed_titled_document(&db, "x", "x.pdf", Some("甲"));
    seed_titled_document(&db, "y", "y.pdf", Some("乙"));

    let none = db
        .list_documents(10, 0, None, None, None)
        .expect("no query");
    let blank = db
        .list_documents(10, 0, None, None, Some("   "))
        .expect("blank query");
    assert_eq!(none.len(), 2);
    assert_eq!(blank.len(), none.len(), "空白查询应等价于不过滤");
}

// ── 整本书的索引：多次范围翻译 ─────────────────────────────────────────────

fn fts_candidate(job_id: &str, created_at: &str, ocr: &[u32], translated: &[u32]) -> FtsCandidate {
    FtsCandidate {
        job_id: job_id.to_string(),
        created_at: created_at.to_string(),
        ocr_pages: ocr.to_vec(),
        translated_pages: translated.to_vec(),
    }
}

#[test]
fn fts_page_owner_prefers_the_newest_job_that_translated_the_page() {
    let owners = fts_page_owners(&[
        fts_candidate("whole", "2026-10-01T00:00:00", &[1, 2, 3], &[1, 2, 3]),
        fts_candidate("redo", "2026-10-02T00:00:00", &[2], &[2]),
    ]);
    assert_eq!(owners.into_iter().collect::<Vec<_>>(), vec![(1, 0), (2, 1), (3, 0)]);
}

#[test]
fn fts_page_owner_never_lets_a_newer_untranslated_ocr_hide_an_older_translation() {
    // 后来又 OCR 了一次（没翻译）：这页的译文不能因此搜不到。
    let owners = fts_page_owners(&[
        fts_candidate("translated", "2026-10-01T00:00:00", &[1, 2], &[1, 2]),
        fts_candidate("ocr-only", "2026-10-05T00:00:00", &[1, 2, 3], &[]),
    ]);
    assert_eq!(owners.into_iter().collect::<Vec<_>>(), vec![(1, 0), (2, 0), (3, 1)]);
}

#[test]
fn fts_page_owner_breaks_same_second_ties_by_job_id() {
    let owners = fts_page_owners(&[
        fts_candidate("job-b", "2026-10-01T00:00:00", &[1], &[1]),
        fts_candidate("job-a", "2026-10-01T00:00:00", &[1], &[1]),
    ]);
    assert_eq!(owners.get(&1), Some(&0));
}

/// 一个子集 OCR 的范围翻译任务：页号全是本地的；`ocr_dir_job` 不同于自己时就是复用 OCR
/// （自己的 job_root 下没有 ocr/）。
fn seed_fts_job(
    db: &Db,
    data_root: &std::path::Path,
    document_id: &str,
    job_id: &str,
    created_at: &str,
    ocr_dir_job: &str,
    ocr_pages: &[u32],
    texts: &[(&str, &str)],
) {
    let normalized = data_root.join("jobs").join(ocr_dir_job).join("ocr/normalized/document.v1.json");
    fs::create_dir_all(normalized.parent().unwrap()).unwrap();
    let pages: Vec<_> = texts
        .iter()
        .enumerate()
        .map(|(local, (source, _))| serde_json::json!({
            "page_index": local,
            "blocks": [{ "block_id": format!("p{:03}-b0000", local + 1), "text": source }],
        }))
        .collect();
    fs::write(&normalized, serde_json::json!({ "pages": pages }).to_string()).unwrap();
    let translated = data_root.join("jobs").join(job_id).join("translated");
    fs::create_dir_all(&translated).unwrap();
    for (local, (_, target)) in texts.iter().enumerate() {
        fs::write(
            translated.join(format!("page-{:03}-deepseek.json", local + 1)),
            serde_json::json!([{ "page_idx": local, "block_idx": 0, "translated_text": target }]).to_string(),
        )
        .unwrap();
    }
    let mut job = crate::models::domain::JobSnapshot::new(
        job_id.to_string(),
        crate::models::request::CreateJobInput::default(),
        vec![],
    );
    job.status = JobStatusKind::Succeeded;
    job.workflow = WorkflowKind::Book;
    job.created_at = created_at.to_string();
    job.request_payload.translation.start_page = 0;
    job.request_payload.translation.end_page = -1;
    job.artifacts = Some(crate::models::domain::JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        normalized_document_json: Some(format!("jobs/{ocr_dir_job}/ocr/normalized/document.v1.json")),
        translations_dir: Some(format!("jobs/{job_id}/translated")),
        ocr_page_numbers: ocr_pages.to_vec(),
        ..Default::default()
    });
    db.save_job(&job).unwrap();
    db.connect()
        .unwrap()
        .execute("UPDATE jobs SET document_id = ?1 WHERE job_id = ?2", params![document_id, job_id])
        .unwrap();
}

#[test]
fn every_translated_page_of_every_range_job_is_searchable() {
    let fs = TestDbFs::new("fts-ranges");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-1", b"ranged book");
    // 第 1-2 页一次（自己做的 OCR），第 4 页一次（复用另一个 OCR 任务的产物）。
    seed_fts_job(&db, &fs.data_root, &document_id, "job-early", "2026-10-01T00:00:00", "job-early",
        &[1, 2], &[("alpha source", "阿尔法译文"), ("beta source", "贝塔译文")]);
    seed_fts_job(&db, &fs.data_root, &document_id, "job-late", "2026-10-02T00:00:00", "ocr-provider",
        &[4], &[("delta source", "德尔塔译文")]);

    let written = db.rebuild_document_fts(&document_id).expect("rebuild");
    assert_eq!(written, 3);

    let early = db.search_blocks("贝塔译文", 10, None).expect("search");
    assert_eq!(early.len(), 1, "前一次范围翻译的页搜不到了");
    assert_eq!(early[0].job_id, "job-early");
    assert_eq!(early[0].page_idx, 1, "page_idx 应是那个任务自己的本地页号");

    let late = db.search_blocks("德尔塔译文", 10, None).expect("search");
    assert_eq!(late.len(), 1, "复用 OCR 的任务搜不到");
    assert_eq!(late[0].job_id, "job-late");
    assert_eq!(late[0].page_idx, 0);
    assert_eq!(db.search_blocks("delta source", 10, None).unwrap().len(), 1, "原文也要能搜到");
}

#[test]
fn a_page_translated_twice_is_indexed_once_from_the_newer_job() {
    let fs = TestDbFs::new("fts-redo");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-1", b"redo book");
    seed_fts_job(&db, &fs.data_root, &document_id, "job-whole", "2026-10-01T00:00:00", "job-whole",
        &[1, 2], &[("one", "旧的第一页"), ("two", "旧的第二页")]);
    seed_fts_job(&db, &fs.data_root, &document_id, "job-redo", "2026-10-02T00:00:00", "job-redo",
        &[2], &[("two", "新的第二页")]);
    db.rebuild_document_fts(&document_id).expect("rebuild");
    assert!(db.search_blocks("旧的第二页", 10, None).unwrap().is_empty(), "被重翻的旧译文还在索引里");
    assert_eq!(db.search_blocks("新的第二页", 10, None).unwrap()[0].job_id, "job-redo");
    assert_eq!(db.search_blocks("旧的第一页", 10, None).unwrap()[0].job_id, "job-whole");
}


/// 索引停在旧任务上、而有更新的任务成功了(老代码对没有 upload_id 的任务结束时不重建):
/// 启动回填要把它补上。原来只补「完全没有索引行」的书,过期的永不自愈。
#[test]
fn startup_backfill_rebuilds_an_index_older_than_the_newest_successful_job() {
    let fs = TestDbFs::new("fts-stale-backfill");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-1", b"stale index book");
    seed_fts_job(&db, &fs.data_root, &document_id, "job-whole", "2026-10-01T00:00:00", "job-whole",
        &[1, 2], &[("one", "旧的第一页"), ("two", "旧的第二页")]);
    db.rebuild_document_fts(&document_id).expect("initial index");
    // 更新的任务成功了，但没有触发重建。
    seed_fts_job(&db, &fs.data_root, &document_id, "job-redo", "2026-10-02T00:00:00", "job-redo",
        &[2], &[("two", "新的第二页")]);
    db.set_document_active_job(&document_id, "job-redo", None).expect("active");
    assert!(db.search_blocks("新的第二页", 10, None).unwrap().is_empty());

    backfill::run(&db).expect("run library backfill");

    assert_eq!(
        db.search_blocks("新的第二页", 10, None).unwrap().first().map(|hit| hit.job_id.clone()),
        Some("job-redo".to_string()),
        "启动回填没有重建过期的全文索引"
    );
    assert!(db.search_blocks("旧的第二页", 10, None).unwrap().is_empty());
}

/// 更新的成功任务产物已经没了(job 目录被删):重建时它进不了索引,判定若还算它,那本书
/// 每次启动都被判「过期」、重建一遍。判定和重建必须按同一条规则挑任务,第二次启动不能再重建。
#[test]
fn startup_backfill_does_not_keep_rebuilding_for_a_newer_job_whose_artifacts_are_gone() {
    let fs = TestDbFs::new("fts-stale-missing-artifacts");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-1", b"stale index missing artifacts");
    seed_fts_job(&db, &fs.data_root, &document_id, "job-whole", "2026-10-01T00:00:00", "job-whole",
        &[1, 2], &[("one", "旧的第一页"), ("two", "旧的第二页")]);
    db.rebuild_document_fts(&document_id).expect("initial index");
    seed_fts_job(&db, &fs.data_root, &document_id, "job-gone", "2026-10-02T00:00:00", "job-gone",
        &[2], &[("two", "新的第二页")]);
    fs::remove_dir_all(fs.data_root.join("jobs").join("job-gone")).expect("drop artifacts");
    db.set_document_active_job(&document_id, "job-gone", None).expect("active");

    backfill::run(&db).expect("first startup");
    assert_eq!(
        db.search_blocks("旧的第二页", 10, None).unwrap().first().map(|hit| hit.job_id.clone()),
        Some("job-whole".to_string()),
        "索引应当仍由产物还在的旧任务提供"
    );

    // 哨兵行:第二次启动若再重建,它会被整本替换掉。
    db.connect()
        .unwrap()
        .execute(
            "INSERT INTO blocks_fts (document_id, job_id, page_idx, block_id, source_text, translated_text) \
             VALUES (?1, 'job-whole', 0, 'p001-b9999', 'sentinel', '第二次启动的哨兵')",
            params![document_id],
        )
        .unwrap();
    backfill::run(&db).expect("second startup");
    assert!(
        !db.search_blocks("第二次启动的哨兵", 10, None).unwrap().is_empty(),
        "产物已丢失的任务让这本书每次启动都被判过期、重建一遍"
    );
}

/// 书卡停在失败任务上:有成功任务就按统一规则退回;指针已被接走或没有成功任务时不动。
#[test]
fn release_active_job_falls_back_only_when_the_card_still_points_at_the_job() {
    let fs = TestDbFs::new("release-active-job");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-release", b"release active job");
    db.set_document_active_job(&document_id, "job-failed", None).expect("active");
    assert!(!db.release_document_active_job(&document_id, "job-failed").unwrap(), "没有成功任务时不动");
    insert_succeeded_job(&db, &document_id, "job-book", WorkflowKind::Book, "2026-01-01T00:00:00Z");
    insert_succeeded_job(&db, &document_id, "job-ocr", WorkflowKind::Ocr, "2026-02-01T00:00:00Z");
    assert!(!db.release_document_active_job(&document_id, "job-other").unwrap());
    assert!(db.release_document_active_job(&document_id, "job-failed").unwrap());
    assert_eq!(db.get_document(&document_id).unwrap().active_job_id.as_deref(), Some("job-book"));
}

/// 回归（d4 联调）：先提交的任务还在跑、后提交的那个被取消了，书卡要显示在跑的那个的进度，
/// 而不是「已取消」。被取消任务自己的 OCR 子任务不算「在跑」。
#[test]
fn release_active_job_prefers_a_job_still_in_progress() {
    let fs = TestDbFs::new("release-active-job-in-progress");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-progress", b"release prefers in progress");
    let insert = |job_id: &str, workflow: &str, status: &str, created_at: &str| {
        db.connect()
            .unwrap()
            .execute(
                "INSERT INTO jobs (job_id, workflow, status, created_at, updated_at, command_json, request_json, \
                 log_tail_json, document_id) VALUES (?1, ?2, ?3, ?4, ?4, '[]', '{}', '[]', ?5)",
                params![job_id, workflow, status, created_at, document_id],
            )
            .unwrap();
    };
    insert("job-old", "book", "running", "2026-10-11T02:00:00Z");
    insert("job-new", "book", "canceled", "2026-10-11T02:39:45Z");
    insert("job-new-ocr", "ocr", "running", "2026-10-11T02:39:46Z");
    db.set_document_active_job(&document_id, "job-new", None).expect("active");

    assert!(db.release_document_active_job(&document_id, "job-new").unwrap());
    assert_eq!(db.get_document(&document_id).unwrap().active_job_id.as_deref(), Some("job-old"));

    // 在跑的优先于成功的。
    insert_succeeded_job(&db, &document_id, "job-done", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert("job-retry", "book", "failed", "2026-10-11T03:00:00Z");
    db.set_document_active_job(&document_id, "job-retry", None).expect("active");
    assert!(db.release_document_active_job(&document_id, "job-retry").unwrap());
    assert_eq!(db.get_document(&document_id).unwrap().active_job_id.as_deref(), Some("job-old"));
}

fn insert_job_with_status(
    db: &Db,
    document_id: &str,
    job_id: &str,
    workflow: &str,
    status: &str,
    created_at: &str,
) {
    db.connect()
        .unwrap()
        .execute(
            "INSERT INTO jobs (job_id, workflow, status, created_at, updated_at, command_json, request_json, \
             log_tail_json, document_id) VALUES (?1, ?2, ?3, ?4, ?4, '[]', '{}', '[]', ?5)",
            params![job_id, workflow, status, created_at, document_id],
        )
        .unwrap();
}

/// 回归（状态审计 一 #6）：每次 `Db::init` 都跑的启动回填不能和运行时的书卡规则相反。
/// 只有失败任务的书保留失败卡（能看到错误、能重试），重启不清成 NULL。
#[test]
fn startup_init_keeps_a_failure_card_when_the_book_has_no_success() {
    let fs = TestDbFs::new("init-keeps-failure-card");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-failed-only", b"failed only book");
    insert_job_with_status(&db, &document_id, "job-failed", "book", "failed", "2026-10-01T00:00:00Z");
    db.set_document_active_job(&document_id, "job-failed", None).expect("active");

    db.init().expect("restart");

    assert_eq!(
        db.get_document(&document_id).unwrap().active_job_id.as_deref(),
        Some("job-failed"),
        "重启把没有成功任务的书的失败卡清掉了"
    );
    // 稳态：再启动一次也不变，且全文索引回填不会因为这本书反复重建。
    db.init().expect("restart again");
    assert_eq!(db.get_document(&document_id).unwrap().active_job_id.as_deref(), Some("job-failed"));
}

/// 书里有旧的成功任务和正在跑的新任务，书卡指着在跑的：重启不能改回旧的成功任务。
#[test]
fn startup_init_keeps_the_card_on_a_running_job() {
    let fs = TestDbFs::new("init-keeps-running-card");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-running", b"running card book");
    insert_succeeded_job(&db, &document_id, "job-old", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert_job_with_status(&db, &document_id, "job-new", "book", "running", "2026-10-02T00:00:00Z");
    db.set_document_active_job(&document_id, "job-new", None).expect("active");

    db.init().expect("restart");

    assert_eq!(
        db.get_document(&document_id).unwrap().active_job_id.as_deref(),
        Some("job-new"),
        "重启把在跑任务的书卡改回了旧的成功任务"
    );
}

/// 明显错的卡才修，修的规则和运行时一致：指针为空 / 指向已删的任务 / 指向别的书的任务。
#[test]
fn startup_init_repairs_only_clearly_wrong_cards_by_the_runtime_rule() {
    let fs = TestDbFs::new("init-repairs-wrong-cards");
    let db = fs.db();
    db.init().expect("init");
    let card = |document_id: &str| db.get_document(document_id).unwrap().active_job_id;

    // 指向已删的任务：优先在跑的，其次最好的成功任务。
    let dangling = seed_document(&db, "up-dangling", b"dangling card");
    insert_succeeded_job(&db, &dangling, "d-done", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert_job_with_status(&db, &dangling, "d-running", "book", "running", "2026-10-02T00:00:00Z");
    db.set_document_active_job(&dangling, "d-deleted", None).unwrap();
    // 指针为空，书里有任务：同一条规则（没有成功也没有在跑 → 最近的失败任务）。
    let empty_failed = seed_document(&db, "up-empty-failed", b"empty card with failed job");
    insert_job_with_status(&db, &empty_failed, "e-failed", "book", "failed", "2026-10-01T00:00:00Z");
    let empty_done = seed_document(&db, "up-empty-done", b"empty card with success");
    insert_succeeded_job(&db, &empty_done, "s-book", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert_succeeded_job(&db, &empty_done, "s-ocr", WorkflowKind::Ocr, "2026-10-02T00:00:00Z");
    // 指向别的书的任务。
    let foreign = seed_document(&db, "up-foreign", b"foreign card");
    let other = seed_document(&db, "up-other", b"other book");
    insert_succeeded_job(&db, &foreign, "f-own", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert_succeeded_job(&db, &other, "o-own", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    db.set_document_active_job(&foreign, "o-own", None).unwrap();
    db.set_document_active_job(&other, "o-own", None).unwrap();
    // 没有任何任务的书：保持 NULL。
    let bare = seed_document(&db, "up-bare", b"bare book");
    // 指向失败任务、书里另有成功任务的卡：不是「明显错」，不动（运行时会在任务终态时处理）。
    let failed_card = seed_document(&db, "up-failed-card", b"failed card with older success");
    insert_succeeded_job(&db, &failed_card, "c-done", WorkflowKind::Book, "2026-10-01T00:00:00Z");
    insert_job_with_status(&db, &failed_card, "c-failed", "book", "failed", "2026-10-02T00:00:00Z");
    db.set_document_active_job(&failed_card, "c-failed", None).unwrap();

    db.init().expect("restart");

    assert_eq!(card(&dangling).as_deref(), Some("d-running"));
    assert_eq!(card(&empty_failed).as_deref(), Some("e-failed"));
    assert_eq!(card(&empty_done).as_deref(), Some("s-book"));
    assert_eq!(card(&foreign).as_deref(), Some("f-own"));
    assert_eq!(card(&other).as_deref(), Some("o-own"));
    assert_eq!(card(&bare), None);
    assert_eq!(card(&failed_card).as_deref(), Some("c-failed"));
}

/// 没有成功任务的书不进全文索引回填：保留失败卡后，不能让它每次启动都被判成「没有索引」重建一遍。
#[test]
fn fts_backfill_skips_books_without_any_success() {
    let fs = TestDbFs::new("fts-backfill-skips-failed-only");
    let db = fs.db();
    db.init().expect("init");
    let document_id = seed_document(&db, "up-fts-failed", b"fts failed only book");
    insert_job_with_status(&db, &document_id, "job-failed", "book", "failed", "2026-10-01T00:00:00Z");
    db.set_document_active_job(&document_id, "job-failed", None).unwrap();

    assert!(backfill::fts_backfill_targets(&db).unwrap().is_empty());
}
