#!/usr/bin/env python3
"""Generate a Scalekit AgentKit authorization link for a new connected account."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from scalekit import ScalekitClient


PROJECT_DIR = Path(__file__).resolve().parent
LOG_FILE = PROJECT_DIR / "output.log"
CONNECTION_NAME = "github-test"


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    run_id = require_env("ZEALT_RUN_ID")
    identifier = f"agentkit-link-user-{run_id}"

    client_id = require_env("SCALEKIT_CLIENT_ID")
    client_secret = require_env("SCALEKIT_CLIENT_SECRET")
    env_url = require_env("SCALEKIT_ENV_URL")

    scalekit = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    account_response = scalekit.actions.get_or_create_connected_account(
        connection_name=CONNECTION_NAME,
        identifier=identifier,
    )
    connected_account = account_response.connected_account
    if connected_account is None:
        raise RuntimeError("Scalekit did not return a connected account")

    auth_response = scalekit.actions.get_authorization_link(
        connection_name=CONNECTION_NAME,
        identifier=identifier,
    )
    authorization_url = auth_response.link
    if not authorization_url:
        raise RuntimeError("Scalekit did not return an authorization link")

    parsed_url = urlparse(authorization_url)
    if parsed_url.scheme != "https":
        raise RuntimeError(f"Authorization URL is not https: {authorization_url}")

    status = connected_account.status
    if not status:
        raise RuntimeError("Scalekit connected account status was empty")

    LOG_FILE.write_text(
        "\n".join(
            [
                f"Identifier: {identifier}",
                f"Status: {status}",
                f"Authorization URL: {authorization_url}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        LOG_FILE.write_text(f"ERROR: {exc}\n", encoding="utf-8")
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
