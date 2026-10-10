use std::collections::HashSet;
use std::sync::Arc;

use super::*;
use crate::config::AppConfig;
use crate::models::api::{glossary_to_csv_export, ListGlossariesQuery};
use crate::models::domain::{now_iso, GlossaryRecord};
use crate::models::request::{CreateJobInput, GlossaryEntryInput, GlossaryUpsertInput};
use crate::test_support::config::TestDirs;
use crate::test_support::state::assemble_app_state;
use crate::AppState;

fn test_state() -> AppState {
    // 服务层测试按服务层的旧约定：python 而非 python3、无 API key。
    let dirs = TestDirs::create(&format!(
        "rust-api-glossaries-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ));
    let state = assemble_app_state(Arc::new(AppConfig {
        python_bin: "python".to_string(),
        simple_port: 41001,
        api_keys: HashSet::new(),
        ..dirs.config()
    }));
    state.db.init().expect("init db");
    state
}

fn entry(source: &str, target: &str) -> GlossaryEntryInput {
    GlossaryEntryInput {
        source: source.to_string(),
        target: target.to_string(),
        note: String::new(),
        level: String::new(),
        match_mode: String::new(),
        context: String::new(),
    }
}

#[test]
fn normalize_glossary_entries_dedupes_and_trims() {
    let entries = normalize_glossary_entries(&[
        GlossaryEntryInput {
            source: " DNA ".to_string(),
            target: " 脱氧核糖核酸 ".to_string(),
            note: String::new(),
            level: "preserve".to_string(),
            match_mode: "case-insensitive".to_string(),
            context: " biology ".to_string(),
        },
        GlossaryEntryInput {
            source: "dna".to_string(),
            target: "DNA".to_string(),
            note: "override".to_string(),
            level: "canonical".to_string(),
            match_mode: "regex".to_string(),
            context: String::new(),
        },
    ])
    .expect("normalize entries");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].source, "dna");
    assert_eq!(entries[0].target, "DNA");
    assert_eq!(entries[0].level, "canonical");
    assert_eq!(entries[0].match_mode, "regex");
}

#[test]
fn parse_glossary_csv_supports_header_and_note() {
    let entries = parse_glossary_csv_text("source,target,note,level,match_mode,context\nabstract,摘要,section title,canonical,case-insensitive,paper\n")
        .expect("parse csv");
    assert_eq!(
        entries,
        vec![GlossaryEntryInput {
            source: "abstract".to_string(),
            target: "摘要".to_string(),
            note: "section title".to_string(),
            level: "canonical".to_string(),
            match_mode: "case_insensitive".to_string(),
            context: "paper".to_string(),
        }]
    );
}

#[test]
fn preserve_glossary_entry_can_omit_target() {
    let entries = normalize_glossary_entries(&[GlossaryEntryInput {
        source: " Hartree-Fock ".to_string(),
        target: String::new(),
        note: String::new(),
        level: "不翻译".to_string(),
        match_mode: "忽略大小写".to_string(),
        context: String::new(),
    }])
    .expect("normalize preserve entry");

    assert_eq!(entries[0].source, "Hartree-Fock");
    assert_eq!(entries[0].target, "Hartree-Fock");
    assert_eq!(entries[0].level, "preserve");
    assert_eq!(entries[0].match_mode, "case_insensitive");
}

#[test]
fn parse_glossary_csv_supports_chinese_table_headers() {
    let entries = parse_glossary_csv_text("原词,译文,类型,匹配模式,备注\nKohn-Sham,,保留,忽略大小写,method name\nDFT,density functional theory,专业译法,exact,expanded form\n")
        .expect("parse csv");

    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].source, "Kohn-Sham");
    assert_eq!(entries[0].target, "Kohn-Sham");
    assert_eq!(entries[0].level, "preserve");
    assert_eq!(entries[0].match_mode, "case_insensitive");
    assert_eq!(entries[1].level, "canonical");
}

#[test]
fn glossary_csv_export_escapes_cells() {
    let record = GlossaryRecord {
        glossary_id: "glossary-1".to_string(),
        name: "physics".to_string(),
        description: String::new(),
        source_lang: "en".to_string(),
        target_lang: "zh-CN".to_string(),
        enabled: true,
        entries: vec![GlossaryEntryInput {
            source: "density, of states".to_string(),
            target: "态\"密度".to_string(),
            note: "materials".to_string(),
            level: "canonical".to_string(),
            match_mode: "exact".to_string(),
            context: String::new(),
        }],
        created_at: now_iso(),
        updated_at: now_iso(),
    };

    let export = glossary_to_csv_export(&record);

    assert!(export
        .csv_text
        .starts_with("source,target,note,level,match_mode,context\n"));
    assert!(export.csv_text.contains("\"density, of states\""));
    assert!(export.csv_text.contains("\"态\"\"密度\""));
}

#[test]
fn merge_glossary_entries_prefers_overlay() {
    let merged = merge_glossary_entries(
        &[entry("DNA", "脱氧核糖核酸"), entry("abstract", "摘要")],
        &[entry("DNA", "DNA"), entry("band gap", "带隙")],
    );
    assert_eq!(merged.len(), 3);
    assert_eq!(merged[0].source, "DNA");
    assert_eq!(merged[0].target, "DNA");
    assert_eq!(merged[2].source, "band gap");
}

