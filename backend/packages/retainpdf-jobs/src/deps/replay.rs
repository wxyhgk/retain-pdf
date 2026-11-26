use std::path::Path;

/// 单块调试与修订要调 Python 的那几样:replay 走 devtools 脚本,修订写回走
/// `retainpdf-pipeline translation-revise` 子命令。
#[derive(Clone)]
pub struct ReplayDeps<'a> {
    pub(crate) project_root: &'a Path,
    pub(crate) scripts_dir: &'a Path,
    pub(crate) python_bin: &'a str,
    pub(crate) pipeline_command: &'a str,
    pub(crate) data_root: &'a Path,
    /// 用量台账按 `output_root/<任务>` 找（和用量报表同一处），重放调模型也要记进去。
    pub(crate) output_root: &'a Path,
}

impl<'a> ReplayDeps<'a> {
    pub fn new(
        project_root: &'a Path,
        scripts_dir: &'a Path,
        python_bin: &'a str,
        pipeline_command: &'a str,
        data_root: &'a Path,
        output_root: &'a Path,
    ) -> Self {
        Self {
            project_root,
            scripts_dir,
            python_bin,
            pipeline_command,
            data_root,
            output_root,
        }
    }
}
