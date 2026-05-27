import os
from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping

def main():
    # Read environment variables
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not all([client_id, client_secret, env_url, run_id]):
        print("Error: Missing required environment variables.")
        return

    # Initialize ScalekitClient
    client = ScalekitClient(env_url, client_id, client_secret)
    
    config_name = f"agentkit-mcp-{run_id}"
    user_id = "zealt-user01"
    
    # Define connection mappings
    connection_tool_mappings = [
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test")
    ]
    
    try:
        # Create MCP config
        print(f"Creating MCP config: {config_name}")
        try:
            client.actions.mcp.create_config(
                name=config_name,
                connection_tool_mappings=connection_tool_mappings
            )
        except Exception as e:
            if "DUPLICATE_IDENTIFIER" in str(e):
                print(f"Config {config_name} already exists, proceeding.")
            else:
                raise e
        
        # Ensure MCP instance for the user
        print(f"Ensuring MCP instance for user: {user_id}")
        instance = client.actions.mcp.ensure_instance(
            config_name=config_name,
            user_identifier=user_id
        )
        
        # Extract MCP URL
        mcp_url = None
        if hasattr(instance, 'instance'):
            mcp_url = getattr(instance.instance, 'url', getattr(instance.instance, 'mcp_url', None))
        
        if not mcp_url:
            mcp_url = getattr(instance, 'url', getattr(instance, 'mcp_url', None))
        
        if not mcp_url:
            print("Error: Could not retrieve MCP URL from the instance.")
            return

        # Write to log file
        log_path = "/home/user/myproject/output.log"
        print(f"Writing results to {log_path}")
        with open(log_path, "a") as f:
            f.write(f"Config: {config_name}\n")
            f.write(f"Identifier: {user_id}\n")
            f.write(f"MCP URL: {mcp_url}\n")
            
        print("Success.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
