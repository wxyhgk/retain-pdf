use anyhow::{Context, Result};
use rusqlite::{params, OptionalExtension, TransactionBehavior};

use crate::models::api::DocumentRecord;
use crate::models::domain::now_iso;

use super::documents::rows::query_document;
use super::Db;

#[derive(Debug, Clone)]
pub struct StoredDocumentMetadataSuggestion {
    pub suggestion_id: String,
    pub document_id: String,
    pub source_job_id: Option<String>,
    pub artifact_sha256: String,
    pub fields_json: String,
    pub candidates_json: String,
    pub selected_title: String,
    pub generation_method: String,
    pub needs_ai_review: bool,
    pub status: String,
    pub applied_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug)]
pub enum ApplyDocumentMetadataSuggestionResult {
    Applied {
        suggestion: StoredDocumentMetadataSuggestion,
        document: DocumentRecord,
    },
    SuggestionNotFound,
    DocumentNotFound,
    TitleChanged(DocumentRecord),
    RevisionConflict(DocumentRecord),
}

const SUGGESTION_COLUMNS: &str = "suggestion_id, document_id, source_job_id, artifact_sha256, fields_json, candidates_json, selected_title, generation_method, needs_ai_review, status, applied_at, created_at, updated_at";

fn row_to_suggestion(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<StoredDocumentMetadataSuggestion> {
    Ok(StoredDocumentMetadataSuggestion {
        suggestion_id: row.get(0)?,
        document_id: row.get(1)?,
        source_job_id: row.get(2)?,
        artifact_sha256: row.get(3)?,
        fields_json: row.get(4)?,
        candidates_json: row.get(5)?,
        selected_title: row.get(6)?,
        generation_method: row.get(7)?,
        needs_ai_review: row.get::<_, i64>(8)? != 0,
        status: row.get(9)?,
        applied_at: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

impl Db {
    #[allow(clippy::too_many_arguments)]
    pub fn insert_document_metadata_suggestion(
        &self,
        suggestion_id: &str,
        document_id: &str,
        source_job_id: Option<&str>,
        artifact_sha256: &str,
        fields_json: &str,
        candidates_json: &str,
        selected_title: &str,
        generation_method: &str,
        needs_ai_review: bool,
    ) -> Result<StoredDocumentMetadataSuggestion> {
        let conn = self.connect()?;
        let now = now_iso();
        conn.execute(
            r#"
            INSERT OR IGNORE INTO document_metadata_suggestions (
                suggestion_id, document_id, source_job_id, artifact_sha256,
                fields_json, candidates_json, selected_title,
                generation_method, needs_ai_review, status,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'completed', ?10, ?10)
            "#,
            params![
                suggestion_id,
                document_id,
                source_job_id,
                artifact_sha256,
                fields_json,
                candidates_json,
                selected_title,
                generation_method,
                i64::from(needs_ai_review),
                now,
            ],
        )?;

        conn.query_row(
            &format!(
                "SELECT {SUGGESTION_COLUMNS} FROM document_metadata_suggestions \
                 WHERE document_id = ?1 AND COALESCE(source_job_id, '') = COALESCE(?2, '') \
                   AND artifact_sha256 = ?3 AND selected_title = ?4"
            ),
            params![document_id, source_job_id, artifact_sha256, selected_title],
            row_to_suggestion,
        )
        .context("load inserted document metadata suggestion")
    }

    pub fn list_document_metadata_suggestions(
        &self,
        document_id: &str,
        limit: u32,
    ) -> Result<Vec<StoredDocumentMetadataSuggestion>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {SUGGESTION_COLUMNS} FROM document_metadata_suggestions \
             WHERE document_id = ?1 ORDER BY created_at DESC, suggestion_id DESC LIMIT ?2"
        ))?;
        let rows = stmt.query_map(params![document_id, i64::from(limit)], row_to_suggestion)?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    pub fn get_document_metadata_suggestion(
        &self,
        document_id: &str,
        suggestion_id: &str,
    ) -> Result<Option<StoredDocumentMetadataSuggestion>> {
        let conn = self.connect()?;
        conn.query_row(
            &format!(
                "SELECT {SUGGESTION_COLUMNS} FROM document_metadata_suggestions \
                 WHERE document_id = ?1 AND suggestion_id = ?2"
            ),
            params![document_id, suggestion_id],
            row_to_suggestion,
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn apply_document_metadata_suggestion(
        &self,
        document_id: &str,
        suggestion_id: &str,
        expected_document_updated_at: Option<&str>,
    ) -> Result<ApplyDocumentMetadataSuggestionResult> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let suggestion = tx
            .query_row(
                &format!(
                    "SELECT {SUGGESTION_COLUMNS} FROM document_metadata_suggestions \
                     WHERE document_id = ?1 AND suggestion_id = ?2"
                ),
                params![document_id, suggestion_id],
                row_to_suggestion,
            )
            .optional()?;
        let Some(mut suggestion) = suggestion else {
            return Ok(ApplyDocumentMetadataSuggestionResult::SuggestionNotFound);
        };
        let Some(document) = query_document(&tx, document_id)? else {
            return Ok(ApplyDocumentMetadataSuggestionResult::DocumentNotFound);
        };

        if expected_document_updated_at.is_some_and(|expected| expected != document.updated_at) {
            return Ok(ApplyDocumentMetadataSuggestionResult::RevisionConflict(
                document,
            ));
        }

        if suggestion.status == "applied" && document.title == suggestion.selected_title {
            tx.commit()?;
            return Ok(ApplyDocumentMetadataSuggestionResult::Applied {
                suggestion,
                document,
            });
        }

        let default_title =
            super::documents::rows::default_title_from_filename(&document.source_filename);
        if document.title_locked
            || document.title_source != "filename"
            || document.title != default_title
        {
            return Ok(ApplyDocumentMetadataSuggestionResult::TitleChanged(
                document,
            ));
        }

        let now = now_iso();
        tx.execute(
            "UPDATE documents SET title = ?1, updated_at = ?2 WHERE document_id = ?3",
            params![suggestion.selected_title, now, document_id],
        )?;
        tx.execute(
            r#"
            INSERT INTO document_title_state (document_id, source, locked, suggestion_id, updated_at)
            VALUES (?1, ?2, 0, ?3, ?4)
            ON CONFLICT(document_id) DO UPDATE SET
                source = excluded.source,
                locked = 0,
                suggestion_id = excluded.suggestion_id,
                updated_at = excluded.updated_at
            "#,
            params![
                document_id,
                if suggestion.generation_method == "pdf_metadata" {
                    "pdf_metadata"
                } else {
                    "ocr"
                },
                suggestion_id,
                now,
            ],
        )?;
        tx.execute(
            r#"
            UPDATE document_metadata_suggestions
            SET status = 'applied', applied_at = ?1, updated_at = ?1
            WHERE suggestion_id = ?2
            "#,
            params![now, suggestion_id],
        )?;
        suggestion.status = "applied".to_string();
        suggestion.applied_at = Some(now.clone());
        suggestion.updated_at = now;
        let document = query_document(&tx, document_id)?
            .context("load document after applying metadata suggestion")?;
        tx.commit()?;
        Ok(ApplyDocumentMetadataSuggestionResult::Applied {
            suggestion,
            document,
        })
    }
}
