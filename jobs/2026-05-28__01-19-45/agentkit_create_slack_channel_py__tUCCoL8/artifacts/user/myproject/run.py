import os
from google.protobuf.json_format import MessageToDict

from scalekit.core import CoreClient
from scalekit.tools import ScopedToolFilter, ToolsClient


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def extract_schema(definition: dict) -> dict:
    for key in ("parameters", "inputSchema", "schema", "input_schema"):
        if key in definition and isinstance(definition[key], dict):
            return definition[key]
    return {}


def definition_text(definition: dict) -> str:
    name = definition.get("name", "")
    description = definition.get("description", "")
    return f"{name} {description}".lower()


def find_channel_create_tool(scoped_tools):
    candidates = []
    for scoped_tool in scoped_tools:
        tool = scoped_tool.tool
        definition = MessageToDict(tool.definition) if tool.definition else {}
        schema = extract_schema(definition)
        properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
        if "name" not in properties:
            continue
        tool_name = definition.get("name") or tool.id
        text = definition_text(definition)
        if "channel" in text and "create" in text:
            return scoped_tool, schema, tool_name
        candidates.append((scoped_tool, schema, tool_name))

    if candidates:
        return candidates[0]
    raise RuntimeError("No suitable Slack channel creation tool found.")


def build_params(schema: dict, channel_name: str) -> dict:
    params = {"name": channel_name}
    properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
    if "is_private" in properties:
        params["is_private"] = False
    if "private" in properties:
        params["private"] = False
    if "public" in properties:
        params["public"] = True
    return params


def find_channel_payload(data):
    if not isinstance(data, dict):
        return None
    if "id" in data:
        return data
    for value in data.values():
        if isinstance(value, dict):
            nested = find_channel_payload(value)
            if nested:
                return nested
    return None


def main() -> None:
    env_url = get_env("SCALEKIT_ENV_URL")
    client_id = get_env("SCALEKIT_CLIENT_ID")
    client_secret = get_env("SCALEKIT_CLIENT_SECRET")
    run_id = get_env("ZEALT_RUN_ID")

    channel_name = f"agentkit-task-{run_id}"

    core_client = CoreClient(env_url=env_url, client_id=client_id, client_secret=client_secret)
    tools_client = ToolsClient(core_client)

    scoped_filter = ScopedToolFilter(connection_names=["slack-test"])
    page_token = None
    scoped_tools = []
    while True:
        response, _call = tools_client.list_scoped_tools(
            identifier="zealt-user01",
            filter=scoped_filter,
            page_size=200,
            page_token=page_token,
        )
        scoped_tools.extend(response.tools)
        if not response.next_page_token:
            break
        page_token = response.next_page_token

    scoped_tool, schema, tool_name = find_channel_create_tool(scoped_tools)
    params = build_params(schema, channel_name)

    execution, _call = tools_client.execute_tool(
        tool_name=tool_name,
        identifier="zealt-user01",
        params=params,
        connected_account_id=scoped_tool.connected_account_id,
        connection_name="slack-test",
    )

    data = MessageToDict(execution.data) if execution.data else {}
    channel_payload = find_channel_payload(data) or {}
    created_name = channel_payload.get("name", channel_name)
    channel_id = channel_payload.get("id")
    if not channel_id:
        raise RuntimeError("Slack channel creation did not return a channel ID.")

    log_path = os.path.join(os.path.dirname(__file__), "output.log")
    with open(log_path, "w", encoding="utf-8") as log_file:
        log_file.write(f"Channel: {created_name} ({channel_id})\n")


if __name__ == "__main__":
    main()
