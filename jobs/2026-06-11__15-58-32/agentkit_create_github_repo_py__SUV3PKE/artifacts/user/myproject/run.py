"""
Create a GitHub repository via Scalekit AgentKit.

Uses the Scalekit Python SDK to invoke the `githubmcp_create_repository`
tool on behalf of the `zealt-user01` connected account through the
`github-test` connection.  The repository name is read at runtime from
the ZEALT_RUN_ID environment variable.
"""

import json
import os

from scalekit import ScalekitClient
from scalekit.common.exceptions import ScalekitBadRequestException

# ---------------------------------------------------------------------------
# Scalekit client initialisation
# ---------------------------------------------------------------------------
client = ScalekitClient(
    env_url=os.environ["SCALEKIT_ENV_URL"],
    client_id=os.environ["SCALEKIT_CLIENT_ID"],
    client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
)

# ---------------------------------------------------------------------------
# Resolve repository name from the run-id environment variable
# ---------------------------------------------------------------------------
run_id = os.environ["ZEALT_RUN_ID"]
repo_name = f"agentkit-repo-{run_id}"

print(f"Creating repository: {repo_name}")

# ---------------------------------------------------------------------------
# Execute the create-repository tool via Scalekit AgentKit
# ---------------------------------------------------------------------------
try:
    response = client.actions.execute_tool(
        tool_name="githubmcp_create_repository",
        tool_input={
            "name": repo_name,
            "private": False,
            "autoInit": True,
        },
        identifier="zealt-user01",
        connection_name="github-test",
    )

    # -----------------------------------------------------------------------
    # Parse the structured response
    # The tool returns data shaped like:
    #   {'content': [{'type': 'text', 'text': '{"id":"...","url":"https://..."}'}]}
    # -----------------------------------------------------------------------
    data = response.data
    content_items = data.get("content", [])
    if not content_items:
        raise RuntimeError(f"Unexpected empty content in response: {data}")

    payload_text = content_items[0].get("text", "")
    payload = json.loads(payload_text)

    html_url = payload.get("url", "")
    # Derive full_name from the URL (owner/repo)
    # html_url format: https://github.com/<owner>/<repo>
    full_name = "/".join(html_url.rstrip("/").split("/")[-2:])

except ScalekitBadRequestException as exc:
    # If the repository already exists, retrieve it instead of failing
    err_str = str(exc)
    if "already exists" in err_str or "name already exists" in err_str:
        print("Repository already exists; fetching details via github_repo_get …")
        get_resp = client.actions.execute_tool(
            tool_name="github_repo_get",
            tool_input={
                "owner": "zealt-user01",
                "repo": repo_name,
            },
            identifier="zealt-user01",
            connection_name="github-test",
        )
        repo_data = get_resp.data
        html_url = repo_data.get("html_url", f"https://github.com/zealt-user01/{repo_name}")
        full_name = repo_data.get("full_name", f"zealt-user01/{repo_name}")
    else:
        raise

print(f"Repository: {full_name}")
print(f"URL: {html_url}")

# ---------------------------------------------------------------------------
# Write the required log line
# ---------------------------------------------------------------------------
log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")
log_line = f"Repository: {full_name} {html_url}\n"

with open(log_path, "w", encoding="utf-8") as f:
    f.write(log_line)

print(f"Log written to: {log_path}")
print(log_line.strip())
