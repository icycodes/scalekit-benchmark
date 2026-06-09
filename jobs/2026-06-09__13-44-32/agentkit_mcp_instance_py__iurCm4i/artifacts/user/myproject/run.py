import os
import sys
from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping

def main():
    # 1. Read ZEALT_RUN_ID from environment
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)
        
    # 2. Read Scalekit credentials from environment
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    
    if not env_url or not client_id or not client_secret:
        print("Error: Scalekit credentials (SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET) must be set in the environment.", file=sys.stderr)
        sys.exit(1)
        
    # 3. Initialize ScalekitClient
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )
    
    config_name = f"agentkit-mcp-{run_id}"
    user_identifier = "zealt-user01"
    
    # 4. Check if config already exists using list_configs
    print(f"Checking if MCP config '{config_name}' already exists...")
    try:
        existing_configs = client.actions.mcp.list_configs(filter_name=config_name)
        config_exists = any(cfg.name == config_name for cfg in existing_configs.configs)
    except Exception as e:
        print(f"Warning: Failed to list configs: {e}. Proceeding to try creating it.")
        config_exists = False
        
    if not config_exists:
        print(f"Creating MCP config '{config_name}'...")
        # Expose both github-test and slack-test connections
        mappings = [
            McpConfigConnectionToolMapping(connection_name="github-test"),
            McpConfigConnectionToolMapping(connection_name="slack-test")
        ]
        try:
            res_config = client.actions.mcp.create_config(
                name=config_name,
                connection_tool_mappings=mappings
            )
            print(f"Successfully created MCP config: {res_config.config.id}")
        except Exception as e:
            # If DUPLICATE_IDENTIFIER is raised because of a race condition or similar, we can ignore
            if "DUPLICATE_IDENTIFIER" in str(e) or "already exists" in str(e):
                print(f"MCP config '{config_name}' already exists (caught exception).")
            else:
                print(f"Error creating config: {e}", file=sys.stderr)
                sys.exit(1)
    else:
        print(f"MCP config '{config_name}' already exists.")
        
    # 5. Ensure per-user instance
    print(f"Ensuring MCP instance for user '{user_identifier}' against config '{config_name}'...")
    try:
        res_instance = client.actions.mcp.ensure_instance(
            config_name=config_name,
            user_identifier=user_identifier
        )
        instance = res_instance.instance
        mcp_url = getattr(instance, "url", getattr(instance, "mcp_url", None))
        if not mcp_url:
            raise ValueError("No URL found in the ensured MCP instance response.")
            
        print(f"Successfully ensured instance. MCP URL: {mcp_url}")
    except Exception as e:
        print(f"Error ensuring MCP instance: {e}", file=sys.stderr)
        sys.exit(1)
        
    # 6. Write exactly three lines to the log file
    log_file_path = "/home/user/myproject/output.log"
    print(f"Writing to log file at '{log_file_path}'...")
    try:
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        with open(log_file_path, "w") as f:
            f.write(f"Config: {config_name}\n")
            f.write(f"Identifier: {user_identifier}\n")
            f.write(f"MCP URL: {mcp_url}\n")
        print("Log file written successfully.")
    except Exception as e:
        print(f"Error writing to log file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
