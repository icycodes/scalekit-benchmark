#!/usr/bin/env python3
"""List Scalekit AgentKit scoped tool names for a connected account."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools import tools_pb2

PROJECT_DIR = Path("/home/user/myproject")
TOOLS_PATH = PROJECT_DIR / "tools.json"
LOG_PATH = PROJECT_DIR / "output.log"

IDENTIFIER = "zealt-user01"
CONNECTION_NAME = "github-test"
PAGE_SIZE = 100


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def extract_tool_name(scoped_tool: Any) -> str:
    """Extract definition.name from a Scalekit scoped tool protobuf message."""
    scoped_tool_dict = MessageToDict(
        scoped_tool,
        preserving_proto_field_name=True,
    )

    # Current SDK shape: {"tool": {"definition": {"name": "..."}}}
    tool = scoped_tool_dict.get("tool", {})
    definition = tool.get("definition", {})
    name = definition.get("name")

    # Be tolerant of alternative dictionary casing/shapes.
    if not name:
        tool = scoped_tool_dict.get("tool", scoped_tool_dict)
        definition = tool.get("definition", scoped_tool_dict.get("definition", {}))
        name = definition.get("name")

    if not isinstance(name, str) or not name:
        raise RuntimeError(f"Unable to extract tool name from scoped tool: {scoped_tool_dict}")

    return name


def unwrap_grpc_response(response: Any) -> Any:
    """Return the protobuf response when SDK methods return (response, call)."""
    if isinstance(response, tuple):
        return response[0]
    return response


def main() -> None:
    client = ScalekitClient(
        env_url=require_env("SCALEKIT_ENV_URL"),
        client_id=require_env("SCALEKIT_CLIENT_ID"),
        client_secret=require_env("SCALEKIT_CLIENT_SECRET"),
    )

    scoped_filter = tools_pb2.ScopedToolFilter(
        connection_names=[CONNECTION_NAME],
    )

    tool_names: list[str] = []
    page_token = ""

    while True:
        response = unwrap_grpc_response(
            client.tools.list_scoped_tools(
                identifier=IDENTIFIER,
                filter=scoped_filter,
                page_size=PAGE_SIZE,
                page_token=page_token or None,
            )
        )

        tool_names.extend(extract_tool_name(scoped_tool) for scoped_tool in response.tools)

        page_token = response.next_page_token
        if not page_token:
            break

    PROJECT_DIR.mkdir(parents=True, exist_ok=True)
    TOOLS_PATH.write_text(json.dumps(tool_names, indent=2) + "\n", encoding="utf-8")
    LOG_PATH.write_text(f"Tools discovered: {len(tool_names)}\n", encoding="utf-8")


if __name__ == "__main__":
    main()
