use std::path::Path;

#[derive(Clone)]
pub(crate) struct ReplayDeps<'a> {
    pub(crate) project_root: &'a Path,
    pub(crate) scripts_dir: &'a Path,
    pub(crate) python_bin: &'a str,
    pub(crate) pipeline_command: &'a str,
    pub(crate) data_root: &'a Path,
}

impl<'a> ReplayDeps<'a> {
    pub(crate) fn new(
        project_root: &'a Path,
        scripts_dir: &'a Path,
        python_bin: &'a str,
        pipeline_command: &'a str,
        data_root: &'a Path,
    ) -> Self {
        Self {
            project_root,
            scripts_dir,
            python_bin,
            pipeline_command,
            data_root,
        }
    }
}
