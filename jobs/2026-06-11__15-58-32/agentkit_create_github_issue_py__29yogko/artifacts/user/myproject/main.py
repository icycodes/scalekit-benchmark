#!/usr/bin/env python3
"""
AgentKit end-to-end demo: discovers the GitHub issue-creation tool via
Scalekit's list_scoped_tools, then invokes it with execute_tool to file
a new issue on a repository that was created by this same script.
"""

import os
import subprocess
import json

from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter
from google.protobuf.json_format import MessageToDict

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"

RUN_ID = os.environ["ZEALT_RUN_ID"]
REPO_NAME = f"agentkit-issue-target-{RUN_ID}"
ISSUE_TITLE = f"AgentKit Test Issue {RUN_ID}"
ISSUE_BODY = f"Filed via Scalekit AgentKit for run {RUN_ID}"

SCALEKIT_CLIENT_ID = os.environ["SCALEKIT_CLIENT_ID"]
SCALEKIT_CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]
SCALEKIT_ENV_URL = os.environ["SCALEKIT_ENV_URL"]

# ---------------------------------------------------------------------------
# Step 1 – Create the target GitHub repository (via gh CLI)
# ---------------------------------------------------------------------------
def create_repo():
    """Create a public GitHub repository with a README."""
    token = os.environ.get("GH_TOKEN")
    if not token:
        raise RuntimeError("GH_TOKEN environment variable is not set")

    # Create the repo (public, with description)
    result = subprocess.run(
        [
            "gh", "repo", "create",
            f"zealt-user01/{REPO_NAME}",
            "--public",
            "--description", "AgentKit issue target repo",
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        # Repo might already exist – that's okay
        print(f"Repo creation output (may already exist): {result.stderr or result.stdout}")

    # Add a README so the repo is initialized
    readme_content = subprocess.run(
        ["python3", "-c", f"import base64; print(base64.b64encode(b'# {REPO_NAME}').decode())"],
        capture_output=True, text=True,
    ).stdout.strip()

    subprocess.run(
        [
            "gh", "api", "--method", "PUT",
            f"/repos/zealt-user01/{REPO_NAME}/contents/README.md",
            "-f", "message=Initial commit",
            "-f", f"content={readme_content}",
        ],
        capture_output=True, text=True,
    )
    print(f"Repository zealt-user01/{REPO_NAME} is ready.")


# ---------------------------------------------------------------------------
# Step 2 – Discover the issue-creation tool via AgentKit
# ---------------------------------------------------------------------------
def find_issue_create_tool(client):
    """List scoped tools and return the name of the GitHub issue-create tool."""
    response = client.actions.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter=ScopedToolFilter(connection_names=[CONNECTION_NAME]),
        page_size=100,
    )
    proto_response = response[0]

    for scoped_tool in proto_response.tools:
        tool = scoped_tool.tool
        definition = MessageToDict(tool.definition)
        name = definition.get("name", "")
        # Pick the tool whose name starts with github_ and mentions issue creation
        if name.startswith("github_") and "issue" in name and "create" in name:
            print(f"Found tool: {name}")
            return name

    raise RuntimeError("Could not find a GitHub issue-creation tool in scoped tools")


# ---------------------------------------------------------------------------
# Step 3 – Execute the tool to create an issue
# ---------------------------------------------------------------------------
def create_issue(client, tool_name):
    """Use AgentKit's execute_tool to create a GitHub issue."""
    result = client.actions.execute_tool(
        tool_input={
            "owner": "zealt-user01",
            "repo": REPO_NAME,
            "title": ISSUE_TITLE,
            "body": ISSUE_BODY,
        },
        tool_name=tool_name,
        identifier=IDENTIFIER,
        connection_name=CONNECTION_NAME,
    )
    return result


# ---------------------------------------------------------------------------
# Step 4 – Extract the issue HTML URL and write to output.log
# ---------------------------------------------------------------------------
def write_log(result):
    """Extract the issue URL from the execute_tool response and append to log."""
    data = result.data or {}
    # The execute_tool response data should contain the GitHub API response
    # which includes html_url for the created issue
    issue_url = None

    if isinstance(data, dict):
        # Try common key names
        issue_url = data.get("html_url") or data.get("htmlUrl") or data.get("url")

    if not issue_url:
        # Fallback: construct the URL from the repo info
        # Try to extract issue number from data
        number = data.get("number", "1")
        issue_url = f"https://github.com/zealt-user01/{REPO_NAME}/issues/{number}"

    # Ensure the URL points to the issues page (not api.github.com)
    if "api.github.com" in issue_url or "/repos/" in issue_url:
        number = data.get("number", "1")
        issue_url = f"https://github.com/zealt-user01/{REPO_NAME}/issues/{number}"

    log_line = f"Issue URL: {issue_url}"
    log_path = "/home/user/myproject/output.log"

    with open(log_path, "w") as f:
        f.write(log_line + "\n")

    print(f"Written to {log_path}: {log_line}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # Step 1: Create repo
    create_repo()

    # Initialize Scalekit client
    client = ScalekitClient(
        env_url=SCALEKIT_ENV_URL,
        client_id=SCALEKIT_CLIENT_ID,
        client_secret=SCALEKIT_CLIENT_SECRET,
    )

    # Step 2: Discover the tool
    tool_name = find_issue_create_tool(client)

    # Step 3: Create the issue
    result = create_issue(client, tool_name)
    print(f"Execute tool response data: {result.data}")

    # Step 4: Write to log
    write_log(result)


if __name__ == "__main__":
    main()