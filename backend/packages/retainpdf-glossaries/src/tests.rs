use super::*;
use super::entries::require_glossary_for_rerun;
use super::views::{glossary_to_csv_export, GlossaryUpsertInput, ListGlossariesQuery};
use super::csv::parse_glossary_csv;
use super::views::GlossaryCsvParseInput;
use retainpdf_core::models::domain::{now_iso, GlossaryRecord};
use retainpdf_core::models::request::{CreateJobInput, GlossaryEntryInput};
use retainpdf_data::db::Db;

fn test_db() -> Db {
    let root = std::env::temp_dir().join(format!(
        "retain-pdf-glossaries-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ));
    std::fs::create_dir_all(&root).expect("create test dir");
    let db = Db::new(root.join("jobs.db"), root.join("data"));
    db.init().expect("init db");
    db
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
            match_mode: "case_insensitive".to_string(),
            context: "Biology".to_string(),
        },
    ])
    .expect("normalize entries");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].source, "dna");
    assert_eq!(entries[0].target, "DNA");
    assert_eq!(entries[0].level, "canonical");
    assert_eq!(entries[0].match_mode, "case_insensitive");
}

fn assert_import_round_trip(csv_text: &str, expected_count: usize) {
    let entries = parse_glossary_csv_text(csv_text).expect("parse complete glossary");
    assert_eq!(entries.len(), expected_count);
    let db = test_db();
    let glossary = create_glossary(&db, &GlossaryUpsertInput {
        glossary_id: String::new(), name: "import smoke".to_string(),
        description: None, source_lang: None, target_lang: None, enabled: Some(true),
        entries: entries.clone(), expected_updated_at: None,
    }).expect("save imported glossary");
    let mut request = CreateJobInput::default();
    request.translation.glossary_id = glossary.glossary_id;
    let resolved = resolve_task_glossary_request(&db, &request).expect("resolve glossary for translation");
    assert_eq!(resolved.translation.glossary_entries, entries);
    println!("Parsed, saved, and resolved all {expected_count} entries without truncation");
}

#[test]
fn imports_large_glossary_and_resolves_all_entries_for_translation() {
    let csv = format!("source,target\n{}", (0..458).map(|i| format!("term-{i},译文-{i}")).collect::<Vec<_>>().join("\n"));
    assert_import_round_trip(&csv, 458);
    let entries: Vec<_> = (0..1000).map(|i| entry(&format!("term-{i}"), "译文")).collect();
    assert_eq!(normalize_glossary_entries(&entries).expect("1000 entries supported").len(), 1000);
    let mut oversized = entries;
    oversized.push(entry("extra", "额外"));
    assert!(normalize_glossary_entries(&oversized).is_err());
}

#[test]
#[ignore = "set GLOSSARY_IMPORT_SMOKE_FILE to validate a local CSV through persistence and task resolution"]
fn local_csv_import_round_trip() {
    let path = std::env::var("GLOSSARY_IMPORT_SMOKE_FILE").expect("CSV file path");
    let text = std::fs::read_to_string(path).expect("read UTF-8 CSV");
    let parsed = parse_glossary_csv_text(&text).expect("parse local CSV");
    assert!(!parsed.is_empty());
    assert_import_round_trip(&text, parsed.len());
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
        .starts_with("\u{feff}source,target,note,level,match_mode,context\n"));
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
    let db = test_db();
    let glossary = create_glossary(
        &db,
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "chemistry".to_string(),
            description: Some("chemistry terms".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(true),
            entries: vec![entry("DNA", "脱氧核糖核酸"), entry("abstract", "摘要")],
            expected_updated_at: None,
        },
    )
    .expect("create glossary");
    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id.clone();
    input.translation.glossary_entries = vec![entry("DNA", "DNA"), entry("band gap", "带隙")];

    let resolved =
        resolve_task_glossary_request(&db, &input).expect("resolve glossary");

    assert_eq!(resolved.translation.glossary_id, glossary.glossary_id);
    assert_eq!(resolved.translation.glossary_name, "chemistry");
    assert_eq!(resolved.translation.glossary_entries.len(), 3);
    assert_eq!(resolved.translation.glossary_entries[0].target, "DNA");
}

