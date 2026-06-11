#!/usr/bin/env python3
"""
Verify that the Scalekit connected account for (github-test, zealt-user01)
is in the ACTIVE state.

Uses the Scalekit Python SDK's get_or_create_connected_account method
to fetch the connected account, checks its status, and writes the result
to output.log.
"""

import os
import sys

from scalekit import ScalekitClient

CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
LOG_FILE = "/home/user/myproject/output.log"


def main() -> None:
    # Initialize the Scalekit client from environment variables
    client = ScalekitClient(
        env_url=os.environ["SCALEKIT_ENV_URL"],
        client_id=os.environ["SCALEKIT_CLIENT_ID"],
        client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
    )

    # Fetch the connected account (idempotent — will get existing or create)
    response = client.actions.get_or_create_connected_account(
        connection_name=CONNECTION_NAME,
        identifier=IDENTIFIER,
    )

    connected_account = response.connected_account

    if connected_account is None:
        print("ERROR: No connected account returned", file=sys.stderr)
        sys.exit(1)

    account_id = connected_account.id
    status = connected_account.status

    # Write the log artifact
    log_lines = [
        f"Connection: {CONNECTION_NAME}",
        f"Identifier: {IDENTIFIER}",
        f"Status: {status}",
        f"Connected Account ID: {account_id}",
    ]

    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines) + "\n")

    print(f"Connected account status: {status}")

    # Fail loudly if the status is not ACTIVE
    if status != "ACTIVE":
        print(
            f"ERROR: Expected status ACTIVE, got {status}",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Connected account is ACTIVE. Verification passed.")


if __name__ == "__main__":
    main()