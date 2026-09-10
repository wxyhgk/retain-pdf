use crate::app::AppState;
use crate::db::Db;

pub struct DocumentOperationRouteDeps<'a> {
    pub db: &'a Db,
    pub config: &'a crate::config::AppConfig,
}

pub fn build_document_operation_route_deps(state: &AppState) -> DocumentOperationRouteDeps<'_> {
    DocumentOperationRouteDeps {
        db: state.db.as_ref(),
        config: state.config.as_ref(),
    }
}