#[test]
fn glossary_crud_round_trip() {
    let db = test_db();
    let created = create_glossary(
        &db,
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "semiconductor".to_string(),
            description: Some("physics glossary".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(true),
            entries: vec![entry("band gap", "带隙")],
            expected_updated_at: None,
        },
    )
    .expect("create glossary");
    let loaded =
        load_glossary_or_404(&db, &created.glossary_id).expect("load glossary");
    assert_eq!(loaded.name, "semiconductor");
    assert_eq!(
        list_glossaries(&db, None)
            .expect("list glossaries")
            .len(),
        1
    );

    let updated = update_glossary(
        &db,
        &created.glossary_id,
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "physics".to_string(),
            description: Some("updated".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(false),
            entries: vec![entry("band gap", "带隙"), entry("exciton", "激子")],
            expected_updated_at: None,
        },
    )
    .expect("update glossary");
    assert_eq!(updated.name, "physics");
    assert!(!updated.enabled);
    assert_eq!(updated.entries.len(), 2);

    delete_glossary(&db, &created.glossary_id).expect("delete glossary");
    let err = load_glossary_or_404(&db, &created.glossary_id)
        .expect_err("deleted glossary");
    assert!(err.to_string().contains("not found"));
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
    let db = test_db();
    let resource_entries = (0..MAX_GLOSSARY_ENTRIES)
        .map(|index| entry(&format!("term-{index}"), &format!("词-{index}")))
        .collect();
    let glossary = create_glossary(
        &db,
        &GlossaryUpsertInput {
            glossary_id: String::new(),
            name: "large".to_string(),
            description: Some(String::new()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(true),
            entries: resource_entries,
            expected_updated_at: None,
        },
    )
    .expect("create glossary");

    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id;
    input.translation.glossary_entries = vec![entry("extra-term", "额外词")];

    let err = resolve_task_glossary_request(&db, &input).expect_err("should reject");
    assert!(err
        .to_string()
        .contains("merged glossary entry count exceeds"));
}

fn full_entry(source: &str, target: &str, match_mode: &str, context: &str) -> GlossaryEntryInput {
    GlossaryEntryInput {
        source: source.to_string(),
        target: target.to_string(),
        note: String::new(),
        level: "canonical".to_string(),
        match_mode: match_mode.to_string(),
        context: context.to_string(),
    }
}

fn upsert(name: &str, entries: Vec<GlossaryEntryInput>) -> GlossaryUpsertInput {
    GlossaryUpsertInput {
        name: name.to_string(),
        entries,
        ..GlossaryUpsertInput::default()
    }
}

#[test]
fn exact_terms_differing_in_case_are_two_entries() {
    let entries = normalize_glossary_entries(&[
        full_entry("US", "美国", "exact", ""),
        full_entry("us", "微秒", "exact", ""),
    ])
    .expect("normalize");
    assert_eq!(entries.len(), 2);
}

#[test]
fn same_term_with_different_context_is_two_entries() {
    let entries = normalize_glossary_entries(&[
        full_entry("bond", "键", "case_insensitive", "chemistry"),
        full_entry("Bond", "债券", "case_insensitive", "finance"),
        full_entry("BOND", "化学键", "case_insensitive", "Chemistry"),
    ])
    .expect("normalize");
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].target, "化学键");
    assert_eq!(entries[1].target, "债券");
}

#[test]
fn case_insensitive_terms_dedupe_beyond_ascii() {
    let entries = normalize_glossary_entries(&[
        full_entry("Äther", "以太", "case_insensitive", ""),
        full_entry("äther", "乙醚", "case_insensitive", ""),
    ])
    .expect("normalize");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].target, "乙醚");
}

#[test]
fn inline_overrides_use_the_same_key() {
    let merged = merge_glossary_entries(
        &[full_entry("US", "美国", "exact", ""), full_entry("bond", "键", "case_insensitive", "chemistry")],
        &[full_entry("us", "微秒", "exact", ""), full_entry("BOND", "化学键", "case_insensitive", "CHEMISTRY")],
    );
    assert_eq!(merged.len(), 3);
    assert_eq!(merged[1].target, "化学键");
}

#[test]
fn parse_csv_reports_duplicate_count() {
    let parsed = parse_glossary_csv(&GlossaryCsvParseInput {
        csv_text: "source,target,match_mode\nDNA,脱氧核糖核酸,case_insensitive\ndna,DNA,case_insensitive\nRNA,核糖核酸,exact\n"
            .to_string(),
    })
    .expect("parse");
    assert_eq!(parsed.entries.len(), 2);
    assert_eq!(parsed.duplicate_count, 1);
}

