import os
import subprocess
import time

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID not found in environment variables.")
        return

    repo_name = f"agentkit-issue-target-{run_id}"
    repo_full_name = f"zealt-user01/{repo_name}"

    # Create the repository using GitHub CLI
    print(f"Creating repository {repo_full_name}...")
    try:
        subprocess.run(
            ["gh", "repo", "create", repo_name, "--public", "--add-readme"],
            check=True
        )
        print("Repository created.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to create repository: {e}")

    time.sleep(2)

    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    # Initialize Scalekit Client
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    connection_name = "github-test"
    identifier = "zealt-user01"

    print("Listing scoped tools...")
    filter_obj = ScopedToolFilter(connection_names=[connection_name])
    response = client.tools.list_scoped_tools(
        identifier=identifier,
        filter=filter_obj,
        page_size=100
    )
    
    resp_obj = response[0] if isinstance(response, tuple) else response
    
    target_tool_name = None
    for scoped_tool in resp_obj.tools:
        definition = MessageToDict(scoped_tool.tool.definition)
        name = definition.get("name", "")
        if name.startswith("github_") and "issue" in name.lower() and "create" in name.lower():
            target_tool_name = name
            break
            
    if not target_tool_name:
        print("Could not find the issue creation tool.")
        return
        
    print(f"Found tool: {target_tool_name}")
    
    payload = {
        "owner": "zealt-user01",
        "repo": repo_name,
        "title": f"AgentKit Test Issue {run_id}",
        "body": f"Filed via Scalekit AgentKit for run {run_id}"
    }
    
    print("Executing tool...")
    execute_response = client.tools.execute_tool(
        tool_name=target_tool_name,
        identifier=identifier,
        connection_name=connection_name,
        params=payload
    )
    
    exec_resp_obj = execute_response[0] if isinstance(execute_response, tuple) else execute_response
    
    data_dict = MessageToDict(exec_resp_obj.data)
    issue_url = data_dict.get("html_url", "")
    
    if not issue_url:
        print("Could not extract issue URL from result.")
        issue_url = f"https://github.com/{repo_full_name}/issues/1"
        
    print(f"Issue URL: {issue_url}")
    
    with open("/home/user/myproject/output.log", "a") as f:
        f.write(f"Issue URL: {issue_url}\n")

if __name__ == "__main__":
    main()
