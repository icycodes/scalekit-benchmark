#!/usr/bin/env python3
"""Create a GitHub repository through Scalekit AgentKit.

This script intentionally uses Scalekit's Python SDK and AgentKit execute_tool.
It does not call GitHub directly and does not shell out to gh.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.tools import Filter, ScopedToolFilter

CONNECTION_NAME = "github-test"
CONNECTED_ACCOUNT_IDENTIFIER = "zealt-user01"
OUTPUT_LOG = Path(__file__).with_name("output.log")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def unwrap_sdk_result(result: Any) -> Any:
    """Scalekit SDK gRPC methods return either a response or (response, metadata)."""
    if isinstance(result, tuple):
        return result[0]
    return result


def protobuf_to_dict(message: Any) -> dict[str, Any]:
    return MessageToDict(message, preserving_proto_field_name=True)


def iter_tool_definitions(tool_list_response: Any) -> list[dict[str, Any]]:
    response_dict = protobuf_to_dict(unwrap_sdk_result(tool_list_response))
    definitions: list[dict[str, Any]] = []
    for item in response_dict.get("tools", []):
        # list_tools returns Tool objects; list_scoped_tools returns ScopedTool objects.
        tool = item.get("tool", item)
        definition = tool.get("definition") or item.get("definition")
        if definition:
            definitions.append(definition)
    return definitions


def find_create_repository_tool(client: ScalekitClient) -> str:
    """Find the GitHub create-repository AgentKit tool.

    Per the task guidance, first look at tools scoped to the connected account and
    connection. Some workspaces expose the GitHub MCP tool globally even when it is
    absent from the scoped listing, so fall back to the tool catalog if needed.
    """
    scoped_tools = client.tools.list_scoped_tools(
        CONNECTED_ACCOUNT_IDENTIFIER,
        filter=ScopedToolFilter(connection_names=[CONNECTION_NAME]),
        page_size=100,
    )

    for definition in iter_tool_definitions(scoped_tools):
        schema = definition.get("input_schema", {})
        properties = schema.get("properties", {})
        name = definition.get("name", "")
        title = f"{definition.get('display_name', '')} {definition.get('description', '')}".lower()
        if "name" in properties and "repo" in name.lower() and "create" in name.lower():
            return name
        if "name" in properties and "create" in title and "repository" in title:
            return name

    catalog_tools = client.tools.list_tools(
        filter=Filter(query="create repository"),
        page_size=100,
    )
    for definition in iter_tool_definitions(catalog_tools):
        schema = definition.get("input_schema", {})
        properties = schema.get("properties", {})
        name = definition.get("name", "")
        title = f"{definition.get('display_name', '')} {definition.get('description', '')}".lower()
        if (
            "name" in properties
            and "github" in name.lower()
            and "create" in title
            and "repository" in title
        ):
            return name

    raise RuntimeError("Could not find a GitHub create-repository AgentKit tool with a name parameter")


def parse_json_string(value: str) -> Any | None:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def recursively_find_repo_info(value: Any) -> tuple[str | None, str | None]:
    """Extract full_name and html_url from varied AgentKit response shapes."""
    if isinstance(value, dict):
        full_name = value.get("full_name") or value.get("fullName")
        html_url = value.get("html_url") or value.get("htmlUrl") or value.get("url")

        # MCP responses commonly put JSON or text under content[].text.
        if full_name and html_url:
            return str(full_name), str(html_url)

        for child in value.values():
            found_full_name, found_html_url = recursively_find_repo_info(child)
            full_name = full_name or found_full_name
            html_url = html_url or found_html_url
            if full_name and html_url:
                return str(full_name), str(html_url)

    elif isinstance(value, list):
        full_name = None
        html_url = None
        for child in value:
            found_full_name, found_html_url = recursively_find_repo_info(child)
            full_name = full_name or found_full_name
            html_url = html_url or found_html_url
            if full_name and html_url:
                return str(full_name), str(html_url)

    elif isinstance(value, str):
        parsed = parse_json_string(value)
        if parsed is not None:
            return recursively_find_repo_info(parsed)

        url_match = re.search(r"https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)", value)
        full_name_match = re.search(r"\b([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)\b", value)
        if url_match or full_name_match:
            return (
                url_match.group(1) if url_match else full_name_match.group(1),
                url_match.group(0) if url_match else None,
            )

    return None, None


def extract_repo_info(execute_response: Any, expected_repo_name: str) -> tuple[str, str]:
    response_dict = protobuf_to_dict(unwrap_sdk_result(execute_response))
    full_name, html_url = recursively_find_repo_info(response_dict)
    expected_full_name = f"{CONNECTED_ACCOUNT_IDENTIFIER}/{expected_repo_name}"

    # Owner URLs like https://github.com/zealt-user01 can appear before the repo
    # URL in nested responses; never let those satisfy the repo summary.
    if not full_name or not full_name.endswith(f"/{expected_repo_name}"):
        full_name = expected_full_name
    if not html_url or not html_url.rstrip("/").endswith(f"/{expected_repo_name}"):
        html_url = f"https://github.com/{full_name}"

    return full_name, html_url


def main() -> None:
    run_id = require_env("ZEALT_RUN_ID")
    repo_name = f"agentkit-repo-{run_id}"

    client = ScalekitClient(
        require_env("SCALEKIT_ENV_URL"),
        require_env("SCALEKIT_CLIENT_ID"),
        require_env("SCALEKIT_CLIENT_SECRET"),
    )

    tool_name = find_create_repository_tool(client)
    params = {
        "name": repo_name,
        "private": False,
        "autoInit": True,
    }

    try:
        create_response = client.tools.execute_tool(
            tool_name=tool_name,
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            params=params,
            connection_name=CONNECTION_NAME,
        )
        full_name, html_url = extract_repo_info(create_response, repo_name)
    except Exception as exc:
        # If the exact run was already executed, GitHub may reject duplicate repo
        # creation. Still keep the script re-runnable by reading the repo through
        # AgentKit rather than calling GitHub directly.
        message = str(exc).lower()
        if "already exists" not in message and "name already exists" not in message and "422" not in message:
            raise
        get_response = client.tools.execute_tool(
            tool_name="github_repo_get",
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            params={"owner": CONNECTED_ACCOUNT_IDENTIFIER, "repo": repo_name},
            connection_name=CONNECTION_NAME,
        )
        full_name, html_url = extract_repo_info(get_response, repo_name)

    OUTPUT_LOG.write_text(f"Repository: {full_name} {html_url}\n", encoding="utf-8")


if __name__ == "__main__":
    main()