#[test]
fn parse_csv_errors_carry_the_row_number() {
    let err = parse_glossary_csv_text("source,target\nDFT,密度泛函理论\nonly-source,\n")
        .expect_err("missing target");
    assert!(err.to_string().contains("row 3:"), "{err}");
}

#[test]
fn parse_csv_reads_tab_separated_text() {
    let entries = parse_glossary_csv_text("原词\t译文\t备注\nband gap\t带隙\t固体\nexciton\t激子\t\n")
        .expect("parse tsv");
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].source, "band gap");
    assert_eq!(entries[0].note, "固体");
}

#[test]
fn parse_csv_detects_semicolon_and_tabs_with_commas_in_cells() {
    for text in [
        "\"a,b\"\t甲\t\"one\ntwo\"\ncat\t猫\tnote",
        "source;target;note\n\"a,b\";甲;\"one\ntwo\"\ncat;猫;note",
        "\"a;b\",甲,\"one\ntwo\"\ncat,猫,note",
    ] {
        let entries = parse_glossary_csv_text(text).expect("detect separator outside quotes");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].target, "甲");
        assert_eq!(entries[0].note, "one\ntwo");
    }
}

#[test]
fn parse_csv_skips_rows_only_when_all_four_cells_are_empty() {
    // 只有上下文的一行：JSON 那边 400，CSV 以前悄悄跳过；现在两边一样。
    let err = parse_glossary_csv_text("source,target,context\nDFT,密度泛函理论,\n,,physics\n")
        .expect_err("context-only row");
    assert!(err.to_string().contains("row 3:"), "{err}");
    let entries = parse_glossary_csv_text("source,target,context\nDFT,密度泛函理论,\n,,\n\n").expect("blank rows");
    assert_eq!(entries.len(), 1);
}

#[test]
fn csv_export_guards_formula_cells_and_round_trips() {
    let entries = vec![
        full_entry("-OH", "羟基", "exact", ""),
        full_entry("+1", "正一价", "exact", ""),
        full_entry("=SUM(A1)", "@求和", "exact", "a, \"b\""),
        full_entry("'quoted", "引号", "exact", ""),
        full_entry("band gap", "带隙", "case_insensitive", ""),
    ];
    let record = GlossaryRecord {
        glossary_id: "glossary-formula".to_string(),
        name: "a/b\\c".to_string(),
        description: String::new(),
        source_lang: String::new(),
        target_lang: String::new(),
        enabled: true,
        entries: entries.clone(),
        created_at: now_iso(),
        updated_at: now_iso(),
    };
    let export = glossary_to_csv_export(&record);
    assert_eq!(export.file_name, "a_b_c.csv");
    assert!(export.csv_text.contains("\n'-OH,"), "{}", export.csv_text);
    assert!(export.csv_text.contains("\n'+1,"));
    assert!(export.csv_text.contains("\n'=SUM(A1),'@求和,"));
    assert!(export.csv_text.contains("\n'quoted,"), "a leading quote not followed by a trigger is left alone");
    let round_trip = parse_glossary_csv_text(&export.csv_text).expect("parse export");
    assert_eq!(round_trip, entries);
}

#[test]
fn json_entries_reject_unknown_level_and_match_mode() {
    let mut bad_level = full_entry("DFT", "密度泛函理论", "exact", "");
    bad_level.level = "canonicl".to_string();
    let err = normalize_glossary_entries(&[bad_level]).expect_err("unknown level");
    assert!(err.to_string().contains("DFT") && err.to_string().contains("canonicl"), "{err}");

    let mut bad_mode = full_entry("DFT", "密度泛函理论", "exact", "");
    bad_mode.match_mode = "fuzzy".to_string();
    let err = normalize_glossary_entries(&[bad_mode]).expect_err("unknown match_mode");
    assert!(err.to_string().contains("fuzzy"), "{err}");

    // CSV 仍然宽松：不认识的落到默认值。
    let entries = parse_glossary_csv_text("source,target,level,match_mode\nDFT,密度泛函理论,canonicl,fuzzy\n")
        .expect("csv stays lenient");
    assert_eq!(entries[0].level, "preferred");
    assert_eq!(entries[0].match_mode, "exact");
}

