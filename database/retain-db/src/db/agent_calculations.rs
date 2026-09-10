use std::path::Path;
use std::str::FromStr;

use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::domain::now_iso;

use super::Db;

const RUN_COLUMNS: &str = "calculation_id, conversation_id, request_message_id,
    document_id, job_id, tool_name, tool_call_id, input_refs_json, input_sha256,
    status, result_summary, failure_summary, created_at, updated_at, finished_at";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentCalculationStatus {
    Running,
    Completed,
    Failed,
}

impl AgentCalculationStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Completed => "completed",
            Self::Failed => "failed",
        }
    }
}

impl FromStr for AgentCalculationStatus {
    type Err = String;

    fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
        match value {
            "running" => Ok(Self::Running),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            other => Err(format!("unknown agent calculation status: {other}")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgentCalculationRunCreate {
    pub calculation_id: String,
    pub conversation_id: String,
    pub request_message_id: String,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub tool_name: String,
    pub tool_call_id: String,
    pub input_refs: Value,
    pub input_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentCalculationArtifactInput {
    pub artifact_id: String,
    pub kind: String,
    pub sha256: String,
    pub relative_path: String,
    pub mime_type: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentCalculationArtifactRecord {
    pub artifact_id: String,
    pub calculation_id: String,
    pub kind: String,
    pub sha256: String,
    pub relative_path: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgentCalculationRunRecord {
    pub calculation_id: String,
    pub conversation_id: String,
    pub request_message_id: String,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub tool_name: String,
    pub tool_call_id: String,
    pub input_refs: Value,
    pub input_sha256: String,
    pub status: AgentCalculationStatus,
    pub result_summary: Option<String>,
    pub failure_summary: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub finished_at: Option<String>,
    pub artifacts: Vec<AgentCalculationArtifactRecord>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AgentCalculationTransitionResult {
    Completed(AgentCalculationRunRecord),
    Failed(AgentCalculationRunRecord),
    AlreadyTerminal(AgentCalculationRunRecord),
    NotFound,
}

impl Db {
    pub fn create_agent_calculation_run(
        &self,
        create: &AgentCalculationRunCreate,
    ) -> Result<AgentCalculationRunRecord> {
        validate_create(create)?;
        let input_refs_json = serde_json::to_string(&create.input_refs)
            .context("failed to encode agent calculation input references")?;
        let now = now_iso();
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO agent_calculation_runs (
                calculation_id, conversation_id, request_message_id, document_id,
                job_id, tool_name, tool_call_id, input_refs_json, input_sha256,
                status, result_summary, failure_summary, created_at, updated_at,
                finished_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'running', NULL, NULL, ?10, ?10, NULL)
            "#,
            params![
                create.calculation_id,
                create.conversation_id,
                create.request_message_id,
                non_empty(create.document_id.as_deref()),
                non_empty(create.job_id.as_deref()),
                create.tool_name,
                create.tool_call_id,
                input_refs_json,
                create.input_sha256.to_ascii_lowercase(),
                now,
            ],
        )?;
        load_run(&conn, &create.calculation_id)?
            .context("agent calculation run vanished after insert")
    }

    pub fn complete_agent_calculation_run(
        &self,
        calculation_id: &str,
        result_summary: &str,
        artifacts: &[AgentCalculationArtifactInput],
    ) -> Result<AgentCalculationTransitionResult> {
        require_non_empty("calculation_id", calculation_id)?;
        validate_artifacts(artifacts)?;

        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let finished_at = now_iso();
        let changed = tx.execute(
            r#"
            UPDATE agent_calculation_runs
            SET status = 'completed', result_summary = ?1, failure_summary = NULL,
                updated_at = ?2, finished_at = ?2
            WHERE calculation_id = ?3 AND status = 'running'
            "#,
            params![result_summary, finished_at, calculation_id],
        )?;
        if changed == 0 {
            return terminal_or_missing(&tx, calculation_id);
        }
        for artifact in artifacts {
            tx.execute(
                r#"
                INSERT INTO agent_calculation_artifacts (
                    artifact_id, calculation_id, kind, sha256,
                    relative_path, mime_type, size_bytes, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
                params![
                    artifact.artifact_id,
                    calculation_id,
                    artifact.kind,
                    artifact.sha256.to_ascii_lowercase(),
                    artifact.relative_path,
                    artifact.mime_type,
                    i64::try_from(artifact.size_bytes)
                        .context("agent calculation artifact size exceeds SQLite integer range")?,
                    finished_at,
                ],
            )?;
        }
        let record = load_run(&tx, calculation_id)?
            .context("agent calculation run vanished while completing")?;
        tx.commit()?;
        Ok(AgentCalculationTransitionResult::Completed(record))
    }

    pub fn fail_agent_calculation_run(
        &self,
        calculation_id: &str,
        failure_summary: &str,
    ) -> Result<AgentCalculationTransitionResult> {
        require_non_empty("calculation_id", calculation_id)?;
        require_non_empty("failure_summary", failure_summary)?;

        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let finished_at = now_iso();
        let changed = tx.execute(
            r#"
            UPDATE agent_calculation_runs
            SET status = 'failed', result_summary = NULL, failure_summary = ?1,
                updated_at = ?2, finished_at = ?2
            WHERE calculation_id = ?3 AND status = 'running'
            "#,
            params![failure_summary, finished_at, calculation_id],
        )?;
        if changed == 0 {
            return terminal_or_missing(&tx, calculation_id);
        }
        let record = load_run(&tx, calculation_id)?
            .context("agent calculation run vanished while failing")?;
        tx.commit()?;
        Ok(AgentCalculationTransitionResult::Failed(record))
    }

    pub fn get_agent_calculation_run(
        &self,
        calculation_id: &str,
    ) -> Result<Option<AgentCalculationRunRecord>> {
        let conn = self.connect()?;
        load_run(&conn, calculation_id)
    }

    pub fn list_agent_calculation_runs_for_conversation(
        &self,
        conversation_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<AgentCalculationRunRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {RUN_COLUMNS} FROM agent_calculation_runs
             WHERE conversation_id = ?1
             ORDER BY created_at DESC, calculation_id DESC
             LIMIT ?2 OFFSET ?3"
        ))?;
        let rows = stmt.query_map(
            params![conversation_id, i64::from(limit), i64::from(offset)],
            row_to_run,
        )?;
        let mut runs = Vec::new();
        for row in rows {
            let mut run = row?;
            run.artifacts = load_artifacts(&conn, &run.calculation_id)?;
            runs.push(run);
        }
        Ok(runs)
    }

    pub fn count_agent_calculation_runs_for_conversation(
        &self,
        conversation_id: &str,
    ) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM agent_calculation_runs WHERE conversation_id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }
}

fn load_run(conn: &Connection, calculation_id: &str) -> Result<Option<AgentCalculationRunRecord>> {
    let mut record = conn
        .query_row(
            &format!("SELECT {RUN_COLUMNS} FROM agent_calculation_runs WHERE calculation_id = ?1"),
            params![calculation_id],
            row_to_run,
        )
        .optional()?;
    if let Some(run) = record.as_mut() {
        run.artifacts = load_artifacts(conn, calculation_id)?;
    }
    Ok(record)
}

fn load_artifacts(
    conn: &Connection,
    calculation_id: &str,
) -> Result<Vec<AgentCalculationArtifactRecord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT artifact_id, calculation_id, kind, sha256,
               relative_path, mime_type, size_bytes, created_at
        FROM agent_calculation_artifacts
        WHERE calculation_id = ?1
        ORDER BY artifact_id
        "#,
    )?;
    let rows = stmt.query_map(params![calculation_id], |row| {
        let size_bytes = row.get::<_, i64>(6)?;
        if size_bytes < 0 {
            return Err(invalid_sql_value(
                6,
                rusqlite::types::Type::Integer,
                "negative artifact size",
            ));
        }
        Ok(AgentCalculationArtifactRecord {
            artifact_id: row.get(0)?,
            calculation_id: row.get(1)?,
            kind: row.get(2)?,
            sha256: row.get(3)?,
            relative_path: row.get(4)?,
            mime_type: row.get(5)?,
            size_bytes: size_bytes as u64,
            created_at: row.get(7)?,
        })
    })?;
    let mut artifacts = Vec::new();
    for row in rows {
        artifacts.push(row?);
    }
    Ok(artifacts)
}

fn row_to_run(row: &Row<'_>) -> rusqlite::Result<AgentCalculationRunRecord> {
    let input_refs_json: String = row.get(7)?;
    let input_refs = serde_json::from_str(&input_refs_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(7, rusqlite::types::Type::Text, Box::new(error))
    })?;
    let status_text: String = row.get(9)?;
    let status = AgentCalculationStatus::from_str(&status_text)
        .map_err(|error| invalid_sql_value(9, rusqlite::types::Type::Text, &error))?;
    Ok(AgentCalculationRunRecord {
        calculation_id: row.get(0)?,
        conversation_id: row.get(1)?,
        request_message_id: row.get(2)?,
        document_id: row.get(3)?,
        job_id: row.get(4)?,
        tool_name: row.get(5)?,
        tool_call_id: row.get(6)?,
        input_refs,
        input_sha256: row.get(8)?,
        status,
        result_summary: row.get(10)?,
        failure_summary: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
        finished_at: row.get(14)?,
        artifacts: Vec::new(),
    })
}

fn terminal_or_missing(
    conn: &Connection,
    calculation_id: &str,
) -> Result<AgentCalculationTransitionResult> {
    Ok(match load_run(conn, calculation_id)? {
        Some(record) => AgentCalculationTransitionResult::AlreadyTerminal(record),
        None => AgentCalculationTransitionResult::NotFound,
    })
}

fn validate_create(create: &AgentCalculationRunCreate) -> Result<()> {
    require_non_empty("calculation_id", &create.calculation_id)?;
    require_non_empty("conversation_id", &create.conversation_id)?;
    require_non_empty("request_message_id", &create.request_message_id)?;
    require_non_empty("tool_name", &create.tool_name)?;
    require_non_empty("tool_call_id", &create.tool_call_id)?;
    validate_sha256("input_sha256", &create.input_sha256)?;
    if !create.input_refs.is_array() && !create.input_refs.is_object() {
        bail!("agent calculation input_refs must be a JSON array or object");
    }
    Ok(())
}

fn validate_artifacts(artifacts: &[AgentCalculationArtifactInput]) -> Result<()> {
    let mut ids = std::collections::HashSet::with_capacity(artifacts.len());
    for artifact in artifacts {
        require_non_empty("artifact_id", &artifact.artifact_id)?;
        require_non_empty("artifact kind", &artifact.kind)?;
        require_non_empty("artifact mime_type", &artifact.mime_type)?;
        validate_sha256("artifact sha256", &artifact.sha256)?;
        validate_relative_path(&artifact.relative_path)?;
        i64::try_from(artifact.size_bytes)
            .context("agent calculation artifact size exceeds SQLite integer range")?;
        if !ids.insert(&artifact.artifact_id) {
            bail!("duplicate agent calculation artifact_id");
        }
    }
    Ok(())
}

fn validate_relative_path(value: &str) -> Result<()> {
    require_non_empty("artifact relative_path", value)?;
    if value.contains('\\') {
        bail!("agent calculation artifact path must use portable forward slashes");
    }
    if value.contains('\0') {
        bail!("agent calculation artifact path must not contain NUL bytes");
    }
    let path = Path::new(value);
    if path.is_absolute()
        || value
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        bail!("agent calculation artifact path must be a normalized relative path");
    }
    Ok(())
}

