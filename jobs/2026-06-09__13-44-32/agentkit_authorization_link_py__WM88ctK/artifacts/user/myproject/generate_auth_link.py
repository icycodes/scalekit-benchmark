#!/usr/bin/env python3
"""
Generate an authorization link for a new user using Scalekit AgentKit.

This script:
1. Initializes the ScalekitClient with env vars
2. Creates/fetches a connected_account for the github-test connection
3. Generates a hosted authorization link
4. Writes the results to output.log
"""

import os
import sys

from scalekit import ScalekitClient
import scalekit.actions


def main():
    # Read environment variables
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    env_url = os.environ["SCALEKIT_ENV_URL"]
    run_id = os.environ["ZEALT_RUN_ID"]

    # Build the identifier
    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    # Initialize the Scalekit client
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    # Step 1: get_or_create_connected_account
    account_response = client.actions.get_or_create_connected_account(
        connection_name=connection_name,
        identifier=identifier,
    )

    connected_account = account_response.connected_account
    status = connected_account.status

    # Step 2: get_authorization_link
    auth_link_response = client.actions.get_authorization_link(
        identifier=identifier,
        connection_name=connection_name,
    )

    authorization_url = auth_link_response.link

    # Write results to log file
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")
    with open(output_path, "w") as f:
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Status: {status}\n")
        f.write(f"Authorization URL: {authorization_url}\n")

    print(f"Log written to {output_path}")
    print(f"Identifier: {identifier}")
    print(f"Status: {status}")
    print(f"Authorization URL: {authorization_url}")


if __name__ == "__main__":
    main()
