import os
import subprocess
import scalekit.client

def main():
    # 1. Read run-id from ZEALT_RUN_ID environment variable
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")
    
    # 2. Setup repo names
    repo_name = f"agentkit-issue-target-{run_id}"
    full_repo_name = f"zealt-user01/{repo_name}"
    
    # 3. Create public GitHub repository under zealt-user01 using GitHub CLI
    print(f"Ensuring GitHub repository {full_repo_name} exists...")
    # We can check if the repo already exists first
    check_repo = subprocess.run(
        ["gh", "repo", "view", full_repo_name],
        capture_output=True,
        text=True
    )
    
    if check_repo.returncode != 0:
        print(f"Repository {full_repo_name} does not exist. Creating...")
        create_repo = subprocess.run(
            ["gh", "repo", "create", full_repo_name, "--public", "--add-readme"],
            capture_output=True,
            text=True
        )
        if create_repo.returncode == 0:
            print(f"Repository {full_repo_name} created successfully.")
        else:
            print(f"Failed to create repository: {create_repo.stderr}")
            # Do not raise error, maybe it exists but view failed for some other reason, 
            # let's proceed to let the API call fail or succeed.
    else:
        print(f"Repository {full_repo_name} already exists.")
        
    # 4. Initialize the Scalekit SDK using only provided environment variables
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    
    if not all([client_id, client_secret, env_url]):
        raise ValueError("Missing Scalekit environment variables (SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, SCALEKIT_ENV_URL)")
        
    print("Initializing Scalekit SDK...")
    client = scalekit.client.ScalekitClient(
        client_id=client_id,
        client_secret=client_secret,
        env_url=env_url
    )
    
    # Connection details from dashboard fixtures
    connection_name = "github-test"
    identifier = "zealt-user01"
    
    # 5. Call AgentKit's scoped-tool listing to discover the GitHub tool that creates an issue
    print("Listing scoped tools to discover the issue-creation tool...")
    res = client.actions.tools.list_scoped_tools(
        identifier=identifier,
        filter={"connection_names": [connection_name]},
        page_size=100
    )
    
    response_obj = res[0]
    target_tool_name = None
    
    for scoped_tool in response_obj.tools:
        definition = dict(scoped_tool.tool.definition)
        tool_name = definition.get("name")
        if tool_name and tool_name.startswith("github_") and "issue" in tool_name and "create" in tool_name:
            target_tool_name = tool_name
            break
            
    if not target_tool_name:
        raise ValueError("Could not find GitHub issue creation tool in the scoped tools list")
        
    print(f"Discovered tool: {target_tool_name}")
    
    # 6. Execute the tool to file an issue
    issue_title = f"AgentKit Test Issue {run_id}"
    issue_body = f"Filed via Scalekit AgentKit for run {run_id}"
    
    print(f"Executing tool {target_tool_name} to create issue...")
    result = client.actions.execute_tool(
        tool_name=target_tool_name,
        identifier=identifier,
        tool_input={
            "owner": "zealt-user01",
            "repo": repo_name,
            "title": issue_title,
            "body": issue_body
        }
    )
    
    # Extract the issue's HTML URL
    issue_url = result.data.get("html_url")
    if not issue_url:
        raise ValueError(f"No html_url found in the tool execution response: {result.data}")
        
    print(f"Issue created successfully: {issue_url}")
    
    # 7. Append the issue's HTML URL to /home/user/myproject/output.log
    log_path = "/home/user/myproject/output.log"
    print(f"Logging issue URL to {log_path}...")
    with open(log_path, "a") as f:
        f.write(f"Issue URL: {issue_url}\n")
        
    print("Done!")

if __name__ == "__main__":
    main()
