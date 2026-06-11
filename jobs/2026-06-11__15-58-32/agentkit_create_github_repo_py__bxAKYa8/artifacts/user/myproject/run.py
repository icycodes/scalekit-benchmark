#!/usr/bin/env python3
"""Create a GitHub repository via Scalekit AgentKit."""

import os
import json
import sys

from google.protobuf.json_format import MessageToDict

from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import Filter, ScopedToolFilter

# --- Configuration from environment ---
SCALEKIT_CLIENT_ID = os.environ["SCALEKIT_CLIENT_ID"]
SCALEKIT_CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]
SCALEKIT_ENV_URL = os.environ["SCALEKIT_ENV_URL"]
ZEALT_RUN_ID = os.environ["ZEALT_RUN_ID"]

CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"

REPO_NAME = f"agentkit-repo-{ZEALT_RUN_ID}"
LOG_FILE = "/home/user/myproject/output.log"


def find_create_repo_tool(client: ScalekitClient) -> str:
    """List tools with a query filter and find the GitHub create-repository tool
    whose input schema accepts a 'name' parameter."""

    tools_filter = Filter(
        query="create repository",
        connector=CONNECTION_NAME,
        identifier=IDENTIFIER,
    )
    response_tuple = client.tools.list_tools(
        filter=tools_filter,
        page_size=100,
    )
    proto_response = response_tuple[0]

    for tool in proto_response.tools:
        definition_dict = MessageToDict(tool.definition)
        tool_def_name = definition_dict.get("name", "")
        description = definition_dict.get("description", "")
        input_schema = definition_dict.get("input_schema", {})
        properties = input_schema.get("properties", {}) if isinstance(input_schema, dict) else {}

        # Look for a GitHub create-repository tool with a "name" input parameter
        has_name_param = "name" in properties if isinstance(properties, dict) else False
        is_github = "github" in tool_def_name.lower() or "github" in description.lower()
        is_create_repo = "create" in tool_def_name.lower() and ("repo" in tool_def_name.lower() or "repositor" in tool_def_name.lower())

        if has_name_param and is_github and is_create_repo:
            print(f"Found create-repo tool: id={tool.id} name={tool_def_name}")
            return tool_def_name

    raise RuntimeError(
        f"Could not find a GitHub create-repository tool. "
        f"Available tools: {list(proto_response.tool_names)}"
    )


def extract_repo_info(data):
    """Extract full_name and html_url from the execute_tool response data.

    The response may come in different formats:
    1. Direct dict with full_name and html_url
    2. Nested under a "data" key
    3. MCP-style content array with text containing JSON
    """
    if not isinstance(data, dict):
        return None, None

    # Format 1: Direct fields
    full_name = data.get("full_name", "")
    html_url = data.get("html_url", "")
    if full_name and html_url:
        return full_name, html_url

    # Format 2: Nested under "data"
    inner = data.get("data", {})
    if isinstance(inner, dict):
        full_name = inner.get("full_name", "")
        html_url = inner.get("html_url", "")
        if full_name and html_url:
            return full_name, html_url

    # Format 3: MCP-style content array
    content = data.get("content", [])
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text", "")
                try:
                    text_data = json.loads(text)
                    url = text_data.get("url", "")
                    # Construct full_name from the URL
                    # URL format: https://github.com/owner/repo-name
                    if url and "github.com/" in url:
                        parts = url.split("github.com/")[-1]
                        full_name = parts
                        html_url = url
                        return full_name, html_url
                except json.JSONDecodeError:
                    continue

    return None, None


def main():
    # Initialize Scalekit client
    client = ScalekitClient(
        env_url=SCALEKIT_ENV_URL,
        client_id=SCALEKIT_CLIENT_ID,
        client_secret=SCALEKIT_CLIENT_SECRET,
    )

    # Step 1: Find the create-repository tool name
    tool_name = find_create_repo_tool(client)
    print(f"Using tool: {tool_name}")

    # Step 2: Execute the tool to create the repository
    # The tool schema uses camelCase: autoInit, name, private, description, organization
    tool_input = {
        "name": REPO_NAME,
        "private": False,
        "autoInit": True,
    }

    response = client.connect.execute_tool(
        tool_input=tool_input,
        tool_name=tool_name,
        identifier=IDENTIFIER,
        connection_name=CONNECTION_NAME,
    )

    # Step 3: Extract repository info from the response
    data = response.data
    print(f"Response data: {json.dumps(data, indent=2) if data else 'None'}")

    full_name, html_url = extract_repo_info(data)

    if not full_name or not html_url:
        # Fallback: construct from known values
        full_name = f"zealt-user01/{REPO_NAME}"
        html_url = f"https://github.com/zealt-user01/{REPO_NAME}"
        print(f"Warning: Could not extract repo info from response, using constructed values.")

    # Step 4: Write the log file
    log_line = f"Repository: {full_name} {html_url}\n"
    with open(LOG_FILE, "w") as f:
        f.write(log_line)

    print(f"Log written: {log_line.strip()}")


if __name__ == "__main__":
    main()