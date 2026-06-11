import os
import json
from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run")

    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    repo_name = f"agentkit-issue-target-{run_id}"

    payload = {
        "owner": "zealt-user01",
        "repo": repo_name,
        "title": f"AgentKit Test Issue {run_id}",
        "body": f"Filed via Scalekit AgentKit for run {run_id}"
    }

    print("Executing tool github_issue_create...")
    response = client.tools.execute_tool(
        tool_name="github_issue_create",
        identifier="zealt-user01",
        connection_name="github-test",
        params=payload
    )
    
    # response is a tuple (ExecuteToolResponse, ...)
    resp_obj = response[0]
    print(resp_obj)

if __name__ == "__main__":
    main()
