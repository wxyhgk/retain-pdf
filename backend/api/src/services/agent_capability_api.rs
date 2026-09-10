//! Route-facing facade for short-lived backend agent capabilities.

pub use super::agent_capabilities::{
    issue_agent_capability, AgentCapabilityAction, AgentCapabilityClaims,
    AgentCapabilityIssueInput, AgentCapabilityIssueView, AGENT_CAPABILITY_ISSUE_SCHEMA,
};
