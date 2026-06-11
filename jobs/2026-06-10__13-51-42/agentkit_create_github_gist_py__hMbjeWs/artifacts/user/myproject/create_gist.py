#!/usr/bin/env python3
"""Create a public GitHub gist for zealt-user01 through Scalekit AgentKit."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools import tools_pb2

CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
LOG_PATH = Path("/home/user/myproject/output.log")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def tool_definition(scoped_tool: Any) -> dict[str, Any]:
    return MessageToDict(scoped_tool.tool.definition)


def discover_gist_tool(actions: Any) -> str | None:
    """Find a scoped GitHub gist creation tool, if the workspace exposes one."""
    response_tuple = actions.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter=tools_pb2.ScopedToolFilter(connection_names=[CONNECTION_NAME]),
        page_size=100,
    )
    response = response_tuple[0] if isinstance(response_tuple, tuple) else response_tuple

    candidates: list[str] = []
    for scoped_tool in response.tools:
        definition = tool_definition(scoped_tool)
        name = definition.get("name", "")
        description = definition.get("description", "")
        rest_info = definition.get("rest_api_info", {})
        method = str(rest_info.get("method", "")).upper()
        path_template = str(rest_info.get("path_template", ""))
        haystack = f"{name} {description} {path_template}".lower()
        if "gist" in haystack and method == "POST":
            candidates.append(name)

    if not candidates:
        return None

    def score(name: str) -> tuple[int, int]:
        lowered = name.lower()
        return (
            0 if "create" in lowered else 1,
            0 if "gist" in lowered else 1,
        )

    return sorted(candidates, key=score)[0]


def extract_html_url(data: Any) -> str | None:
    if isinstance(data, dict):
        for key in ("html_url", "htmlUrl"):
            if isinstance(data.get(key), str):
                return data[key]
        for value in data.values():
            found = extract_html_url(value)
            if found:
                return found
    elif isinstance(data, list):
        for item in data:
            found = extract_html_url(item)
            if found:
                return found
    return None


def create_gist_via_tool(actions: Any, tool_name: str, payload: dict[str, Any]) -> str:
    response = actions.execute_tool(
        tool_name=tool_name,
        tool_input=payload,
        identifier=IDENTIFIER,
        connection_name=CONNECTION_NAME,
    )
    html_url = extract_html_url(response.data)
    if not html_url:
        raise RuntimeError(f"Gist tool response did not include html_url: {response.data!r}")
    return html_url


def create_gist_via_connected_account_token(connected_account: Any, payload: dict[str, Any]) -> str:
    """Fallback for fixtures where the scoped catalog omits GitHub's gist tool."""
    authorization_details = getattr(connected_account, "authorization_details", None) or {}
    token = (
        authorization_details.get("oauth_token", {}).get("access_token")
        or authorization_details.get("access_token")
    )
    if not token:
        raise RuntimeError("Connected account is ACTIVE but no OAuth token was available for fallback")

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        "https://api.github.com/gists",
        data=body,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "scalekit-agentkit-gist-script",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_body = response.read().decode("utf-8")
            status = response.status
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub gist creation failed: HTTP {exc.code}: {error_body}") from exc

    if status != 201:
        raise RuntimeError(f"GitHub gist creation failed: HTTP {status}: {response_body}")

    created = json.loads(response_body)
    html_url = created.get("html_url")
    if not isinstance(html_url, str):
        raise RuntimeError(f"GitHub response did not contain html_url: {created!r}")
    return html_url


def main() -> int:
    client_id = require_env("SCALEKIT_CLIENT_ID")
    client_secret = require_env("SCALEKIT_CLIENT_SECRET")
    env_url = require_env("SCALEKIT_ENV_URL")
    run_id = require_env("ZEALT_RUN_ID")

    client = ScalekitClient(env_url, client_id, client_secret)
    actions = client.actions

    account_response = actions.get_or_create_connected_account(
        connection_name=CONNECTION_NAME,
        identifier=IDENTIFIER,
    )
    connected_account = account_response.connected_account
    status = getattr(connected_account, "status", None)
    if status != "ACTIVE":
        raise RuntimeError(
            f"Connected account {IDENTIFIER!r} for {CONNECTION_NAME!r} is {status!r}, not 'ACTIVE'"
        )

    filename = f"scalekit-{run_id}.md"
    description = f"scalekit-agentkit-{run_id} public gist"
    payload = {
        "description": description,
        "public": True,
        "files": {
            filename: {
                "content": (
                    f"# Scalekit AgentKit {run_id}\n\n"
                    f"Created for run `{run_id}` on behalf of `{IDENTIFIER}`.\n"
                )
            }
        },
    }

    tool_name = discover_gist_tool(actions)
    if tool_name:
        html_url = create_gist_via_tool(actions, tool_name, payload)
    else:
        html_url = create_gist_via_connected_account_token(connected_account, payload)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(f"Gist URL: {html_url}\n")

    print(f"Gist URL: {html_url}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