#[test]
fn resolve_task_glossary_request_merges_resource_and_inline_entries() {
    let state = test_state();
    let glossary = create_glossary(
        state.db.as_ref(),
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "chemistry".to_string(),
            description: "chemistry terms".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: vec![entry("DNA", "脱氧核糖核酸"), entry("abstract", "摘要")],
        },
    )
    .expect("create glossary");
    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id.clone();
    input.translation.glossary_entries = vec![entry("DNA", "DNA"), entry("band gap", "带隙")];

    let resolved =
        resolve_task_glossary_request(state.db.as_ref(), &input).expect("resolve glossary");

    assert_eq!(resolved.translation.glossary_id, glossary.glossary_id);
    assert_eq!(resolved.translation.glossary_name, "chemistry");
    assert_eq!(resolved.translation.glossary_entries.len(), 3);
    assert_eq!(resolved.translation.glossary_entries[0].target, "DNA");
}

#[test]
fn glossary_crud_round_trip() {
    let state = test_state();
    let created = create_glossary(
        state.db.as_ref(),
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "semiconductor".to_string(),
            description: "physics glossary".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: vec![entry("band gap", "带隙")],
        },
    )
    .expect("create glossary");
    let loaded =
        load_glossary_or_404(state.db.as_ref(), &created.glossary_id).expect("load glossary");
    assert_eq!(loaded.name, "semiconductor");
    assert_eq!(
        list_glossaries(state.db.as_ref(), None)
            .expect("list glossaries")
            .len(),
        1
    );

    let updated = update_glossary(
        state.db.as_ref(),
        &created.glossary_id,
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "physics".to_string(),
            description: "updated".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: false,
            entries: vec![entry("band gap", "带隙"), entry("exciton", "激子")],
        },
    )
    .expect("update glossary");
    assert_eq!(updated.name, "physics");
    assert!(!updated.enabled);
    assert_eq!(updated.entries.len(), 2);

    delete_glossary(state.db.as_ref(), &created.glossary_id).expect("delete glossary");
    let err = load_glossary_or_404(state.db.as_ref(), &created.glossary_id)
        .expect_err("deleted glossary");
    assert!(err.to_string().contains("not found"));
}

#[test]
fn import_glossary_payload_can_update_existing_record() {
    let state = test_state();
    let created = create_glossary(
        state.db.as_ref(),
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "initial".to_string(),
            description: String::new(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: vec![entry("band gap", "带隙")],
        },
    )
    .expect("create glossary");

    let updated = update_glossary(
        state.db.as_ref(),
        &created.glossary_id,
        &GlossaryUpsertInput {
            glossary_id: created.glossary_id.clone(),
            name: "imported".to_string(),
            description: "imported glossary".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: false,
            entries: vec![entry("exciton", "激子")],
        },
    )
    .expect("import update");

    assert_eq!(updated.glossary_id, created.glossary_id);
    assert_eq!(updated.name, "imported");
    assert!(!updated.enabled);
    assert_eq!(updated.entries[0].source, "exciton");
}

#[test]
fn filter_glossaries_filters_by_enabled_and_language_and_query() {
    let items = vec![
        GlossaryRecord {
            glossary_id: "glossary-1".to_string(),
            name: "physics".to_string(),
            description: "physics glossary".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: vec![],
            created_at: now_iso(),
            updated_at: now_iso(),
        },
        GlossaryRecord {
            glossary_id: "glossary-2".to_string(),
            name: "chemistry".to_string(),
            description: "chemistry glossary".to_string(),
            source_lang: "en".to_string(),
            target_lang: "zh-TW".to_string(),
            enabled: false,
            entries: vec![],
            created_at: now_iso(),
            updated_at: now_iso(),
        },
    ];

    let filtered = filter_glossaries(
        items,
        &ListGlossariesQuery {
            enabled: Some(true),
            source_lang: Some("EN".to_string()),
            target_lang: Some("zh-cn".to_string()),
            q: Some("physics".to_string()),
        },
    );

    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].glossary_id, "glossary-1");
}

#[test]
fn resolve_task_glossary_request_rejects_merged_entries_over_limit() {
    let state = test_state();
    let resource_entries = (0..MAX_GLOSSARY_ENTRIES)
        .map(|index| entry(&format!("term-{index}"), &format!("词-{index}")))
        .collect();
    let glossary = create_glossary(
        state.db.as_ref(),
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "large".to_string(),
            description: String::new(),
            source_lang: "en".to_string(),
            target_lang: "zh-CN".to_string(),
            enabled: true,
            entries: resource_entries,
        },
    )
    .expect("create glossary");

    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id;
    input.translation.glossary_entries = vec![entry("extra-term", "额外词")];

    let err = resolve_task_glossary_request(state.db.as_ref(), &input).expect_err("should reject");
    assert!(err
        .to_string()
        .contains("merged glossary entry count exceeds"));
}
