//! 编号迁移清单（PRAGMA user_version）。每个迁移一个 `.sql` 文件，按领域命名，说明写在文件开头。
//!
//! 版本号就是它在清单里的位置（从 1 起）：已经升过级的库靠 user_version 记着做到了第几个。
//! 所以已上线的条目只能往后追加——不能改内容、不能删、不能调换顺序。加迁移：新建
//! `vNN_<领域>.sql`，在清单末尾追加一行。

pub(super) struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

pub(super) const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "library_foundation",
        sql: include_str!("v01_library_foundation.sql"),
    },
    Migration {
        version: 2,
        name: "assets_ai_conversations",
        sql: include_str!("v02_assets_ai_conversations.sql"),
    },
    Migration {
        version: 3,
        name: "ai_message_branches",
        sql: include_str!("v03_ai_message_branches.sql"),
    },
    Migration {
        version: 4,
        name: "favorites_job_fk",
        sql: include_str!("v04_favorites_job_fk.sql"),
    },
    Migration {
        version: 5,
        name: "document_operations",
        sql: include_str!("v05_document_operations.sql"),
    },
    Migration {
        version: 6,
        name: "agent_runtime_cursor",
        sql: include_str!("v06_agent_runtime_cursor.sql"),
    },
    Migration {
        version: 7,
        name: "document_operation_retry_key",
        sql: include_str!("v07_document_operation_retry_key.sql"),
    },
    Migration {
        version: 8,
        name: "pipeline_state",
        sql: include_str!("v08_pipeline_state.sql"),
    },
    Migration {
        version: 9,
        name: "pipeline_stage_observation",
        sql: include_str!("v09_pipeline_stage_observation.sql"),
    },
    Migration {
        version: 10,
        name: "provider_dispatch_journal",
        sql: include_str!("v10_provider_dispatch_journal.sql"),
    },
    Migration {
        version: 11,
        name: "agent_calculations",
        sql: include_str!("v11_agent_calculations.sql"),
    },
    Migration {
        version: 12,
        name: "document_metadata_suggestions",
        sql: include_str!("v12_document_metadata_suggestions.sql"),
    },
    Migration {
        version: 13,
        name: "model_execution_journal",
        sql: include_str!("v13_model_execution_journal.sql"),
    },
    Migration {
        version: 14,
        name: "event_feeds",
        sql: include_str!("v14_event_feeds.sql"),
    },
    Migration {
        version: 15,
        name: "event_retention_cutoff",
        sql: include_str!("v15_event_retention_cutoff.sql"),
    },
    Migration {
        version: 16,
        name: "ai_message_finish_reason",
        sql: include_str!("v16_ai_message_finish_reason.sql"),
    },
    Migration {
        version: 17,
        name: "sync_bookkeeping",
        sql: include_str!("v17_sync_bookkeeping.sql"),
    },
    Migration {
        version: 18,
        name: "sync_blob_segments",
        sql: include_str!("v18_sync_blob_segments.sql"),
    },
    Migration {
        version: 19,
        name: "sync_phase3_entities",
        sql: include_str!("v19_sync_phase3_entities.sql"),
    },
    Migration {
        version: 20,
        name: "sync_blob_compaction",
        sql: include_str!("v20_sync_blob_compaction.sql"),
    },
    Migration {
        version: 21,
        name: "accounts",
        sql: include_str!("v21_accounts.sql"),
    },
    Migration {
        version: 22,
        name: "data_ownership",
        sql: include_str!("v22_data_ownership.sql"),
    },
    Migration {
        version: 23,
        name: "page_quota",
        sql: include_str!("v23_page_quota.sql"),
    },
    Migration {
        version: 24,
        name: "user_soft_delete",
        sql: include_str!("v24_user_soft_delete.sql"),
    },
    Migration {
        version: 25,
        name: "platform_settings",
        sql: include_str!("v25_platform_settings.sql"),
    },
    Migration {
        version: 26,
        name: "invite_codes",
        sql: include_str!("v26_invite_codes.sql"),
    },
    Migration {
        version: 27,
        name: "pipeline_auto_resume",
        sql: include_str!("v27_pipeline_auto_resume.sql"),
    },
    Migration {
        version: 28,
        name: "legacy_user_titles",
        sql: include_str!("v28_legacy_user_titles.sql"),
    },
    Migration {
        version: 29,
        name: "legacy_mineru_workflow",
        sql: include_str!("v29_legacy_mineru_workflow.sql"),
    },
    Migration {
        version: 30,
        name: "translation_versions",
        sql: include_str!("v30_translation_versions.sql"),
    },
    Migration {
        version: 31,
        name: "drop_dead_tables",
        sql: include_str!("v31_drop_dead_tables.sql"),
    },
    Migration {
        version: 32,
        name: "job_status_text",
        sql: include_str!("v32_job_status_text.sql"),
    },
    Migration {
        version: 33,
        name: "job_stage_history",
        sql: include_str!("v33_job_stage_history.sql"),
    },
];

#[cfg(test)]
mod tests {
    use super::MIGRATIONS;

    #[test]
    fn versions_are_contiguous_and_match_file_order() {
        for (index, migration) in MIGRATIONS.iter().enumerate() {
            assert_eq!(migration.version, index as i64 + 1, "{}", migration.name);
            assert!(!migration.sql.trim().is_empty(), "{}", migration.name);
        }
    }

