use std::path::{Path, PathBuf};
use std::time::Duration;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;

use super::{cached_output_is_fresh, job_artifacts_dir, DerivedArtifactDeps};

/// 比 side-by-side 宽：每页都要把源 PDF 渲成背景位图，整本几百页时这是大头。
const BUILD_TIMEOUT: Duration = Duration::from_secs(600);

pub(crate) const DEFAULT_BACKGROUND_DPI: u32 = 180;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LayoutDocxOptions {
    pub dpi: u32,
    /// 每页右下角放「logo + RetainPDF」水印（2026-11-20，下载默认带，`?watermark=0` 不带）。
    pub watermark: bool,
}

impl Default for LayoutDocxOptions {
    fn default() -> Self {
        Self {
            dpi: DEFAULT_BACKGROUND_DPI,
            watermark: false,
        }
    }
}

/// 排版导出器的版本。**改了导出逻辑就要加一**。
///
/// # 为什么需要它
///
/// 缓存只看**输入文件**（源 PDF、译文 PDF）变没变 —— 代码改动不是输入。于是导出器
/// 改了多少次，`cached_output_is_fresh` 都认为旧产物还新鲜，直接把老文件发出去。
///
/// 真发生过：2026-10-05 连修三个排版缺陷（空底数上标的虚线框、markdown 星号、西文
/// 断词），用户每次下载拿到的都是 01:12 生成的那一份，表现是「改了半天一点变化都
/// 没有」。当时 data/jobs 下还躺着 5 份缓存，最早的是 9 月 18 日的。
///
/// 版本进了文件名，所以加一之后旧产物不会被命中（也不会被删，磁盘上多占一份）。
const RENDERER_VERSION: u32 = 2;

impl LayoutDocxOptions {
    /// 缓存键的一部分：换了 DPI 或导出器版本就是另一份产物，不能命中上一份。
    pub fn cache_suffix(&self) -> String {
        if self.watermark {
            // 水印换了图案、位置（WATERMARK_VERSION 加一）也是另一份
            format!("dpi{}-v{}-wm{}", self.dpi, RENDERER_VERSION, super::watermark::WATERMARK_VERSION)
        } else {
            format!("dpi{}-v{}", self.dpi, RENDERER_VERSION)
        }
    }
}

pub fn ensure_layout_docx(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    job: &JobSnapshot,
    job_root: &Path,
    source_pdf: &Path,
    translated_pdf: Option<&Path>,
    options: LayoutDocxOptions,
) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir(data_root, job)?;
    let output_docx = output_dir.join(super::layout_docx_file_name(
        &job.job_id,
        &options.cache_suffix(),
    ));
    // 译文 PDF 在的时候也算输入:收敛后的字号和行距是从它里面读回来的（见 Python 侧
    // `typography_readback`），它一重渲染这份 docx 就过期了。不在的时候导出走
    // `html_fit`，只跟着源 PDF 和译文变。
    let mut inputs: Vec<&Path> = vec![source_pdf];
    inputs.extend(translated_pdf);
    if !cached_output_is_fresh(&output_docx, &inputs)? {
        super::side_by_side::build_with_command(
            &output_docx,
            "layout-docx",
            BUILD_TIMEOUT,
            &inputs,
            |temporary| {
                let mut command = std::process::Command::new(deps.pipeline_command);
                command
                    .arg("layout-docx")
                    .arg("--job-root")
                    .arg(job_root)
                    .arg("--output-docx")
                    .arg(temporary)
                    .arg("--dpi")
                    .arg(options.dpi.to_string())
                    // 把已经解析好的路径传过去，别让 Python 靠 job_root 再猜一遍。
                    // translate-only 的任务自己的 source/ 是空的，源 PDF 在上游 OCR
                    // 任务目录里——这边 resolve_source_pdf 找得到，那边按 job_root 找
                    // 不到，表现是整条导出 500 而报错里看不出原因。
                    .arg("--source-pdf")
                    .arg(source_pdf);
                if let Some(path) = translated_pdf {
                    command.arg("--translated-pdf").arg(path);
                }
                if options.watermark {
                    command.arg("--watermark");
                }
                command
            },
        )?;
    }
    Ok(output_docx)
}

#[cfg(test)]
#[path = "word_tests.rs"]
mod tests;
