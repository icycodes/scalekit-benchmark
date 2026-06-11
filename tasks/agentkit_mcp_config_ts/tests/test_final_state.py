import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID is not set in the verifier environment."
    return run_id


def parse_log_file() -> dict:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE) as f:
        content = f.read()
    fields: dict = {}
    name_match = re.search(r"^MCP Config Name:\s*(\S+)\s*$", content, re.MULTILINE)
    id_match = re.search(r"^MCP Config ID:\s*(\S+)\s*$", content, re.MULTILINE)
    url_match = re.search(r"^MCP Server URL:\s*(\S+)\s*$", content, re.MULTILINE)
    if name_match:
        fields["name"] = name_match.group(1)
    if id_match:
        fields["id"] = id_match.group(1)
    if url_match:
        fields["url"] = url_match.group(1)
    return fields


def get_scalekit_client():
    from scalekit import ScalekitClient

    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    return ScalekitClient(env_url, client_id, client_secret)


def find_config_by_name(client, name: str):
    """Return the first config whose .name == name, or None."""
    # Try the filter_name kwarg first; fall back to scanning if unsupported.
    try:
        resp = client.actions.mcp.list_configs(filter_name=name)
    except TypeError:
        resp = client.actions.mcp.list_configs()
    configs = getattr(resp, "configs", None) or []
    for cfg in configs:
        if getattr(cfg, "name", None) == name:
            return cfg
    return None


def get_mapping_tools(cfg, connection_name: str):
    mappings = getattr(cfg, "connection_tool_mappings", None) or []
    for m in mappings:
        if getattr(m, "connection_name", None) == connection_name:
            tools = getattr(m, "tools", None) or []
            return [str(t) for t in tools]
    return None


@pytest.fixture(scope="module")
def expected_name():
    return f"harbor-mcp-{get_run_id()}"


@pytest.fixture(scope="module")
def parsed_log():
    return parse_log_file()


@pytest.fixture(scope="module")
def scalekit_config(expected_name):
    client = get_scalekit_client()
    cfg = find_config_by_name(client, expected_name)
    yield cfg
    # Best-effort cleanup
    if cfg is not None:
        try:
            client.actions.mcp.delete_config(config_id=getattr(cfg, "id", None))
        except Exception:
            pass


def test_log_file_contains_config_name(parsed_log, expected_name):
    assert "name" in parsed_log, (
        f"Log file {LOG_FILE} must contain a line "
        f"'MCP Config Name: <name>'."
    )
    assert parsed_log["name"] == expected_name, (
        f"Expected MCP Config Name to be '{expected_name}', "
        f"got '{parsed_log['name']}'."
    )


def test_log_file_contains_config_id(parsed_log):
    assert "id" in parsed_log, (
        f"Log file {LOG_FILE} must contain a line "
        f"'MCP Config ID: <id>'."
    )
    assert parsed_log["id"], "MCP Config ID in log must be a non-empty string."


def test_log_file_contains_mcp_server_url(parsed_log):
    assert "url" in parsed_log, (
        f"Log file {LOG_FILE} must contain a line "
        f"'MCP Server URL: <url>'."
    )
    assert parsed_log["url"].startswith("https://"), (
        f"MCP Server URL in log must start with 'https://', "
        f"got '{parsed_log['url']}'."
    )


def test_scalekit_config_exists(scalekit_config, expected_name):
    assert scalekit_config is not None, (
        f"No Scalekit Virtual MCP config named '{expected_name}' was found via "
        f"the Scalekit API; expected the task to create it."
    )


def test_log_ids_match_scalekit(scalekit_config, parsed_log):
    assert scalekit_config is not None, "Scalekit config was not created."
    api_id = getattr(scalekit_config, "id", None)
    api_url = getattr(scalekit_config, "mcp_server_url", None)
    assert api_id == parsed_log.get("id"), (
        f"Log MCP Config ID '{parsed_log.get('id')}' does not match the "
        f"id returned by the Scalekit API '{api_id}'."
    )
    assert api_url == parsed_log.get("url"), (
        f"Log MCP Server URL '{parsed_log.get('url')}' does not match the "
        f"url returned by the Scalekit API '{api_url}'."
    )


def test_github_mapping_contains_list_repos_tool(scalekit_config):
    assert scalekit_config is not None, "Scalekit config was not created."
    tools = get_mapping_tools(scalekit_config, "github-test")
    assert tools is not None, (
        "Created MCP config is missing a connection mapping for 'github-test'."
    )
    assert "github_list_repos_for_authenticated_user" in tools, (
        "Expected 'github_list_repos_for_authenticated_user' in the tools list "
        f"for the 'github-test' mapping, got: {tools}."
    )


def test_slack_mapping_contains_send_message_tool(scalekit_config):
    assert scalekit_config is not None, "Scalekit config was not created."
    tools = get_mapping_tools(scalekit_config, "slack-test")
    assert tools is not None, (
        "Created MCP config is missing a connection mapping for 'slack-test'."
    )
    assert "slack_send_message" in tools, (
        "Expected 'slack_send_message' in the tools list for the "
        f"'slack-test' mapping, got: {tools}."
    )
