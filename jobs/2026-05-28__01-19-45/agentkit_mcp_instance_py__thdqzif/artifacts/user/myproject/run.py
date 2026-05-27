import os
from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping

def main():
    # Read credentials from environment
    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    run_id = os.environ["ZEALT_RUN_ID"]

    # Initialize the Scalekit client
    scalekit_client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    # Build the MCP config name using the run-id
    config_name = f"agentkit-mcp-{run_id}"

    # Create the MCP config exposing both github-test and slack-test connections
    connection_tool_mappings = [
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test"),
    ]

    scalekit_client.actions.mcp.create_config(
        name=config_name,
        connection_tool_mappings=connection_tool_mappings,
    )

    # Ensure a per-user MCP instance for zealt-user01
    user_identifier = "zealt-user01"
    instance_response = scalekit_client.actions.mcp.ensure_instance(
        config_name=config_name,
        user_identifier=user_identifier,
    )

    # Extract the MCP URL from the response
    mcp_url = instance_response.instance.url

    # Write the required three lines to the log file
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")
    with open(log_path, "a") as f:
        f.write(f"Config: {config_name}\n")
        f.write(f"Identifier: {user_identifier}\n")
        f.write(f"MCP URL: {mcp_url}\n")

    print(f"Config: {config_name}")
    print(f"Identifier: {user_identifier}")
    print(f"MCP URL: {mcp_url}")

if __name__ == "__main__":
    main()
