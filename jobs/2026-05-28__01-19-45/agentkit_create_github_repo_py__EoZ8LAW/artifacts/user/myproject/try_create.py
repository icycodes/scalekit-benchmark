import os
from scalekit import ScalekitClient

def try_create():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    client = ScalekitClient(env_url, client_id, client_secret)
    
    try:
        resp = client.actions.execute_tool(
            tool_name="github_user_repo_create",
            identifier="zealt-user01",
            connection_name="github-test",
            tool_input={
                "name": "test-repo",
                "private": False,
                "auto_init": True
            }
        )
        print(resp)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    try_create()
