#!/usr/bin/env python3
"""Create a Slack channel and post a message through Scalekit AgentKit."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient

CONNECTION_NAME = "slack-test"
IDENTIFIER = "zealt-user01"
OUTPUT_LOG = Path("output.log")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalize_channel_name(run_id: str) -> str:
    """Build a Slack-safe channel name with the required run-id suffix."""
    channel_name = f"harbor-msg-{run_id}".lower()
    channel_name = re.sub(r"[^a-z0-9-]", "-", channel_name)
    channel_name = re.sub(r"-+", "-", channel_name).strip("-")
    if len(channel_name) > 80:
        raise RuntimeError(
            f"Channel name {channel_name!r} is {len(channel_name)} chars; Slack allows at most 80"
        )
    return channel_name


def unwrap_response(response: Any) -> Any:
    """The SDK may return either a response object or (response, metadata)."""
    if isinstance(response, tuple):
        return response[0]
    return response


def tool_definition(tool: Any) -> dict[str, Any]:
    return MessageToDict(tool.definition, preserving_proto_field_name=True)


def list_slack_tools(scalekit: ScalekitClient) -> list[dict[str, Any]]:
    response = unwrap_response(
        scalekit.actions.tools.list_scoped_tools(
            identifier=IDENTIFIER,
            filter={"connection_names": [CONNECTION_NAME]},
            page_size=100,
        )
    )

    discovered: list[dict[str, Any]] = []
    for scoped_tool in response.tools:
        tool = scoped_tool.tool
        definition = tool_definition(tool)
        discovered.append(
            {
                "id": tool.id,
                "provider": tool.provider,
                "name": definition.get("name"),
                "display_name": definition.get("display_name"),
                "description": definition.get("description"),
                "rest_api_info": definition.get("rest_api_info") or {},
                "input_schema": definition.get("input_schema") or {},
            }
        )
    return discovered


def choose_tool(tools: list[dict[str, Any]], *, exact_name: str, path: str | None = None) -> str:
    for tool in tools:
        if tool.get("name") == exact_name:
            return exact_name

    if path is not None:
        for tool in tools:
            if (tool.get("rest_api_info") or {}).get("path_template") == path and tool.get("name"):
                return str(tool["name"])

    available = ", ".join(str(t.get("name")) for t in tools)
    raise RuntimeError(f"Could not find required Slack tool {exact_name!r}. Available tools: {available}")


def execute_tool(scalekit: ScalekitClient, tool_name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
    result = scalekit.actions.execute_tool(
        tool_name=tool_name,
        identifier=IDENTIFIER,
        connection_name=CONNECTION_NAME,
        tool_input=tool_input,
    )
    result = unwrap_response(result)
    data = getattr(result, "data", None)
    if not isinstance(data, dict):
        raise RuntimeError(f"Tool {tool_name!r} returned no data payload: {result!r}")
    if data.get("ok") is False:
        raise RuntimeError(f"Tool {tool_name!r} failed: {json.dumps(data, sort_keys=True)}")
    return data


def main() -> None:
    scalekit = ScalekitClient(
        require_env("SCALEKIT_ENV_URL"),
        require_env("SCALEKIT_CLIENT_ID"),
        require_env("SCALEKIT_CLIENT_SECRET"),
    )

    run_id = require_env("ZEALT_RUN_ID")
    channel_name = normalize_channel_name(run_id)
    message_text = f"Hello from Harbor evaluation run {run_id}"

    tools = list_slack_tools(scalekit)
    create_channel_tool = choose_tool(
        tools,
        exact_name="slack_create_channel",
        path="/conversations.create",
    )
    send_message_tool = choose_tool(tools, exact_name="slack_send_message")

    create_data = execute_tool(
        scalekit,
        create_channel_tool,
        {"name": channel_name, "is_private": False},
    )

    channel = create_data.get("channel") or {}
    channel_id = channel.get("id")
    if not channel_id:
        raise RuntimeError(f"Create channel response did not include channel.id: {json.dumps(create_data)}")

    message_data = execute_tool(
        scalekit,
        send_message_tool,
        {"channel": channel_id, "text": message_text},
    )

    message_ts = message_data.get("ts")
    if not message_ts:
        raise RuntimeError(f"Send message response did not include ts: {json.dumps(message_data)}")

    OUTPUT_LOG.write_text(
        f"Channel ID: {channel_id}\n"
        f"Message TS: {message_ts}\n",
        encoding="utf-8",
    )

    print(f"Created Slack channel #{channel.get('name', channel_name)} ({channel_id})")
    print(f"Posted message ts {message_ts}")


if __name__ == "__main__":
    main()
