import os
from urllib.parse import urlparse

from scalekit import ScalekitClient
from scalekit.actions.types import McpConfigConnectionToolMapping


CONFIG_PREFIX = "agentkit-mcp-"
USER_IDENTIFIER = "zealt-user01"
LOG_FILE = os.path.join(os.path.dirname(__file__), "output.log")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def extract_mcp_url(obj) -> str:
    """Return the MCP URL from the SDK response across supported SDK shapes."""
    seen = set()

    def walk(value):
        if value is None:
            return None

        value_id = id(value)
        if value_id in seen:
            return None
        seen.add(value_id)

        if isinstance(value, str):
            return value if value.startswith("https://") else None

        if isinstance(value, dict):
            for key in ("mcp_url", "url"):
                candidate = value.get(key)
                if isinstance(candidate, str) and candidate.startswith("https://"):
                    return candidate
            for candidate in value.values():
                found = walk(candidate)
                if found:
                    return found
            return None

        for attr in ("mcp_url", "url"):
            candidate = getattr(value, attr, None)
            if isinstance(candidate, str) and candidate.startswith("https://"):
                return candidate

        for attr in ("instance", "mcp_instance", "data", "result", "payload"):
            if hasattr(value, attr):
                found = walk(getattr(value, attr))
                if found:
                    return found

        if hasattr(value, "model_dump"):
            found = walk(value.model_dump())
            if found:
                return found

        if hasattr(value, "dict"):
            found = walk(value.dict())
            if found:
                return found

        if hasattr(value, "__dict__"):
            found = walk(vars(value))
            if found:
                return found

        return None

    mcp_url = walk(obj)
    if not mcp_url:
        raise RuntimeError("Unable to find MCP URL on ensure_instance response")
    return mcp_url


def validate_scalekit_https_url(mcp_url: str) -> None:
    parsed = urlparse(mcp_url)
    if parsed.scheme != "https" or "scalekit" not in parsed.netloc.lower():
        raise RuntimeError(f"ensure_instance returned an unexpected MCP URL: {mcp_url}")


def main() -> None:
    run_id = require_env("ZEALT_RUN_ID")
    config_name = f"{CONFIG_PREFIX}{run_id}"

    scalekit_client = ScalekitClient(
        require_env("SCALEKIT_ENV_URL"),
        require_env("SCALEKIT_CLIENT_ID"),
        require_env("SCALEKIT_CLIENT_SECRET"),
    )

    connection_tool_mappings = [
        McpConfigConnectionToolMapping(connection_name="github-test"),
        McpConfigConnectionToolMapping(connection_name="slack-test"),
    ]

    scalekit_client.actions.mcp.create_config(
        name=config_name,
        connection_tool_mappings=connection_tool_mappings,
    )

    instance = scalekit_client.actions.mcp.ensure_instance(
        config_name=config_name,
        user_identifier=USER_IDENTIFIER,
    )
    mcp_url = extract_mcp_url(instance)
    validate_scalekit_https_url(mcp_url)

    with open(LOG_FILE, "a", encoding="utf-8") as log_file:
        log_file.write(f"Config: {config_name}\n")
        log_file.write(f"Identifier: {USER_IDENTIFIER}\n")
        log_file.write(f"MCP URL: {mcp_url}\n")


if __name__ == "__main__":
    main()
