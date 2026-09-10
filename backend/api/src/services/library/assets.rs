//! Content-addressed binary assets (favorite screenshots, etc.).

use std::path::PathBuf;

use crate::db::documents::sha256_hex;
use crate::error::AppError;
use crate::models::api::AssetRecord;
use crate::models::domain::now_iso;

use super::LibraryDeps;

/// Resolved asset payload for route-layer HTTP response.
#[derive(Debug, Clone)]
pub struct AssetDownload {
    pub mime: String,
    pub data: Vec<u8>,
}

fn asset_extension(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => "bin",
    }
}

fn asset_path(deps: &LibraryDeps<'_>, asset_id: &str, mime: &str) -> PathBuf {
    deps.data_root
        .join("assets")
        .join(&asset_id[..2])
        .join(format!("{asset_id}.{}", asset_extension(mime)))
}

fn format_allowed_label(mimes: &[String]) -> String {
    mimes
        .iter()
        .map(|value| {
            value
                .strip_prefix("image/")
                .unwrap_or(value.as_str())
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn format_max_label(max_bytes: usize) -> String {
    if max_bytes % (1024 * 1024) == 0 {
        format!("{}MB", max_bytes / (1024 * 1024))
    } else if max_bytes % 1024 == 0 {
        format!("{}KB", max_bytes / 1024)
    } else {
        format!("{max_bytes}B")
    }
}

/// Store uploaded bytes (route extracts multipart; this owns validation + persist).
pub fn store_asset(
    deps: &LibraryDeps<'_>,
    mime: &str,
    data: &[u8],
) -> Result<AssetRecord, AppError> {
    let config = deps.asset_config;
    if !config.is_allowed(mime) {
        return Err(AppError::bad_request(format!(
            "unsupported asset mime: {mime} (allowed: {})",
            format_allowed_label(&config.allowed_mimes)
        )));
    }
    if data.is_empty() {
        return Err(AppError::bad_request(format!(
            "asset size must be 1B..{}",
            format_max_label(config.max_bytes)
        )));
    }
    if data.len() > config.max_bytes {
        return Err(AppError::payload_too_large("request body is too large"));
    }
    let asset_id = sha256_hex(data);
    let path = asset_path(deps, &asset_id, mime);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if !path.exists() {
        std::fs::write(&path, data)?;
    }
    let record = AssetRecord {
        asset_id,
        mime: mime.to_string(),
        bytes: data.len() as u64,
        width: None,
        height: None,
        created_at: now_iso(),
    };
    deps.db.save_asset(&record)?;
    Ok(record)
}

pub fn load_asset(deps: &LibraryDeps<'_>, asset_id: &str) -> Result<AssetDownload, AppError> {
    if asset_id.len() < 8 || !asset_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::bad_request("invalid asset id"));
    }
    let record = deps
        .db
        .get_asset(asset_id)?
        .ok_or_else(|| AppError::not_found(format!("asset not found: {asset_id}")))?;
    let path = asset_path(deps, &record.asset_id, &record.mime);
    let data = std::fs::read(&path)
        .map_err(|_| AppError::not_found(format!("asset file missing: {asset_id}")))?;
    Ok(AssetDownload {
        mime: record.mime,
        data,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use super::*;
    use crate::config::AssetConfig;
    use crate::db::Db;

    fn test_deps(test_name: &str, asset_config: AssetConfig) -> (LibraryDeps<'static>, PathBuf) {
        let root = std::env::temp_dir().join(format!(
            "retain-asset-test-{test_name}-{}-{}",
            std::process::id(),
            now_iso().replace([':', '.'], "-")
        ));
        // Leak PathBufs to satisfy 'static bound on LibraryDeps; cleaned up at end of test via fs::remove_dir_all.
        let data_root = Box::leak(Box::new(root.join("data")));
        let output_root = Box::leak(Box::new(root.join("output")));
        let downloads_dir = Box::leak(Box::new(root.join("downloads")));
        let scripts_dir = Box::leak(Box::new(root.join("scripts")));
        let jobs_db_path = root.join("jobs.db");
        fs::create_dir_all(&*data_root).expect("create data_root");
        fs::create_dir_all(&*output_root).expect("create output_root");
        fs::create_dir_all(&*downloads_dir).expect("create downloads_dir");
        fs::create_dir_all(&*scripts_dir).expect("create scripts_dir");
        fs::create_dir_all(jobs_db_path.parent().unwrap()).expect("create db dir");
        let db = Box::leak(Box::new(Db::new(jobs_db_path.clone(), data_root.clone())));
        let asset_config = Box::leak(Box::new(asset_config));
        db.init().expect("init db");
        let deps = LibraryDeps {
            db,
            data_root,
            output_root,
            downloads_dir,
            scripts_dir,
            python_bin: "python3",
            asset_config,
        };
        (deps, root)
    }

    fn png_config(max_bytes: usize) -> AssetConfig {
        AssetConfig {
            max_bytes,
            allowed_mimes: vec!["image/png".to_string()],
        }
    }

    #[test]
    fn rejects_when_over_custom_max_bytes() {
        let (deps, root) = test_deps("over-max", png_config(10));
        // 20 bytes > 10 bytes => should be rejected
        let data = vec![0u8; 20];
        let result = store_asset(&deps, "image/png", &data);
        assert!(matches!(result, Err(AppError::PayloadTooLarge(_))));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn passes_within_custom_max_bytes() {
        let (deps, root) = test_deps("within-max", png_config(1024));
        let data = vec![1u8; 512];
        let result = store_asset(&deps, "image/png", &data);
        assert!(
            result.is_ok(),
            "512B should pass with 1KB limit: {:?}",
            result
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn svg_rejected_or_allowed_by_config_snapshot() {
        let svg = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";

        let (rejected_deps, rejected_root) = test_deps("svg-rejected", png_config(1024));
        let default_result = store_asset(&rejected_deps, "image/svg+xml", svg);
        assert!(default_result.is_err(), "svg should be rejected by default");
        let default_message = format!("{}", default_result.unwrap_err());
        assert!(
            default_message.contains("unsupported asset mime"),
            "got: {default_message}"
        );

        let (allowed_deps, allowed_root) = test_deps(
            "svg-allowed",
            AssetConfig {
                max_bytes: 1024,
                allowed_mimes: vec!["image/png".to_string(), "image/svg+xml".to_string()],
            },
        );
        let allowed_result = store_asset(&allowed_deps, "image/svg+xml", svg);
        assert!(
            allowed_result.is_ok(),
            "svg should be allowed after env override: {:?}",
            allowed_result
        );
        let record = allowed_result.unwrap();
        assert_eq!(record.mime, "image/svg+xml");
        // Verify file written with .svg extension
        let expected_path = allowed_deps
            .data_root
            .join("assets")
            .join(&record.asset_id[..2])
            .join(format!("{}.svg", record.asset_id));
        assert!(
            expected_path.exists(),
            "svg file should exist at {:?}",
            expected_path
        );

        let _ = fs::remove_dir_all(&rejected_root);
        let _ = fs::remove_dir_all(&allowed_root);
    }

    #[test]
    fn empty_data_always_rejected() {
        let (deps, root) = test_deps("empty", png_config(1024));
        let result = store_asset(&deps, "image/png", b"");
        assert!(result.is_err());
        let _ = fs::remove_dir_all(&root);
    }
}
