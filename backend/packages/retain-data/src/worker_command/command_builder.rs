use std::path::Path;

pub(super) struct CommandBuilder {
    parts: Vec<String>,
}

impl CommandBuilder {
    /// Build a stage worker command: `python_bin -m <module> [worker]`.
    /// Each stage is an independent OS process; stages never share memory
    /// and only exchange files (spec in, artifacts out).
    pub(super) fn new(python_bin: &str, module: &'static str, worker: Option<&'static str>) -> Self {
        let mut parts = vec![
            python_bin.to_string(),
            "-m".to_string(),
            module.to_string(),
        ];
        if let Some(worker) = worker {
            parts.push(worker.to_string());
        }
        Self { parts }
    }

    pub(super) fn arg(&mut self, name: &str, value: impl ToString) {
        self.parts.push(name.to_string());
        self.parts.push(value.to_string());
    }

    pub(super) fn path_arg(&mut self, name: &str, value: &Path) {
        self.arg(name, value.to_string_lossy());
    }

    pub(super) fn finish(self) -> Vec<String> {
        self.parts
    }
}
