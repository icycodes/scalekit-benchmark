import os
from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping


def get_instance_url(instance):
    if hasattr(instance, "mcp_url") and instance.mcp_url:
        return instance.mcp_url
    if hasattr(instance, "url") and instance.url:
        return instance.url
    if isinstance(instance, (list, tuple)) and instance:
        return get_instance_url(instance[0])
    if isinstance(instance, dict):
        if instance.get("mcp_url"):
            return instance["mcp_url"]
        if instance.get("url"):
            return instance["url"]
        for key in ("instance", "mcp_instance", "data"):
            if key in instance:
                return get_instance_url(instance[key])
    for attr in ("data", "instance", "mcp_instance"):
        if hasattr(instance, attr):
            return get_instance_url(getattr(instance, attr))
    raise ValueError("MCP instance URL not found on response object")


def main() -> None:
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID environment variable is required")

    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

    if not env_url or not client_id or not client_secret:
        raise RuntimeError("Missing Scalekit environment variables")

    scalekit_client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    config_name = f"agentkit-mcp-{run_id}"

    connection_tool_mappings = [
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test"),
    ]

    try:
        scalekit_client.actions.mcp.create_config(
            name=config_name,
            connection_tool_mappings=connection_tool_mappings,
        )
    except Exception as exc:
        message = str(exc)
        if "already exists" not in message and "DUPLICATE_IDENTIFIER" not in message:
            raise

    instance = scalekit_client.actions.mcp.ensure_instance(
        config_name=config_name,
        user_identifier="zealt-user01",
    )

    mcp_url = get_instance_url(instance)

    log_path = "/home/user/myproject/output.log"
    with open(log_path, "a", encoding="utf-8") as log_file:
        log_file.write(f"Config: {config_name}\n")
        log_file.write("Identifier: zealt-user01\n")
        log_file.write(f"MCP URL: {mcp_url}\n")


if __name__ == "__main__":
    main()
