#!/usr/bin/env python3
"""Create a Slack channel via Scalekit AgentKit for zealt-user01."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools import tools_pb2

CONNECTION_NAME = "slack-test"
CONNECTED_ACCOUNT_IDENTIFIER = "zealt-user01"
OUTPUT_LOG = Path(__file__).with_name("output.log")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def unwrap_response(result: Any) -> Any:
    """The SDK returns (protobuf_response, grpc_call); keep only the response."""
    if isinstance(result, tuple):
        return result[0]
    return result


def protobuf_to_dict(message: Any) -> dict[str, Any]:
    return MessageToDict(message, preserving_proto_field_name=True)


def find_channel_creation_tool(client: ScalekitClient) -> str:
    response = unwrap_response(
        client.tools.list_scoped_tools(
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            filter=tools_pb2.ScopedToolFilter(connection_names=[CONNECTION_NAME]),
            page_size=1000,
        )
    )

    for scoped_tool in response.tools:
        tool_definition = protobuf_to_dict(scoped_tool.tool).get("definition", {})
        tool_name = tool_definition.get("name")
        input_schema = tool_definition.get("input_schema", {})
        properties = input_schema.get("properties", {})
        description = tool_definition.get("description", "").lower()

        if (
            tool_name
            and "name" in properties
            and "channel" in tool_name.lower()
            and ("create" in tool_name.lower() or "create" in description)
        ):
            return tool_name

    raise RuntimeError(
        f"No Slack channel-creation tool with a name parameter was found for "
        f"{CONNECTED_ACCOUNT_IDENTIFIER!r} on {CONNECTION_NAME!r}."
    )


def find_channel_fields(value: Any) -> tuple[str, str] | None:
    """Recursively find the created Slack channel's name and id in a response."""
    if isinstance(value, dict):
        channel_id = value.get("id")
        channel_name = value.get("name")
        if isinstance(channel_id, str) and isinstance(channel_name, str):
            return channel_name, channel_id

        for nested in value.values():
            found = find_channel_fields(nested)
            if found:
                return found

    elif isinstance(value, list):
        for item in value:
            found = find_channel_fields(item)
            if found:
                return found

    return None


def main() -> None:
    run_id = require_env("ZEALT_RUN_ID")
    channel_name = f"agentkit-task-{run_id}"

    client = ScalekitClient(
        require_env("SCALEKIT_ENV_URL"),
        require_env("SCALEKIT_CLIENT_ID"),
        require_env("SCALEKIT_CLIENT_SECRET"),
    )

    tool_name = find_channel_creation_tool(client)
    response = unwrap_response(
        client.tools.execute_tool(
            tool_name=tool_name,
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            connection_name=CONNECTION_NAME,
            params={"name": channel_name, "is_private": False},
        )
    )

    response_data = protobuf_to_dict(response).get("data", {})
    channel_fields = find_channel_fields(response_data)
    if not channel_fields:
        raise RuntimeError(f"Could not find created channel id/name in response: {response_data}")

    created_channel_name, channel_id = channel_fields
    OUTPUT_LOG.write_text(f"Channel: {created_channel_name} ({channel_id})\n", encoding="utf-8")


if __name__ == "__main__":
    main()
