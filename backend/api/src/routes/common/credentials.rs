use std::path::Path;

use crate::app::AppState;
use crate::db::Db;

pub struct CredentialRouteDeps<'a> {
    pub data_root: &'a Path,
    pub db: &'a Db,
}

pub fn build_credential_route_deps(state: &AppState) -> CredentialRouteDeps<'_> {
    CredentialRouteDeps {
        data_root: &state.config.data_root,
        db: state.db.as_ref(),
    }
}
