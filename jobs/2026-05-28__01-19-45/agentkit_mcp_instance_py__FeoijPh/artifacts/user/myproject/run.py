import os
from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping

def main():
    run_id = os.environ.get('ZEALT_RUN_ID')
    if not run_id:
        raise ValueError("ZEALT_RUN_ID not found in environment")

    client = ScalekitClient(
        env_url=os.environ['SCALEKIT_ENV_URL'],
        client_id=os.environ['SCALEKIT_CLIENT_ID'],
        client_secret=os.environ['SCALEKIT_CLIENT_SECRET']
    )

    config_name = f"agentkit-mcp-{run_id}"
    user_identifier = "zealt-user01"

    # Create MCP config
    client.actions.mcp.create_config(
        name=config_name,
        connection_tool_mappings=[
            McpConfigConnectionToolMapping(connection_name="github-test"),
            McpConfigConnectionToolMapping(connection_name="slack-test")
        ]
    )

    # Ensure MCP instance
    response = client.actions.mcp.ensure_instance(
        config_name=config_name,
        user_identifier=user_identifier
    )

    mcp_url = response.instance.url

    # Write to output.log
    with open('/home/user/myproject/output.log', 'a') as f:
        f.write(f"Config: {config_name}\n")
        f.write(f"Identifier: {user_identifier}\n")
        f.write(f"MCP URL: {mcp_url}\n")

if __name__ == "__main__":
    main()
