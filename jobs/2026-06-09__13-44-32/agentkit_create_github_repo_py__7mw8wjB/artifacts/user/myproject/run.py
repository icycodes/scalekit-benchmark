import os
import json
import urllib.parse
from scalekit import ScalekitClient
from google.protobuf.json_format import MessageToDict

def main():
    # 1. Read environment variables
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not all([env_url, client_id, client_secret, run_id]):
        raise ValueError("Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, or ZEALT_RUN_ID")

    repo_name = f"agentkit-repo-{run_id}"
    connection_name = "github-test"
    identifier = "zealt-user01"

    # 2. Initialize Scalekit Client
    client = ScalekitClient(env_url, client_id, client_secret)

    full_name = None
    html_url = None

    print(f"Creating repository '{repo_name}' on behalf of '{identifier}' using connection '{connection_name}'...")

    try:
        # 3. Call execute_tool to create the repository
        res, _ = client.tools.execute_tool(
            tool_name="githubmcp_create_repository",
            identifier=identifier,
            params={
                "name": repo_name,
                "autoInit": True,
                "private": False
            },
            connection_name=connection_name
        )
        print("Create repository tool call completed successfully.")
        
        # 4. Parse response
        res_dict = MessageToDict(res)
        content_list = res_dict.get("data", {}).get("fields", {}).get("content", {}).get("listValue", {}).get("values", [])
        if not content_list:
            # Try alternate path just in case the format is slightly different
            content_list = res_dict.get("data", {}).get("content", [])
        
        text_str = None
        for val in content_list:
            struct_val = val.get("structValue", {})
            if struct_val.get("fields", {}).get("type", {}).get("stringValue") == "text":
                text_str = struct_val.get("fields", {}).get("text", {}).get("stringValue")
                break
            elif val.get("type") == "text":
                text_str = val.get("text")
                break

        if text_str:
            try:
                text_data = json.loads(text_str)
                html_url = text_data.get("url")
                if html_url:
                    parsed_url = urllib.parse.urlparse(html_url)
                    full_name = parsed_url.path.strip("/")
            except Exception as parse_err:
                print(f"Warning: Failed to parse inner JSON: {parse_err}")

    except Exception as e:
        err_msg = str(e)
        if "already exists" in err_msg:
            print(f"Repository '{repo_name}' already exists. Retrieving details...")
            try:
                res, _ = client.tools.execute_tool(
                    tool_name="github_repo_get",
                    identifier=identifier,
                    params={
                        "owner": identifier,
                        "repo": repo_name
                    },
                    connection_name=connection_name
                )
                res_dict = MessageToDict(res)
                html_url = res_dict.get("data", {}).get("html_url")
                full_name = res_dict.get("data", {}).get("full_name")
            except Exception as get_err:
                print(f"Failed to retrieve repository details: {get_err}")
                raise get_err
        else:
            print(f"Failed to create repository: {e}")
            raise e

    if not full_name or not html_url:
        raise ValueError(f"Could not determine full_name or html_url. full_name={full_name}, html_url={html_url}")

    # 5. Write to log file
    log_line = f"Repository: {full_name} {html_url}\n"
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w") as f:
        f.write(log_line)

    print(f"Successfully wrote log entry to {log_path}:")
    print(log_line.strip())

if __name__ == "__main__":
    main()
