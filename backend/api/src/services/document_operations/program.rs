use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

pub const PAGE_PROGRAM_SCHEMA: &str = "retainpdf_page_program_v1";
const MAX_STEPS: usize = 32;
const MAX_PAGE_REFERENCES: usize = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RetainPdfPageProgram {
    pub schema: String,
    pub steps: Vec<RetainPdfPageProgramStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum RetainPdfPageProgramStep {
    SelectPages { pages: Vec<u32> },
    RotatePages { pages: Vec<u32>, degrees: u16 },
}

impl RetainPdfPageProgram {
    pub fn from_value(value: &Value) -> Result<Self, String> {
        let program: Self = serde_json::from_value(value.clone())
            .map_err(|error| format!("invalid page program: {error}"))?;
        program.validate()?;
        Ok(program)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.schema != PAGE_PROGRAM_SCHEMA {
            return Err("unsupported page program schema".to_string());
        }
        if self.steps.is_empty() || self.steps.len() > MAX_STEPS {
            return Err(format!("page program must contain 1..{MAX_STEPS} steps"));
        }
        let mut page_references = 0usize;
        for (index, step) in self.steps.iter().enumerate() {
            let pages = match step {
                RetainPdfPageProgramStep::SelectPages { pages }
                | RetainPdfPageProgramStep::RotatePages { pages, .. } => pages,
            };
            if pages.is_empty() || pages.contains(&0) {
                return Err(format!(
                    "page program step {index} requires positive 1-based pages"
                ));
            }
            page_references = page_references.saturating_add(pages.len());
            if page_references > MAX_PAGE_REFERENCES {
                return Err("page program contains too many page references".to_string());
            }
            if let RetainPdfPageProgramStep::RotatePages { degrees, .. } = step {
                if !matches!(degrees, 90 | 180 | 270) {
                    return Err(format!(
                        "page program step {index} rotation must be 90, 180, or 270"
                    ));
                }
            }
        }
        Ok(())
    }
}

pub fn canonical_program_sha256(value: &Value) -> Result<String, String> {
    RetainPdfPageProgram::from_value(value)?;
    let encoded = serde_json::to_vec(value)
        .map_err(|error| format!("could not canonicalize page program: {error}"))?;
    if encoded.len() > 256 * 1024 {
        return Err("page program exceeds the 256 KiB contract limit".to_string());
    }
    let digest = Sha256::digest(encoded);
    Ok(digest.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn page_program_rejects_code_and_unknown_fields() {
        for value in [
            json!({"schema": PAGE_PROGRAM_SCHEMA, "steps": [{"op": "python", "code": "x"}]}),
            json!({"schema": PAGE_PROGRAM_SCHEMA, "steps": [{"op": "select_pages", "pages": [1], "path": "/tmp/x"}]}),
            json!({"schema": PAGE_PROGRAM_SCHEMA, "steps": [{"op": "rotate_pages", "pages": [1], "degrees": 45}]}),
        ] {
            assert!(RetainPdfPageProgram::from_value(&value).is_err());
        }
    }

    #[test]
    fn canonical_hash_is_independent_of_object_key_order() {
        let left = serde_json::from_str::<Value>(
            r#"{"schema":"retainpdf_page_program_v1","steps":[{"op":"select_pages","pages":[1]}]}"#,
        )
        .expect("left");
        let right = serde_json::from_str::<Value>(
            r#"{"steps":[{"pages":[1],"op":"select_pages"}],"schema":"retainpdf_page_program_v1"}"#,
        )
        .expect("right");
        assert_eq!(
            canonical_program_sha256(&left),
            canonical_program_sha256(&right)
        );
    }
}
