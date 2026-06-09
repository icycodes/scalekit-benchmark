#!/usr/bin/env python3
"""Provision a per-user Scalekit MCP server for zealt-user01."""

import os

from scalekit import ScalekitClient
from scalekit.actions.models.mcp_config import McpConfigConnectionToolMapping


def main():
    # Read environment variables
    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    run_id = os.environ["ZEALT_RUN_ID"]

    # Initialize the Scalekit client
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    config_name = f"agentkit-mcp-{run_id}"

    # Build connection tool mappings for both connections
    connection_tool_mappings = [
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test"),
    ]

    # Create the MCP config
    create_resp = client.actions.mcp.create_config(
        name=config_name,
        connection_tool_mappings=connection_tool_mappings,
    )
    created_config = create_resp.config
    print(f"Created MCP config: {created_config.name} (id={created_config.id})")

    # Ensure a per-user MCP instance for zealt-user01
    ensure_resp = client.actions.mcp.ensure_instance(
        config_name=config_name,
        user_identifier="zealt-user01",
    )
    instance = ensure_resp.instance
    mcp_url = instance.url
    print(f"Ensured MCP instance: {instance.name} -> {mcp_url}")

    # Write the log file
    log_dir = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(log_dir, "output.log")
    with open(log_path, "w") as f:
        f.write(f"Config: {config_name}\n")
        f.write("Identifier: zealt-user01\n")
        f.write(f"MCP URL: {mcp_url}\n")

    print(f"Log written to {log_path}")


if __name__ == "__main__":
    main()
