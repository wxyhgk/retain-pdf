//! AI HTTP entry points and application-owned sidecar gateway.

pub(crate) mod api;
mod gateway;

pub(crate) use gateway::AiGateway;