fn validate_sha256(field: &str, value: &str) -> Result<()> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        bail!("{field} must be a 64-character hexadecimal SHA-256");
    }
    Ok(())
}

fn require_non_empty(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        bail!("{field} must not be empty");
    }
    Ok(())
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.filter(|value| !value.trim().is_empty())
}

fn invalid_sql_value(
    column: usize,
    data_type: rusqlite::types::Type,
    detail: &str,
) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        column,
        data_type,
        Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            detail.to_string(),
        )),
    )
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use super::*;

    struct TestDbFs {
        root: PathBuf,
        db: Db,
    }

    impl TestDbFs {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "retain-data-agent-calculations-{}",
                fastrand::u64(..)
            ));
            let data_root = root.join("data");
            fs::create_dir_all(&data_root).expect("create data root");
            let db = Db::new(root.join("db/jobs.db"), data_root);
            db.init().expect("initialize db");
            db.create_conversation("conversation-a", "", None)
                .expect("create conversation");
            Self { root, db }
        }
    }

    impl Drop for TestDbFs {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn create_input(calculation_id: &str) -> AgentCalculationRunCreate {
        AgentCalculationRunCreate {
            calculation_id: calculation_id.to_string(),
            conversation_id: "conversation-a".to_string(),
            request_message_id: "message-a".to_string(),
            document_id: Some("document-a".to_string()),
            job_id: Some("job-a".to_string()),
            tool_name: "run_python_calculation".to_string(),
            tool_call_id: "call-a".to_string(),
            input_refs: json!({"artifacts": ["source-table"]}),
            input_sha256: "a".repeat(64),
        }
    }

    fn artifact(artifact_id: &str) -> AgentCalculationArtifactInput {
        AgentCalculationArtifactInput {
            artifact_id: artifact_id.to_string(),
            kind: "plot".to_string(),
            sha256: "b".repeat(64),
            relative_path: format!("agent-calculations/run-a/{artifact_id}.png"),
            mime_type: "image/png".to_string(),
            size_bytes: 123,
        }
    }

    #[test]
    fn creates_gets_and_lists_conversation_runs() {
        let fixture = TestDbFs::new();
        let created = fixture
            .db
            .create_agent_calculation_run(&create_input("run-a"))
            .expect("create calculation");
        assert_eq!(created.status, AgentCalculationStatus::Running);
        assert_eq!(created.input_refs, json!({"artifacts": ["source-table"]}));
        assert!(created.artifacts.is_empty());

        fixture
            .db
            .create_agent_calculation_run(&create_input("run-b"))
            .expect("create second calculation");
        let loaded = fixture
            .db
            .get_agent_calculation_run("run-a")
            .expect("get calculation")
            .expect("calculation exists");
        assert_eq!(loaded, created);

        let listed = fixture
            .db
            .list_agent_calculation_runs_for_conversation("conversation-a", 1, 0)
            .expect("list calculations");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].calculation_id, "run-b");
        assert_eq!(
            fixture
                .db
                .count_agent_calculation_runs_for_conversation("conversation-a")
                .expect("count calculations"),
            2
        );
        assert!(fixture
            .db
            .list_agent_calculation_runs_for_conversation("missing", 20, 0)
            .expect("list missing conversation")
            .is_empty());
    }

    #[test]
    fn completion_commits_terminal_state_and_artifacts_atomically() {
        let fixture = TestDbFs::new();
        fixture
            .db
            .create_agent_calculation_run(&create_input("run-a"))
            .expect("create calculation");
        let result = fixture
            .db
            .complete_agent_calculation_run("run-a", "two plots produced", &[artifact("plot-a")])
            .expect("complete calculation");
        let AgentCalculationTransitionResult::Completed(completed) = result else {
            panic!("expected completed transition");
        };
        assert_eq!(completed.status, AgentCalculationStatus::Completed);
        assert_eq!(
            completed.result_summary.as_deref(),
            Some("two plots produced")
        );
        assert_eq!(completed.artifacts.len(), 1);
        assert_eq!(completed.artifacts[0].size_bytes, 123);
        assert!(completed.finished_at.is_some());

        let replay = fixture
            .db
            .complete_agent_calculation_run("run-a", "different", &[])
            .expect("terminal replay");
        assert!(matches!(
            replay,
            AgentCalculationTransitionResult::AlreadyTerminal(ref record)
                if record.result_summary.as_deref() == Some("two plots produced")
                    && record.artifacts.len() == 1
        ));
    }

    #[test]
    fn artifact_insert_failure_rolls_back_terminal_transition() {
        let fixture = TestDbFs::new();
        fixture
            .db
            .create_agent_calculation_run(&create_input("run-a"))
            .expect("create first calculation");
        fixture
            .db
            .complete_agent_calculation_run("run-a", "first", &[artifact("shared")])
            .expect("complete first calculation");
        fixture
            .db
            .create_agent_calculation_run(&create_input("run-b"))
            .expect("create second calculation");

        let error = fixture
            .db
            .complete_agent_calculation_run("run-b", "second", &[artifact("shared")])
            .expect_err("global artifact id collision must fail");
        assert!(format!("{error:#}").contains("UNIQUE constraint failed"));
        let run = fixture
            .db
            .get_agent_calculation_run("run-b")
            .expect("load second calculation")
            .expect("second calculation exists");
        assert_eq!(run.status, AgentCalculationStatus::Running);
        assert!(run.finished_at.is_none());
        assert!(run.artifacts.is_empty());
    }

    #[test]
    fn failure_is_terminal_and_missing_is_explicit() {
        let fixture = TestDbFs::new();
        fixture
            .db
            .create_agent_calculation_run(&create_input("run-a"))
            .expect("create calculation");
        let result = fixture
            .db
            .fail_agent_calculation_run("run-a", "sandbox exited")
            .expect("fail calculation");
        let AgentCalculationTransitionResult::Failed(failed) = result else {
            panic!("expected failed transition");
        };
        assert_eq!(failed.status, AgentCalculationStatus::Failed);
        assert_eq!(failed.failure_summary.as_deref(), Some("sandbox exited"));
        assert!(failed.artifacts.is_empty());

        let conflict = fixture
            .db
            .complete_agent_calculation_run("run-a", "late result", &[])
            .expect("terminal conflict");
        assert!(matches!(
            conflict,
            AgentCalculationTransitionResult::AlreadyTerminal(ref record)
                if record.status == AgentCalculationStatus::Failed
        ));
        assert_eq!(
            fixture
                .db
                .fail_agent_calculation_run("missing", "missing")
                .expect("missing transition"),
            AgentCalculationTransitionResult::NotFound
        );
    }

    #[test]
    fn rejects_uncontrolled_artifact_paths_and_invalid_hashes() {
        let fixture = TestDbFs::new();
        fixture
            .db
            .create_agent_calculation_run(&create_input("run-a"))
            .expect("create calculation");
        let mut unsafe_artifact = artifact("plot-a");
        unsafe_artifact.relative_path = "../outside.png".to_string();
        let error = fixture
            .db
            .complete_agent_calculation_run("run-a", "", &[unsafe_artifact])
            .expect_err("reject parent traversal");
        assert!(format!("{error:#}").contains("normalized relative path"));
        assert_eq!(
            fixture
                .db
                .get_agent_calculation_run("run-a")
                .expect("get calculation")
                .expect("calculation exists")
                .status,
            AgentCalculationStatus::Running
        );

        let mut invalid = create_input("run-b");
        invalid.input_sha256 = "not-a-hash".to_string();
        assert!(fixture.db.create_agent_calculation_run(&invalid).is_err());
    }
}