    /// v32 的数据搬迁：带引号的状态、流程变成纯文本；`{父任务}-ocr` 指向在库里的父任务；之后不认识的取值写不进去；
    /// 扣页数触发器跟着新列走。在一个只有相关列的 v31 样子的表上直接跑迁移语句。
    #[test]
    fn v32_unquotes_status_and_workflow_and_links_ocr_children() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            CREATE TABLE jobs (job_id TEXT PRIMARY KEY, workflow TEXT NOT NULL, status_json TEXT NOT NULL, updated_at TEXT);
            CREATE TABLE page_ledger (user_id TEXT, delta INTEGER, kind TEXT, job_id TEXT, note TEXT, created_at TEXT);
            CREATE TABLE job_page_charges (job_id TEXT, user_id TEXT, pages INTEGER, status TEXT, updated_at TEXT);
            CREATE TRIGGER jobs_page_charge_settle AFTER UPDATE OF status_json ON jobs BEGIN SELECT 1; END;
            INSERT INTO jobs VALUES ('a', '"book"', '"succeeded"', 't'), ('a-ocr', '"ocr"', '"failed"', 't'),
                                    ('lost-ocr', '"ocr"', 'canceled', 't'), ('r', 'render', '"running"', 't');
            INSERT INTO job_page_charges VALUES ('r', 'u1', 7, 'reserved', '');
            "#,
        )
        .unwrap();
        let v32 = MIGRATIONS.iter().find(|m| m.version == 32).unwrap();
        conn.execute_batch(v32.sql).unwrap();

        let rows: Vec<(String, String, String, Option<String>)> = conn
            .prepare("SELECT job_id, workflow, status, parent_job_id FROM jobs ORDER BY job_id")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        let expected = [
            ("a", "book", "succeeded", None),
            ("a-ocr", "ocr", "failed", Some("a")),
            ("lost-ocr", "ocr", "canceled", None),
            ("r", "render", "running", None),
        ];
        let got: Vec<_> = rows.iter().map(|(j, w, s, p)| (j.as_str(), w.as_str(), s.as_str(), p.as_deref())).collect();
        assert_eq!(got, expected);

        assert!(conn.execute("UPDATE jobs SET status = 'done' WHERE job_id = 'a'", []).is_err());
        assert!(conn.execute("UPDATE jobs SET workflow = '\"book\"' WHERE job_id = 'a'", []).is_err());
        conn.execute("UPDATE jobs SET status = 'failed' WHERE job_id = 'r'", []).unwrap();
        let refunded: i64 = conn
            .query_row("SELECT COUNT(*) FROM page_ledger WHERE job_id = 'r' AND kind = 'refund' AND note = 'failed'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(refunded, 1, "扣页数触发器按新的 status 列退回");
    }

    /// v33：`runtime_json` 里的阶段历史搬进 `job_stage_history`，算不出来的几项搬成列，`runtime_json` 删掉。
    #[test]
    fn v33_moves_stage_history_and_keeps_only_what_cannot_be_derived() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE jobs (job_id TEXT PRIMARY KEY, runtime_json TEXT);
            CREATE TABLE sync_dirty (kind TEXT, entity_key TEXT, changed_at TEXT, PRIMARY KEY (kind, entity_key));
            CREATE TABLE sync_apply_guard (singleton INTEGER);
            INSERT INTO jobs VALUES
              ('a', '{"current_stage":"finished","stage_started_at":"t2","retry_count":1,"last_retry_at":"t1",
                      "last_error_at":null,"stage_history":[
                        {"stage":"queued","detail":"q","enter_at":"t0","exit_at":"t1","duration_ms":10,"terminal_status":null},
                        {"stage":"translating","detail":null,"enter_at":"t1","exit_at":"t2","duration_ms":20,
                         "terminal_status":"succeeded","progress_current":5,"progress_total":5}]}'),
              ('old', NULL),
              ('broken', 'not json');
            "#,
        )
        .unwrap();
        let v33 = MIGRATIONS.iter().find(|m| m.version == 33).unwrap();
        conn.execute_batch(v33.sql).unwrap();

        let history: Vec<(String, i64, String, Option<String>, Option<i64>)> = conn
            .prepare("SELECT job_id, seq, stage, terminal_status, progress_current FROM job_stage_history ORDER BY job_id, seq")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            history,
            vec![
                ("a".to_string(), 0, "queued".to_string(), None, None),
                ("a".to_string(), 1, "translating".to_string(), Some("succeeded".to_string()), Some(5)),
            ]
        );
        let a: (Option<String>, i64, Option<String>) = conn
            .query_row("SELECT stage_entered_at, retry_count, last_retry_at FROM jobs WHERE job_id = 'a'", [], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .unwrap();
        assert_eq!(a, (Some("t2".to_string()), 1, Some("t1".to_string())));
        let old_retries: i64 = conn.query_row("SELECT retry_count FROM jobs WHERE job_id = 'old'", [], |row| row.get(0)).unwrap();
        assert_eq!(old_retries, 0);
        let has_runtime_json: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_table_info('jobs') WHERE name = 'runtime_json'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(has_runtime_json, 0);
    }

    #[test]
    fn names_are_unique() {
        let mut names: Vec<_> = MIGRATIONS.iter().map(|migration| migration.name).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), MIGRATIONS.len());
    }
}
