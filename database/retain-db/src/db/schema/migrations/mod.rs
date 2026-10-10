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

    #[test]
    fn names_are_unique() {
        let mut names: Vec<_> = MIGRATIONS.iter().map(|migration| migration.name).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), MIGRATIONS.len());
    }
}
