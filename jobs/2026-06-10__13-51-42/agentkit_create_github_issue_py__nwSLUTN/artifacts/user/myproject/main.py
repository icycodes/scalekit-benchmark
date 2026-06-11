#!/usr/bin/env python3
"""Create a GitHub issue through Scalekit AgentKit.

This script:
1. Creates a public GitHub repo via the GitHub CLI.
2. Discovers the right GitHub issue-creation tool using AgentKit's list_scoped_tools.
3. Invokes the tool via execute_tool to file an issue.
4. Appends the issue URL to output.log.
"""

import os
import subprocess
import sys

from scalekit import ScalekitClient
from scalekit.tools import ScopedToolFilter


def main():
    # --- Read run-id from environment ---
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    repo_name = f"agentkit-issue-target-{run_id}"

    # --- Step 1: Create the target GitHub repository via gh CLI ---
    print(f"Creating GitHub repository: zealt-user01/{repo_name}")
    result = subprocess.run(
        ["gh", "repo", "create", f"zealt-user01/{repo_name}", "--public", "--add-readme"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ERROR: Failed to create repo: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    print(f"Repository created: {result.stdout.strip()}")

    # --- Step 2: Initialize the Scalekit SDK ---
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

    if not all([env_url, client_id, client_secret]):
        print("ERROR: Missing required Scalekit environment variables", file=sys.stderr)
        sys.exit(1)

    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    # --- Step 3: List scoped tools to discover the GitHub issue-creation tool ---
    connection_name = "github-test"
    identifier = "zealt-user01"

    print(f"Listing scoped tools for identifier={identifier}")

    # Build a filter scoped to the github-test connection
    scoped_filter = ScopedToolFilter()
    scoped_filter.connection_names.append(connection_name)

    # list_scoped_tools returns (response, metadata) tuple from gRPC with_call
    result_tuple = client.tools.list_scoped_tools(
        identifier=identifier,
        filter=scoped_filter,
        page_size=100,
    )
    response = result_tuple[0]  # ListScopedToolsResponse

    # Find the tool whose name starts with "github_" and mentions issue creation
    issue_tool_name = None
    for scoped_tool in response.tools:
        tool = scoped_tool.tool
        definition = dict(tool.definition)
        tool_name = definition.get("name", "")
        if tool_name.startswith("github_") and "issue" in tool_name.lower() and "create" in tool_name.lower():
            issue_tool_name = tool_name
            print(f"Found issue creation tool: {tool_name}")
            break

    if not issue_tool_name:
        print("ERROR: Could not find a GitHub issue creation tool", file=sys.stderr)
        # Print all tool names for debugging
        for scoped_tool in response.tools:
            print(f"  Available tool: {dict(scoped_tool.tool.definition).get('name', 'unknown')}", file=sys.stderr)
        sys.exit(1)

    # --- Step 4: Execute the tool to create an issue ---
    issue_title = f"AgentKit Test Issue {run_id}"
    issue_body = f"Filed via Scalekit AgentKit for run {run_id}"

    print(f"Creating issue: {issue_title}")

    result_tuple = client.tools.execute_tool(
        tool_name=issue_tool_name,
        identifier=identifier,
        connection_name=connection_name,
        params={
            "owner": "zealt-user01",
            "repo": repo_name,
            "title": issue_title,
            "body": issue_body,
        },
    )
    exec_response = result_tuple[0]  # ExecuteToolResponse

    # Extract the issue URL from the response data (protobuf Struct)
    response_data = dict(exec_response.data)
    print(f"Tool execution response: {response_data}")

    issue_url = response_data.get("html_url") or response_data.get("url")
    if not issue_url:
        print("ERROR: No URL found in tool execution response", file=sys.stderr)
        sys.exit(1)

    # --- Step 5: Write the issue URL to output.log ---
    output_dir = "/home/user/myproject"
    log_path = os.path.join(output_dir, "output.log")
    with open(log_path, "w") as f:
        f.write(f"Issue URL: {issue_url}\n")

    print(f"Issue URL written to {log_path}: {issue_url}")


if __name__ == "__main__":
    main()
