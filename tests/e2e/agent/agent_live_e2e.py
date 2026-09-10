#!/usr/bin/env python3
"""Run the real FX -> Agent CLI -> Rust API -> PDF operation acceptance flow."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from agent_live import scenarios, stack
from agent_live.contracts import LiveE2EError, Options, StackHandle
from agent_live.pdf_check import DEFAULT_FIXTURE


def parse_args(argv: Sequence[str] | None = None) -> Options:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--scenario",
        choices=("commit", "restart-recovery"),
        default="commit",
        help="run the single-turn commit flow or restart at result_ready",
    )
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--data-root", type=Path)
    parser.add_argument("--keep-data", action="store_true")
    parser.add_argument(
        "--prompt-gateway-key",
        action="store_true",
        help="read the Gateway key from a hidden terminal prompt when the env is empty",
    )
    parser.add_argument("--no-sync", action="store_true")
    parser.add_argument("--no-build", action="store_true")
    parser.add_argument("--startup-timeout", type=float, default=120.0)
    parser.add_argument("--turn-timeout", type=float, default=180.0)
    args = parser.parse_args(argv)
    if args.startup_timeout <= 0 or args.turn_timeout <= 0:
        parser.error("timeouts must be positive")
    fixture = args.fixture.expanduser().resolve()
    data_root = args.data_root.expanduser().resolve() if args.data_root else None
    return Options(
        scenario=args.scenario,
        fixture=fixture,
        data_root=data_root,
        keep_data=args.keep_data,
        prompt_gateway_key=args.prompt_gateway_key,
        sync=not args.no_sync,
        build=not args.no_build,
        startup_timeout=args.startup_timeout,
        turn_timeout=args.turn_timeout,
    )


def run(options: Options, environ: Mapping[str, str] | None = None) -> int:
    source_env = dict(os.environ if environ is None else environ)
    gateway_key = stack.gateway_key(options, source_env)
    data_root, owns_data_root = stack.prepare_data_root(options)
    active_stack: StackHandle | None = None
    log_paths: list[Path] = []
    api_keys: list[str] = []
    succeeded = False
    try:
        stack_handle = stack.start_stack(
            options, data_root, gateway_key, source_env, generation=1
        )
        active_stack = stack_handle
        log_paths.append(stack_handle.log_path)
        api_keys.append(stack_handle.api_key)
        stack.wait_ready(stack_handle, options.startup_timeout)
        if options.scenario == "restart-recovery":
            recovery = scenarios.exercise_recovery_phase_one(
                stack_handle, options, data_root
            )
            stack.stop_stack(stack_handle)
            active_stack = None
            stack_handle = stack.start_stack(
                options, data_root, gateway_key, source_env, generation=2
            )
            active_stack = stack_handle
            log_paths.append(stack_handle.log_path)
            api_keys.append(stack_handle.api_key)
            stack.wait_ready(stack_handle, options.startup_timeout)
            result = scenarios.exercise_recovery_phase_two(
                stack_handle, options, data_root, recovery
            )
        else:
            result = scenarios.exercise_commit(stack_handle, options, data_root)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        succeeded = True
        return 0
    except LiveE2EError as error:
        print(f"[agent-live-e2e] failed: {error}", file=sys.stderr)
        secrets_to_redact = (
            gateway_key,
            *api_keys,
            *stack.sensitive_environment_values(source_env),
        )
        for log_path in log_paths:
            diagnostic = stack.diagnostic_tail(log_path, secrets_to_redact)
            if diagnostic:
                print(f"[agent-live-e2e] diagnostic: {log_path.name}", file=sys.stderr)
                print(diagnostic, file=sys.stderr)
        print(f"[agent-live-e2e] preserved state: {data_root}", file=sys.stderr)
        return 1
    finally:
        if active_stack is not None:
            stack.stop_stack(active_stack)
        if succeeded and owns_data_root and not options.keep_data:
            shutil.rmtree(data_root)
        elif succeeded:
            print(f"[agent-live-e2e] state: {data_root}", file=sys.stderr)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        return run(parse_args(argv))
    except LiveE2EError as error:
        print(f"[agent-live-e2e] failed: {error}", file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001 - keep credentials out of tracebacks
        print(
            f"[agent-live-e2e] failed unexpectedly: {type(error).__name__}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
