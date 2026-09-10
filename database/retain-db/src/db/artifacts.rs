use anyhow::Result;
use rusqlite::params;

use crate::models::domain::JobArtifactRecord;

use super::rows::row_to_job_artifact_record;
use super::Db;

impl Db {
    pub fn list_job_artifact_entries(&self, job_id: &str) -> Result<Vec<JobArtifactRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                job_id, artifact_key, artifact_group, artifact_kind, relative_path,
                file_name, content_type, ready, size_bytes, checksum, source_stage,
                created_at, updated_at
            FROM job_artifact_entries
            WHERE job_id = ?1
            ORDER BY artifact_group ASC, artifact_key ASC
            "#,
        )?;
        let rows = stmt.query_map(params![job_id], row_to_job_artifact_record)?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }
        Ok(items)
    }
}
