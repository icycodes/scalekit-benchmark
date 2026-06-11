#!/usr/bin/env python3
"""End-to-end Scalekit AgentKit GitHub issue creation proof."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter

OWNER = "zealt-user01"
CONNECTION_NAME = "github-test"
OUTPUT_LOG = Path("/home/user/myproject/output.log")


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def unwrap_response(response: Any) -> Any:
    """The SDK's grpc helper returns (message, call); keep the protobuf message."""
    if isinstance(response, tuple):
        return response[0]
    return response


def protobuf_to_dict(message: Any) -> dict[str, Any]:
    return MessageToDict(message, preserving_proto_field_name=True)


def create_public_repo(repo_name: str) -> None:
    full_name = f"{OWNER}/{repo_name}"
    subprocess.run(
        [
            "gh",
            "repo",
            "create",
            full_name,
            "--public",
            "--add-readme",
            "--description",
            f"AgentKit issue target {required_env('ZEALT_RUN_ID')}",
        ],
        check=True,
        text=True,
    )


def discover_issue_create_tool(client: ScalekitClient) -> str:
    scoped_filter = ScopedToolFilter(connection_names=[CONNECTION_NAME])
    response = unwrap_response(
        client.actions.tools.list_scoped_tools(
            identifier=OWNER,
            filter=scoped_filter,
            page_size=100,
        )
    )
    response_dict = protobuf_to_dict(response)
    tools = response_dict.get("tools", [])

    candidates: list[str] = []
    for scoped_tool in tools:
        tool = scoped_tool.get("tool", {})
        definition = tool.get("definition", {})
        name = definition.get("name") or tool.get("id", "")
        description = definition.get("description", "")
        display_name = definition.get("display_name", "")
        haystack = f"{name} {display_name} {description}".lower()
        if name.startswith("github_") and "issue" in haystack and "create" in haystack:
            candidates.append(name)

    if not candidates:
        available = [
            (scoped_tool.get("tool", {}).get("definition", {}).get("name") or scoped_tool.get("tool", {}).get("id"))
            for scoped_tool in tools
        ]
        raise RuntimeError(f"Could not discover a GitHub issue creation tool. Available tools: {available}")

    candidates.sort(key=lambda value: (value != "github_issue_create", value))
    return candidates[0]


def extract_issue_url(response_dict: dict[str, Any]) -> str:
    data = response_dict.get("data", response_dict)

    def walk(value: Any) -> str | None:
        if isinstance(value, dict):
            html_url = value.get("html_url")
            if isinstance(html_url, str) and "/issues/" in html_url:
                return html_url
            url = value.get("url")
            if isinstance(url, str) and url.startswith("https://github.com/") and "/issues/" in url:
                return url
            for nested in value.values():
                found = walk(nested)
                if found:
                    return found
        elif isinstance(value, list):
            for item in value:
                found = walk(item)
                if found:
                    return found
        return None

    issue_url = walk(data)
    if not issue_url:
        raise RuntimeError(f"Tool execution response did not include an issue HTML URL: {response_dict}")
    return issue_url


def main() -> None:
    run_id = required_env("ZEALT_RUN_ID")
    repo_name = f"agentkit-issue-target-{run_id}"
    issue_title = f"AgentKit Test Issue {run_id}"
    issue_body = f"Filed via Scalekit AgentKit for run {run_id}"

    create_public_repo(repo_name)

    client = ScalekitClient(
        env_url=required_env("SCALEKIT_ENV_URL"),
        client_id=required_env("SCALEKIT_CLIENT_ID"),
        client_secret=required_env("SCALEKIT_CLIENT_SECRET"),
    )

    tool_name = discover_issue_create_tool(client)
    execution_response = unwrap_response(
        client.actions.tools.execute_tool(
            tool_name=tool_name,
            identifier=OWNER,
            connection_name=CONNECTION_NAME,
            params={
                "owner": OWNER,
                "repo": repo_name,
                "title": issue_title,
                "body": issue_body,
            },
        )
    )
    issue_url = extract_issue_url(protobuf_to_dict(execution_response))

    OUTPUT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_LOG.open("a", encoding="utf-8") as log_file:
        log_file.write(f"Issue URL: {issue_url}\n")

    print(f"Created issue: {issue_url}")


if __name__ == "__main__":
    main()
