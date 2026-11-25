use retainpdf_api_base::error::AppError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{File, Metadata};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const MAX_LINE_BYTES: usize = 4 * 1024 * 1024;
const MAX_BATCH_BYTES: u64 = 1024 * 1024;

#[cfg(any(test, feature = "test-fixtures"))]
thread_local! { static READ_BYTES: std::cell::Cell<u64> = const { std::cell::Cell::new(0) }; }

fn record_read(bytes: u64) {
    #[cfg(any(test, feature = "test-fixtures"))]
    READ_BYTES.with(|count| count.set(count.get() + bytes));
    let _ = bytes;
}

#[cfg(any(test, feature = "test-fixtures"))]
pub(super) fn read_bytes() -> u64 {
    READ_BYTES.with(std::cell::Cell::get)
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub(super) struct Checkpoint {
    pub incarnation: String,
    pub identity: String,
    pub offset: u64,
    pub line: i64,
    pub size: u64,
    pub modified: String,
    pub prefix: String,
    pub boundary: String,
}

pub(super) struct SourceFile {
    pub path: PathBuf,
    pub size: u64,
    pub identity: String,
    pub modified: String,
}

pub(super) fn inspect(path: PathBuf) -> Result<Option<SourceFile>, AppError> {
    let meta = match std::fs::metadata(&path) {
        Ok(meta) => meta,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    if !meta.is_file() {
        return Err(AppError::conflict_because(
            "event_source_not_file",
            "pipeline event source is not a file",
        ));
    }
    Ok(Some(SourceFile {
        path,
        size: meta.len(),
        identity: identity(&meta),
        modified: format!("{:?}", meta.modified().ok()),
    }))
}

#[cfg(unix)]
fn identity(meta: &Metadata) -> String {
    use std::os::unix::fs::MetadataExt;
    format!("{}:{}", meta.dev(), meta.ino())
}
#[cfg(not(unix))]
fn identity(meta: &Metadata) -> String {
    format!("{:?}", meta.created().ok())
}

pub(super) fn changed(source: &SourceFile, checkpoint: &Checkpoint) -> Result<bool, AppError> {
    if source.identity != checkpoint.identity || source.size < checkpoint.offset {
        return Ok(true);
    }
    if source.size == checkpoint.size && source.modified == checkpoint.modified {
        return Ok(false);
    }
    if checkpoint.offset == 0 {
        return Ok(false);
    }
    let (prefix, boundary) = fingerprints(&source.path, checkpoint.offset)?;
    Ok(prefix != checkpoint.prefix
        || boundary != checkpoint.boundary
        || (source.size == checkpoint.size && source.modified != checkpoint.modified))
}

fn fingerprints(path: &Path, offset: u64) -> Result<(String, String), AppError> {
    let mut file = File::open(path)?;
    let amount = offset.min(256) as usize;
    let mut first = vec![0; amount];
    file.read_exact(&mut first)?;
    file.seek(SeekFrom::Start(offset.saturating_sub(amount as u64)))?;
    let mut last = vec![0; amount];
    file.read_exact(&mut last)?;
    record_read((amount * 2) as u64);
    Ok((digest(&first), digest(&last)))
}

pub(super) fn digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// At most one bounded batch and one bounded line live in memory. An
/// unterminated line never advances the persisted offset.
pub(super) fn read_batch(
    source: &SourceFile,
    checkpoint: &mut Checkpoint,
    limit: usize,
) -> Result<(Vec<(u64, i64, String)>, bool), AppError> {
    if checkpoint.size == source.size
        && checkpoint.modified == source.modified
        && checkpoint.offset <= source.size
        && !checkpoint.identity.is_empty()
    {
        return Ok((Vec::new(), false));
    }
    let mut file = File::open(&source.path)?;
    file.seek(SeekFrom::Start(checkpoint.offset))?;
    let mut reader = BufReader::new(file.take(source.size.saturating_sub(checkpoint.offset)));
    let initial_offset = checkpoint.offset;
    let mut records = Vec::new();
    let mut consumed = 0;
    while consumed < limit && checkpoint.offset - initial_offset < MAX_BATCH_BYTES {
        let start = checkpoint.offset;
        let mut bytes = Vec::new();
        let mut count = 0u64;
        let mut complete = false;
        loop {
            let buffer = reader.fill_buf()?;
            if buffer.is_empty() {
                break;
            }
            let end = buffer
                .iter()
                .position(|byte| *byte == b'\n')
                .map(|index| index + 1);
            let n = end.unwrap_or(buffer.len());
            count += n as u64;
            record_read(n as u64);
            if count <= MAX_LINE_BYTES as u64 {
                bytes.extend_from_slice(&buffer[..n]);
            }
            reader.consume(n);
            if end.is_some() {
                complete = true;
                break;
            }
        }
        if !complete {
            break;
        }
        consumed += 1;
        checkpoint.offset += count;
        checkpoint.line += 1;
        if count > MAX_LINE_BYTES as u64 {
            tracing::warn!(
                line = checkpoint.line,
                bytes = count,
                "oversized event line skipped"
            );
        } else if let Ok(line) = String::from_utf8(bytes) {
            records.push((start, checkpoint.line, line));
        } else {
            tracing::warn!(line = checkpoint.line, "non-UTF8 event line skipped");
        }
    }
    let more = (consumed == limit || checkpoint.offset - initial_offset >= MAX_BATCH_BYTES)
        && checkpoint.offset < source.size;
    checkpoint.identity = source.identity.clone();
    // While a batch remains, do not mark this file size as fully inspected.
    checkpoint.size = if more { checkpoint.offset } else { source.size };
    checkpoint.modified = if more {
        String::new()
    } else {
        source.modified.clone()
    };
    (checkpoint.prefix, checkpoint.boundary) = fingerprints(&source.path, checkpoint.offset)?;
    tracing::debug!(
        bytes_advanced = checkpoint.offset - initial_offset,
        parsed_lines = records.len(),
        pending = more,
        "event file checkpoint read"
    );
    Ok((records, more))
}
