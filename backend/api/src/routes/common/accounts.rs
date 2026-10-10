use std::sync::Arc;

use crate::app::AppState;
use crate::services::accounts::api::AccountsService;

pub fn build_accounts_route_deps(state: &AppState) -> Arc<AccountsService> {
    state.accounts.clone()
}
