"""
Create a GitHub repository via Scalekit AgentKit for user zealt-user01.

This script uses the Scalekit Python SDK's AgentKit proxy to call the GitHub
REST API through Scalekit's credential injection — not via direct GitHub REST
calls or the gh CLI.
"""

import os
import sys

from scalekit.client import ScalekitClient

# ---------------------------------------------------------------------------
# Configuration — read from environment, never hardcoded
# ---------------------------------------------------------------------------
SCALEKIT_ENV_URL = os.environ["SCALEKIT_ENV_URL"]
SCALEKIT_CLIENT_ID = os.environ["SCALEKIT_CLIENT_ID"]
SCALEKIT_CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]

# The run-id is injected at runtime; the repo name must NOT be hardcoded.
ZEALT_RUN_ID = os.environ["ZEALT_RUN_ID"]
REPO_NAME = f"agentkit-repo-{ZEALT_RUN_ID}"

# Scalekit connection / connected-account identifiers (workspace-specific literals)
CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")


def main() -> None:
    # 1. Initialise the Scalekit client with the three environment variables
    client = ScalekitClient(
        env_url=SCALEKIT_ENV_URL,
        client_id=SCALEKIT_CLIENT_ID,
        client_secret=SCALEKIT_CLIENT_SECRET,
    )

    # 2. List the tools scoped to zealt-user01 on the github-test connection
    #    (large page_size to capture all available tools).
    from scalekit.v1.tools.tools_pb2 import ScopedToolFilter
    from google.protobuf.json_format import MessageToDict

    scoped_tools_resp = client.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter=ScopedToolFilter(connection_names=[CONNECTION_NAME]),
        page_size=100,
    )
    scoped_result = scoped_tools_resp[0]
    tools_data = MessageToDict(scoped_result)

    # Discover a create-repository tool (one whose schema accepts a "name" param)
    create_tool_name = None
    for scoped_tool in tools_data.get("tools", []):
        tool_def = scoped_tool.get("tool", {}).get("definition", {})
        t_name = tool_def.get("name", "")
        properties = tool_def.get("input_schema", {}).get("properties", {})
        if "name" in properties and "create" in t_name.lower():
            create_tool_name = t_name
            break

    if create_tool_name:
        print(f"Found AgentKit create-repo tool: {create_tool_name}")
    else:
        print(
            "No dedicated create-repository tool found in scoped tool list; "
            "using Scalekit AgentKit proxy to POST /user/repos."
        )

    # 3. Create the repository via Scalekit AgentKit's proxy.
    #    client.actions.request() injects the user's OAuth credentials and
    #    routes the call through Scalekit — no direct GitHub REST or gh CLI call.
    create_resp = client.actions.request(
        connection_name=CONNECTION_NAME,
        identifier=IDENTIFIER,
        path="/user/repos",
        method="POST",
        body={
            "name": REPO_NAME,
            "private": False,
            "auto_init": True,
        },
    )

    if create_resp.status_code == 201:
        repo_data = create_resp.json()
        full_name = repo_data["full_name"]
        html_url = repo_data["html_url"]
        print(f"Repository created: {full_name}")
    elif create_resp.status_code == 422:
        # Repository already exists — fetch its details via the AgentKit proxy
        print(
            f"Repository '{REPO_NAME}' already exists; fetching existing repo info."
        )
        get_resp = client.actions.request(
            connection_name=CONNECTION_NAME,
            identifier=IDENTIFIER,
            path=f"/repos/{IDENTIFIER}/{REPO_NAME}",
            method="GET",
        )
        if get_resp.status_code != 200:
            print(
                f"ERROR: could not fetch existing repo ({get_resp.status_code}): {get_resp.text}",
                file=sys.stderr,
            )
            sys.exit(1)
        repo_data = get_resp.json()
        full_name = repo_data["full_name"]
        html_url = repo_data["html_url"]
        print(f"Existing repository: {full_name}")
    else:
        print(
            f"ERROR: unexpected status {create_resp.status_code}: {create_resp.text}",
            file=sys.stderr,
        )
        sys.exit(1)

    # 4. Write the required single-line summary to the log file.
    log_line = f"Repository: {full_name} {html_url}\n"
    with open(LOG_FILE, "w") as fh:
        fh.write(log_line)

    print(log_line, end="")
    print("Done.")


if __name__ == "__main__":
    main()
