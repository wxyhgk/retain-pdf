//! 标签：同名不重复建、编号由名字算、给书设标签、按标签筛书、删标签和删书都级联。

use super::*;
use crate::db::documents::sha256_hex;
use crate::db::DocumentListFilter;
use crate::models::domain::UploadRecord;

fn fixture(name: &str) -> (std::path::PathBuf, Db) {
    let root = std::env::temp_dir().join(format!("retain-tags-{name}-{:016x}", fastrand::u64(..)));
    let db = Db::new(root.join("db.sqlite"), root.join("data"));
    db.init().unwrap();
    (root, db)
}

fn book(db: &Db, upload_id: &str, bytes: &[u8]) -> String {
    let upload = UploadRecord {
        upload_id: upload_id.to_string(),
        filename: format!("{upload_id}.pdf"),
        stored_path: format!("uploads/{upload_id}/{upload_id}.pdf"),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: sha256_hex(bytes),
    };
    db.save_upload_with_document(&upload).unwrap();
    upload.content_hash
}

#[test]
fn same_name_is_one_tag_and_its_id_comes_from_the_name() {
    let (root, db) = fixture("dedupe");
    let (physics, created) = db.create_tag(" Physics ", "#336699", "local").unwrap();
    assert!(created);
    assert_eq!((physics.tag_id.as_str(), physics.name.as_str()), (tag_id_for_name("physics").as_str(), "Physics"));
    let (again, created) = db.create_tag("PHYSICS", "", "local").unwrap();
    assert!(!created);
    assert_eq!(again.tag_id, physics.tag_id);
    // 改了名以后再建原来的名字：算出来的编号被占了，换随机编号，不撞。
    db.update_tag(&physics.tag_id, Some("Mechanics"), None).unwrap();
    let (new_physics, created) = db.create_tag("Physics", "", "local").unwrap();
    assert!(created);
    assert_ne!(new_physics.tag_id, physics.tag_id);
    assert_eq!(db.list_tags(None).unwrap().len(), 2);
    assert!(db.update_tag("tag-missing", Some("x"), None).is_err());
    std::fs::remove_dir_all(root).ok();
}

#[test]
fn document_tags_are_set_listed_filtered_and_cascade_on_delete() {
    let (root, db) = fixture("books");
    let a = book(&db, "up-a", b"book a");
    let b = book(&db, "up-b", b"book b");
    let (zeta, _) = db.create_tag("zeta", "", "local").unwrap();
    let (alpha, _) = db.create_tag("Alpha", "#AABBCC", "local").unwrap();

    db.set_document_tags(&a, &[zeta.tag_id.clone(), alpha.tag_id.clone()]).unwrap();
    db.set_document_tags(&b, &[zeta.tag_id.clone()]).unwrap();
    let tags = db.get_document(&a).unwrap().tags;
    let names: Vec<&str> = tags.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(names, vec!["Alpha", "zeta"], "按名字排");
    assert_eq!(tags[0].color, "#AABBCC");
    assert!(db.get_document(&b).unwrap().tags.iter().all(|t| t.tag_id == zeta.tag_id));

    let filter = DocumentListFilter { tag_id: Some(&alpha.tag_id), ..Default::default() };
    let (only_a, total) = db.list_documents_with_total(10, 0, &filter).unwrap();
    assert_eq!((only_a.len(), total, only_a[0].document_id.as_str()), (1, 1, a.as_str()));
    assert_eq!(db.get_tag(&zeta.tag_id).unwrap().unwrap().document_count, 2);

    // 设成正好这几个：去掉的去掉、留下的不动。
    db.set_document_tags(&a, &[alpha.tag_id.clone()]).unwrap();
    assert_eq!(db.get_document(&a).unwrap().tags.len(), 1);
    assert!(db.set_document_tags("no-such-book", &[]).is_err());

    assert!(db.delete_tag(&alpha.tag_id).unwrap());
    assert!(db.get_document(&a).unwrap().tags.is_empty());
    assert!(db.delete_document(&b).unwrap());
    assert_eq!(db.get_tag(&zeta.tag_id).unwrap().unwrap().document_count, 0);
    std::fs::remove_dir_all(root).ok();
}
