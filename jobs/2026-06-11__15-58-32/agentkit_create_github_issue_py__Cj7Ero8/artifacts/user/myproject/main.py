#!/usr/bin/env python3
"""
AgentKit end-to-end demo:
  1. Creates a public GitHub repo via the gh CLI.
  2. Discovers the GitHub issue-creation tool via Scalekit AgentKit.
  3. Files an issue on the new repo via AgentKit execute_tool.
  4. Appends the issue HTML URL to output.log.
"""

import os
import subprocess
import sys

from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
RUN_ID = os.environ["ZEALT_RUN_ID"]
REPO_NAME = f"agentkit-issue-target-{RUN_ID}"
REPO_OWNER = "zealt-user01"
CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
LOG_PATH = os.path.join(os.path.dirname(__file__), "output.log")

ISSUE_TITLE = f"AgentKit Test Issue {RUN_ID}"
ISSUE_BODY = f"Filed via Scalekit AgentKit for run {RUN_ID}"

# ---------------------------------------------------------------------------
# Step 1: Create the GitHub repository via gh CLI
# ---------------------------------------------------------------------------
print(f"[1] Creating GitHub repository {REPO_OWNER}/{REPO_NAME} ...")
result = subprocess.run(
    [
        "gh", "repo", "create",
        f"{REPO_OWNER}/{REPO_NAME}",
        "--public",
        "--add-readme",
    ],
    capture_output=True,
    text=True,
)
if result.returncode != 0:
    # If it already exists that's acceptable; any other error is fatal.
    if "already exists" not in result.stderr and "Name already exists" not in result.stderr:
        print(f"ERROR creating repo: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"  Repository already exists, continuing.")
else:
    print(f"  Created: {result.stdout.strip()}")

# ---------------------------------------------------------------------------
# Step 2: Initialise the Scalekit SDK
# ---------------------------------------------------------------------------
print("[2] Initialising Scalekit SDK ...")
client = ScalekitClient(
    client_id=os.environ["SCALEKIT_CLIENT_ID"],
    client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
    env_url=os.environ["SCALEKIT_ENV_URL"],
)

# ---------------------------------------------------------------------------
# Step 3: Discover the issue-creation tool
# ---------------------------------------------------------------------------
print("[3] Listing scoped tools for connection 'github-test' ...")
tool_filter = ScopedToolFilter(connection_names=[CONNECTION_NAME])
resp_tuple = client.actions.tools.list_scoped_tools(
    identifier=IDENTIFIER,
    filter=tool_filter,
    page_size=100,
)
tools_response = resp_tuple[0]

issue_tool_name = None
for scoped_tool in tools_response.tools:
    name_field = scoped_tool.tool.definition.fields.get("name")
    if name_field and "issue" in name_field.string_value.lower() and "create" in name_field.string_value.lower():
        issue_tool_name = name_field.string_value
        break

if issue_tool_name is None:
    all_names = [
        scoped_tool.tool.definition.fields["name"].string_value
        for scoped_tool in tools_response.tools
        if "name" in scoped_tool.tool.definition.fields
    ]
    print(f"ERROR: Could not find issue-creation tool. Available tools: {all_names}", file=sys.stderr)
    sys.exit(1)

print(f"  Found tool: {issue_tool_name}")

# ---------------------------------------------------------------------------
# Step 4: Execute the tool to create the issue
# ---------------------------------------------------------------------------
print(f"[4] Creating issue '{ISSUE_TITLE}' on {REPO_OWNER}/{REPO_NAME} ...")
exec_response = client.actions.execute_tool(
    tool_name=issue_tool_name,
    tool_input={
        "owner": REPO_OWNER,
        "repo": REPO_NAME,
        "title": ISSUE_TITLE,
        "body": ISSUE_BODY,
    },
    identifier=IDENTIFIER,
    connection_name=CONNECTION_NAME,
)

# ---------------------------------------------------------------------------
# Step 5: Extract the HTML URL and write to output.log
# ---------------------------------------------------------------------------
data = exec_response.data
if data is None:
    print(f"ERROR: execute_tool returned no data. Response: {exec_response}", file=sys.stderr)
    sys.exit(1)

# The GitHub API response is a flat dict returned directly as data
html_url = data.get("html_url") or data.get("htmlUrl")

if not html_url:
    print(f"ERROR: html_url not found in response data: {data}", file=sys.stderr)
    sys.exit(1)

print(f"  Issue created: {html_url}")

log_line = f"Issue URL: {html_url}"
with open(LOG_PATH, "a") as f:
    f.write(log_line + "\n")

print(f"[5] Written to {LOG_PATH}: {log_line}")
