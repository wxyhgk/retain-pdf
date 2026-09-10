use crate::app::{build_jobs_facade_from_state, AppState};
use crate::services::jobs::JobsFacade;
use crate::services::library::LibraryDeps;

pub struct LibraryRouteDeps<'a> {
    pub library: LibraryDeps<'a>,
    /// Jobs creation path for document translate-from-library (and future library→job flows).
    pub jobs: JobsFacade<'a>,
    pub default_port: u16,
    pub bind_host: String,
}

pub fn build_library_route_deps(state: &AppState) -> LibraryRouteDeps<'_> {
    LibraryRouteDeps {
        library: LibraryDeps {
            db: state.db.as_ref(),
            data_root: &state.config.data_root,
            output_root: &state.config.output_root,
            downloads_dir: &state.config.downloads_dir,
            scripts_dir: &state.config.scripts_dir,
            python_bin: &state.config.python_bin,
            asset_config: &state.config.asset,
        },
        jobs: build_jobs_facade_from_state(state),
        default_port: state.config.port,
        bind_host: state.config.bind_host.clone(),
    }
}
