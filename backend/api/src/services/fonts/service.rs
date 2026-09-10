//! Font discovery and persistence implementation.

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize)]
pub struct FontInfo {
    pub family: String,
    pub files: Vec<String>,
    pub available: bool,
}

const FONT_EXTS: &[&str] = &["otf", "ttf", "ttc", "otc", "woff", "woff2"];

pub(crate) fn list_fonts(project_root: &Path, data_root: &Path) -> Vec<FontInfo> {
    let dirs = resolve_font_dirs(project_root, data_root);
    scan_fonts(&dirs)
}

pub(crate) fn save_uploaded_font(
    data_root: &Path,
    filename: &str,
    bytes: &[u8],
) -> Result<FontInfo, AppError> {
    let ext = Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !FONT_EXTS.contains(&ext.as_str()) {
        return Err(AppError::bad_request(format!(
            "unsupported font extension .{ext}; allowed: {}",
            FONT_EXTS.join(", ")
        )));
    }

    let sanitized = Path::new(filename)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("upload.otf")
        .replace(['/', '\\'], "_");
    let data_fonts_dir = data_root.join("fonts");
    std::fs::create_dir_all(&data_fonts_dir).map_err(|err| AppError::internal(err.to_string()))?;
    let destination = data_fonts_dir.join(&sanitized);
    std::fs::write(&destination, bytes).map_err(|err| AppError::internal(err.to_string()))?;

    let _ = Command::new("fc-cache")
        .arg("-f")
        .arg(&data_fonts_dir)
        .output();

    let family =
        family_from_file(&destination).unwrap_or_else(|| family_from_filename(&destination));
    Ok(FontInfo {
        family: family.trim().to_string(),
        files: vec![destination.to_string_lossy().to_string()],
        available: true,
    })
}

fn resolve_font_dirs(project_root: &Path, data_root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut seen = HashSet::new();

    let push_dir = |path: PathBuf, dirs: &mut Vec<PathBuf>, seen: &mut HashSet<String>| {
        let key = path.to_string_lossy().to_string();
        if seen.insert(key) {
            dirs.push(path);
        }
    };

    for env_name in ["RETAIN_PDF_FONTS_DIR", "RETAIN_PDF_TYPST_FONT_DIRS"] {
        if let Ok(raw) = std::env::var(env_name) {
            let raw = raw.trim().to_string();
            if raw.is_empty() {
                continue;
            }
            let separator = if cfg!(windows) { ";" } else { ":" };
            let normalized = raw.replace(';', ",").replace(separator, ",");
            for part in normalized.split(',') {
                let part = part.trim();
                if !part.is_empty() {
                    push_dir(PathBuf::from(part), &mut dirs, &mut seen);
                }
            }
        }
    }

    for candidate in [
        project_root.join("fonts"),
        project_root.join("resources").join("fonts"),
        project_root.join("infra").join("fonts"),
        data_root.join("fonts"),
    ] {
        push_dir(candidate, &mut dirs, &mut seen);
    }

    dirs
}

fn family_from_filename(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    let mut base = stem.clone();
    for suffix in [
        "-Bold", "-Regular", "-Medium", "-Light", "-Heavy", "-Thin", "-Black",
    ] {
        if base
            .to_ascii_lowercase()
            .ends_with(&suffix.to_ascii_lowercase())
        {
            base = base[..base.len() - suffix.len()].to_string();
            break;
        }
    }
    if base.contains("SourceHanSerifSC") || base.contains("SourceHanSerif") {
        return "Source Han Serif SC".to_string();
    }
    if base.contains("SourceHanSansSC") || base.contains("SourceHanSans") {
        return "Source Han Sans SC".to_string();
    }
    if base.contains(' ') {
        return base;
    }
    base.replace(['_', '-'], " ").trim().to_string()
}

fn family_from_file(path: &Path) -> Option<String> {
    for binary in ["fc-query", "fc-scan"] {
        let output = Command::new(binary)
            .arg("--format")
            .arg("%{family[0]}\n")
            .arg(path)
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                let family = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !family.is_empty() {
                    let first = family
                        .split(',')
                        .next()
                        .unwrap_or(&family)
                        .trim()
                        .to_string();
                    if !first.is_empty() {
                        return Some(first);
                    }
                }
            }
        }
    }
    None
}

fn scan_fonts(dirs: &[PathBuf]) -> Vec<FontInfo> {
    let mut family_to_files: BTreeMap<String, Vec<String>> = BTreeMap::new();

    if let Ok(output) = Command::new("fc-list")
        .arg("-f")
        .arg("%{family[0]}:%{file}\n")
        .output()
    {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let line = line.trim();
                if line.is_empty() || !line.contains(':') {
                    continue;
                }
                let mut parts = line.splitn(2, ':');
                let family_part = parts.next().unwrap_or("").trim();
                let file_part = parts.next().unwrap_or("").trim();
                if family_part.is_empty() || file_part.is_empty() {
                    continue;
                }
                let family = family_part
                    .split(',')
                    .next()
                    .unwrap_or(family_part)
                    .trim()
                    .to_string();
                if dirs
                    .iter()
                    .any(|dir| file_part.starts_with(dir.to_string_lossy().as_ref()))
                {
                    family_to_files
                        .entry(family)
                        .or_default()
                        .push(file_part.to_string());
                }
            }
        }
    }

    for dir in dirs {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }
        for entry in walkdir::WalkDir::new(dir)
            .max_depth(4)
            .into_iter()
            .filter_map(Result::ok)
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if !FONT_EXTS.contains(&ext.as_str()) {
                continue;
            }
            let family = family_from_file(path).unwrap_or_else(|| family_from_filename(path));
            let family = family.trim().to_string();
            if family.is_empty() {
                continue;
            }
            let files = family_to_files.entry(family).or_default();
            let path = path.to_string_lossy().to_string();
            if !files.contains(&path) {
                files.push(path);
            }
        }
    }

    let mut fonts = family_to_files
        .into_iter()
        .map(|(family, mut files)| {
            files.sort();
            files.dedup();
            let available = files.iter().any(|file| Path::new(file).exists());
            FontInfo {
                family,
                files,
                available,
            }
        })
        .collect::<Vec<_>>();

    if !fonts
        .iter()
        .any(|font| font.family == "Source Han Serif SC")
    {
        let mut files = Vec::new();
        for dir in dirs {
            for name in ["SourceHanSerifSC-Bold.otf", "SourceHanSerifSC-Regular.otf"] {
                let path = dir.join(name);
                if path.exists() {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
        if !files.is_empty() {
            files.sort();
            files.dedup();
            fonts.push(FontInfo {
                family: "Source Han Serif SC".to_string(),
                files,
                available: true,
            });
        }
    }
    fonts.sort_by(|left, right| left.family.cmp(&right.family));
    fonts
}
