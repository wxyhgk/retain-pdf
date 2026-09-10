"""Compatibility facade for the host-owned Agent command broker."""

from . import agent_command_broker as _implementation
from .agent_command_broker import (
    AgentCommandBroker,
    BrokerCommand,
    BrokerScope,
    CapabilityIssuer,
    parse_broker_argv,
    parse_broker_command,
)

FxCommandBroker = AgentCommandBroker
_safe_operation_event = _implementation._safe_operation_event

__all__ = [
    "AgentCommandBroker",
    "BrokerCommand",
    "BrokerScope",
    "CapabilityIssuer",
    "FxCommandBroker",
    "parse_broker_argv",
    "parse_broker_command",
]