#[test]
fn regex_entries_must_compile_but_python_only_syntax_is_allowed() {
    let err = normalize_glossary_entries(&[full_entry("band (gap", "带隙", "regex", "")])
        .expect_err("broken regex");
    assert!(err.to_string().contains("band (gap"), "{err}");
    normalize_glossary_entries(&[full_entry(r"(?<![A-Za-z])ion(?!ic)", "离子", "regex", "")])
        .expect("look-around is Python syntax, accepted");
    normalize_glossary_entries(&[full_entry(r"\b(DFT|HF)\b", "方法", "regex", "")]).expect("plain regex");
}

#[test]
fn context_is_capped_at_500_characters() {
    let err = normalize_glossary_entries(&[full_entry("DFT", "密度泛函理论", "exact", &"x".repeat(501))])
        .expect_err("context too long");
    assert!(err.to_string().contains("context exceeds 500"), "{err}");
    normalize_glossary_entries(&[full_entry("DFT", "密度泛函理论", "exact", &"x".repeat(500))]).expect("500 ok");
}

#[test]
fn update_keeps_top_level_fields_the_request_left_out() {
    let db = test_db();
    let created = create_glossary(
        &db,
        &GlossaryUpsertInput {
            description: Some("agent notes".to_string()),
            source_lang: Some("en".to_string()),
            target_lang: Some("zh-CN".to_string()),
            enabled: Some(false),
            ..upsert("physics", vec![entry("band gap", "带隙")])
        },
    )
    .expect("create");
    let updated = update_glossary(&db, &created.glossary_id, &upsert("physics 2", vec![entry("exciton", "激子")]))
        .expect("update");
    assert_eq!(updated.name, "physics 2");
    assert_eq!(updated.description, "agent notes");
    assert_eq!(updated.source_lang, "en");
    assert_eq!(updated.target_lang, "zh-CN");
    assert!(!updated.enabled);
    assert_eq!(updated.entries.len(), 1);
    assert!(updated.updated_at > created.updated_at, "{} > {}", updated.updated_at, created.updated_at);

    let cleared = update_glossary(
        &db,
        &created.glossary_id,
        &GlossaryUpsertInput { description: Some(String::new()), enabled: Some(true), ..upsert("physics 2", vec![]) },
    )
    .expect("explicit values still apply");
    assert_eq!(cleared.description, "");
    assert!(cleared.enabled);
}

#[test]
fn update_with_a_stale_expected_updated_at_is_409() {
    let db = test_db();
    let created = create_glossary(&db, &upsert("physics", vec![entry("band gap", "带隙")])).expect("create");
    let first = update_glossary(
        &db,
        &created.glossary_id,
        &GlossaryUpsertInput {
            expected_updated_at: Some(created.updated_at.clone()),
            ..upsert("physics", vec![entry("exciton", "激子")])
        },
    )
    .expect("fresh expected_updated_at");
    // 同一毫秒里再保存一次，时间戳也得变，否则拿旧值的人分不出来。
    assert_ne!(first.updated_at, created.updated_at);

    let err = update_glossary(
        &db,
        &created.glossary_id,
        &GlossaryUpsertInput {
            expected_updated_at: Some(created.updated_at.clone()),
            ..upsert("physics", vec![entry("phonon", "声子")])
        },
    )
    .expect_err("stale expected_updated_at");
    assert_eq!(status_of(&err), 409);
    assert!(err.to_string().contains("changed"), "{err}");
    let current = load_glossary_or_404(&db, &created.glossary_id).expect("still there");
    assert_eq!(current.entries[0].source, "exciton");
}

#[test]
fn update_does_not_resurrect_a_deleted_glossary() {
    let db = test_db();
    let created = create_glossary(&db, &upsert("physics", vec![entry("band gap", "带隙")])).expect("create");
    db.delete_glossary(&created.glossary_id).expect("delete");
    let err = update_glossary(&db, &created.glossary_id, &upsert("physics", vec![]))
        .expect_err("deleted glossary");
    assert_eq!(status_of(&err), 404);
    assert!(db.get_glossary(&created.glossary_id).is_err());
    // 读完之后才被删（PUT 和 DELETE 撞上）：库层 UPDATE 不插入。
    let record = GlossaryRecord { glossary_id: created.glossary_id.clone(), ..created.clone() };
    assert!(!db.update_glossary(&record, None).expect("update"));
    assert!(db.get_glossary(&created.glossary_id).is_err());
}

