#!/usr/bin/env python3
"""Verify that the (github-test, zealt-user01) connected account is ACTIVE in Scalekit."""

import os
import sys

from scalekit import ScalekitClient

CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")


def main() -> None:
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    if not all([client_id, client_secret, env_url]):
        print("ERROR: Missing required environment variables. "
              "Set SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_ENV_URL.",
              file=sys.stderr)
        sys.exit(1)

    client = ScalekitClient(
        client_id=client_id,
        client_secret=client_secret,
        env_url=env_url,
    )

    # fetch (or create) the connected account idempotently
    response = client.connect.get_or_create_connected_account(
        connection_name=CONNECTION_NAME,
        identifier=IDENTIFIER,
    )

    connected_account = response.connected_account

    if connected_account is None:
        print("ERROR: No connected account returned for "
              f"connection='{CONNECTION_NAME}', identifier='{IDENTIFIER}'.",
              file=sys.stderr)
        sys.exit(1)

    status = connected_account.status
    account_id = connected_account.id

    if status != "ACTIVE":
        print(f"ERROR: Connected account status is '{status}', expected 'ACTIVE'.",
              file=sys.stderr)
        sys.exit(1)

    if not account_id:
        print("ERROR: Connected account ID is empty.", file=sys.stderr)
        sys.exit(1)

    # Write the log artifact
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write(f"Connection: {CONNECTION_NAME}\n")
        f.write(f"Identifier: {IDENTIFIER}\n")
        f.write(f"Status: {status}\n")
        f.write(f"Connected Account ID: {account_id}\n")

    print(f"SUCCESS: Connected account '{account_id}' is ACTIVE.")
    print(f"Log written to: {LOG_PATH}")


if __name__ == "__main__":
    main()
