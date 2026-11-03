//! 合并译文的虚拟任务 id：`merged-<64 位十六进制文档 id>-<16 位十六进制指纹>`。
//!
//! 同一本书的多次范围翻译合成一个整本长度、任务形状的目录
//! `data/documents/<文档>/merged/<指纹>/`，读接口把它当成一个任务读。格式定义放在这里，
//! 是因为 Rust 的各个读接口都要从 id 认出目录（以前 Python 的 AI 服务也照抄了一份，2026-11-03 跟 AI 服务一起删了）。
//!
//! 格式卡得很死：id 会被拼进文件路径，任何不是定长小写十六进制的东西都不放行。

use std::path::{Path, PathBuf};

const PREFIX: &str = "merged-";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MergedJobId {
    pub document_id: String,
    pub fingerprint: String,
}

fn is_hex(value: &str, len: usize) -> bool {
    value.len() == len && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

impl MergedJobId {
    pub fn parse(job_id: &str) -> Option<Self> {
        let rest = job_id.strip_prefix(PREFIX)?;
        let (document_id, fingerprint) = rest.split_once('-')?;
        (is_hex(document_id, 64) && is_hex(fingerprint, 16)).then(|| Self {
            document_id: document_id.to_string(),
            fingerprint: fingerprint.to_string(),
        })
    }

    pub fn format(&self) -> String {
        format!("{PREFIX}{}-{}", self.document_id, self.fingerprint)
    }

    /// 合并目录：`data/documents/<文档>/merged/<指纹>`。
    pub fn root(&self, data_root: &Path) -> PathBuf {
        data_root
            .join("documents")
            .join(&self.document_id)
            .join("merged")
            .join(&self.fingerprint)
    }
}

pub fn is_merged_job_id(job_id: &str) -> bool {
    MergedJobId::parse(job_id).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOC: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    #[test]
    fn round_trips_and_locates_its_directories() {
        let id = MergedJobId { document_id: DOC.to_string(), fingerprint: "0123456789abcdef".to_string() };
        assert_eq!(MergedJobId::parse(&id.format()), Some(id.clone()));
        let data_root = Path::new("/data");
        assert_eq!(id.root(data_root), Path::new("/data/documents").join(DOC).join("merged/0123456789abcdef"));
    }

    #[test]
    fn rejects_anything_that_could_escape_its_directory() {
        for bad in [
            "20260921091127-99568a".to_string(),
            format!("merged-{DOC}-../../etc/x"),
            format!("merged-{DOC}-0123456789abcdeF"),
            format!("merged-{DOC}-0123456789abcde"),
            format!("merged-{}-0123456789abcdef", &DOC[..63]),
            format!("merged-../{}-0123456789abcdef", &DOC[3..]),
            format!("merged-{DOC}-0123456789abcdef/x"),
            "merged--".to_string(),
        ] {
            assert_eq!(MergedJobId::parse(&bad), None, "{bad} 被当成了虚拟 id");
        }
    }
}
