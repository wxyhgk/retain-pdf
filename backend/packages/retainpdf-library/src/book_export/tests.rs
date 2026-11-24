use super::*;

#[test]
fn table_cells_cannot_break_the_table() {
    assert_eq!(table_cell("a | b\nc"), "a \\| b c");
    assert_eq!(table_cell("  "), "—");
}

#[test]
fn authors_accept_names_or_objects() {
    let mut document: DocumentRecord = serde_json::from_value(json!({
        "document_id": "d", "title": "t", "authors_json": "[\"A\", {\"name\": \"B\"}, 3, \" \"]",
        "year": null, "doi": "", "source_filename": "", "page_count": 1, "bytes": 1, "active_job_id": null,
        "reading_status": "", "added_at": "", "last_opened_at": null, "updated_at": ""
    }))
    .unwrap();
    assert_eq!(authors(&document), ["A", "B"]);
    document.authors_json = "not json".to_string();
    assert!(authors(&document).is_empty());
}

#[test]
fn known_fingerprints_come_from_the_previous_meta() {
    let meta = json!({ "sources": [{ "job_id": "a", "regions_fingerprint": "fa" }, { "job_id": "b" }] });
    assert_eq!(known_fingerprint(Some(&meta), "a"), Some("fa"));
    assert_eq!(known_fingerprint(Some(&meta), "b"), None);
    assert_eq!(known_fingerprint(None, "a"), None);
}
