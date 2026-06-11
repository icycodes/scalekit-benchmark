#!/usr/bin/env python3
"""Verify that the Scalekit connected account fixture is ACTIVE.

This script performs a pre-flight read using Scalekit's Python SDK. It does not
create authorization links, call provider APIs, or mutate the connected account.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from scalekit import ScalekitClient


CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
OUTPUT_LOG = Path(__file__).with_name("output.log")
REQUIRED_ENV_VARS = (
    "SCALEKIT_CLIENT_ID",
    "SCALEKIT_CLIENT_SECRET",
    "SCALEKIT_ENV_URL",
)


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _status_value(status: object) -> str:
    """Return a stable string value for status strings or SDK enum values."""
    if status is None:
        return ""
    value = getattr(status, "value", status)
    return str(value)


def main() -> int:
    try:
        env = {name: _required_env(name) for name in REQUIRED_ENV_VARS}

        client = ScalekitClient(
            env_url=env["SCALEKIT_ENV_URL"],
            client_id=env["SCALEKIT_CLIENT_ID"],
            client_secret=env["SCALEKIT_CLIENT_SECRET"],
        )

        response = client.actions.get_or_create_connected_account(
            connection_name=CONNECTION_NAME,
            identifier=IDENTIFIER,
        )
        connected_account = getattr(response, "connected_account", None)
        if connected_account is None:
            raise RuntimeError("Scalekit response did not include connected_account")

        status = _status_value(getattr(connected_account, "status", None))
        connected_account_id = getattr(connected_account, "id", None) or ""

        if status != "ACTIVE":
            raise RuntimeError(
                f"Connected account {CONNECTION_NAME}/{IDENTIFIER} is not ACTIVE: {status!r}"
            )
        if not connected_account_id:
            raise RuntimeError("Connected account ID is empty")

        OUTPUT_LOG.write_text(
            "\n".join(
                (
                    f"Connection: {CONNECTION_NAME}",
                    f"Identifier: {IDENTIFIER}",
                    f"Status: {status}",
                    f"Connected Account ID: {connected_account_id}",
                )
            )
            + "\n",
            encoding="utf-8",
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