#[test]
fn empty_query_does_not_filter() {
    let db = test_db();
    create_glossary(&db, &upsert("physics", vec![])).expect("create");
    let items = filter_glossaries(
        list_glossaries(&db, None).expect("list"),
        &ListGlossariesQuery { q: Some("  ".to_string()), ..ListGlossariesQuery::default() },
    );
    assert_eq!(items.len(), 1);
}

#[test]
fn resolve_task_glossary_request_rejects_missing_and_disabled_glossaries_with_400() {
    let db = test_db();
    let mut input = CreateJobInput::default();
    input.translation.glossary_id = "glossary-nope".to_string();
    let err = resolve_task_glossary_request(&db, &input).expect_err("missing glossary");
    assert_eq!(status_of(&err), 400);
    assert!(err.to_string().contains("translation.glossary_id not found"), "{err}");

    let disabled = create_glossary(
        &db,
        &GlossaryUpsertInput { enabled: Some(false), ..upsert("off", vec![entry("DNA", "DNA")]) },
    )
    .expect("create");
    input.translation.glossary_id = disabled.glossary_id;
    let err = resolve_task_glossary_request(&db, &input).expect_err("disabled glossary");
    assert_eq!(status_of(&err), 400);
    assert!(err.to_string().contains("disabled"), "{err}");
}

#[test]
fn resolve_task_glossary_request_stores_the_inline_entries_apart_from_the_snapshot() {
    let db = test_db();
    let glossary = create_glossary(&db, &upsert("chem", vec![entry("DNA", "脱氧核糖核酸")])).expect("create");
    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id;
    input.translation.glossary_entries = vec![entry("band gap", "带隙")];
    let resolved = resolve_task_glossary_request(&db, &input).expect("resolve");
    assert_eq!(resolved.translation.glossary_entries.len(), 2);
    assert_eq!(resolved.translation.glossary_inline_entries.len(), 1);
    assert_eq!(resolved.translation.glossary_inline_entries[0].source, "band gap");
    assert_eq!(resolved.translation.glossary_inline_entry_count, 1);
}

#[test]
fn rerun_requires_the_glossary_to_still_exist() {
    let db = test_db();
    let err = require_glossary_for_rerun(&db, "glossary-gone").expect_err("missing");
    assert_eq!(status_of(&err), 409);
    let glossary = create_glossary(&db, &upsert("chem", vec![])).expect("create");
    require_glossary_for_rerun(&db, &glossary.glossary_id).expect("present");
}

#[test]
fn a_corrupt_entries_column_is_an_error_not_an_empty_glossary() {
    let db = test_db();
    let glossary = create_glossary(&db, &upsert("chem", vec![entry("DNA", "DNA")])).expect("create");
    rusqlite::Connection::open(db.path())
        .expect("connect")
        .execute(
            "UPDATE glossaries SET entries_json = '{broken' WHERE glossary_id = ?1",
            [&glossary.glossary_id],
        )
        .expect("corrupt");
    let err = load_glossary_or_404(&db, &glossary.glossary_id).expect_err("corrupt row");
    assert_eq!(status_of(&err), 500);
}

fn status_of(err: &retainpdf_api_base::error::AppError) -> u16 {
    use retainpdf_api_base::error::AppError;
    match err {
        AppError::BadRequest(_) => 400,
        AppError::NotFound(_) => 404,
        AppError::Conflict(_) => 409,
        AppError::Reasoned { status, .. } => status.as_u16(),
        AppError::Internal(_) => 500,
        other => panic!("unexpected error kind: {other:?}"),
    }
}

#[test]
fn tables_saved_under_older_rules_still_resolve_for_new_jobs() {
    let db = test_db();
    let glossary = create_glossary(&db, &upsert("legacy", vec![])).expect("create");
    // 2026-10-22 以前保存时不查正则、不限上下文长度。
    let legacy = GlossaryRecord {
        entries: vec![full_entry("band (gap", "带隙", "regex", ""), full_entry("DNA", "DNA", "exact", &"x".repeat(600))],
        ..glossary.clone()
    };
    assert!(db.update_glossary(&legacy, None).expect("write legacy entries"));
    let mut input = CreateJobInput::default();
    input.translation.glossary_id = glossary.glossary_id;
    let resolved = resolve_task_glossary_request(&db, &input).expect("old tables keep working");
    assert_eq!(resolved.translation.glossary_entries.len(), 2);
}
