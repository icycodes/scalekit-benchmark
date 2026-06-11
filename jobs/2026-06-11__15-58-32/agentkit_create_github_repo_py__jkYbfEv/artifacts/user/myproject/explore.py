import os
import json
from scalekit import ScalekitClient

def main():
    client = ScalekitClient(
        os.environ['SCALEKIT_ENV_URL'],
        os.environ['SCALEKIT_CLIENT_ID'],
        os.environ['SCALEKIT_CLIENT_SECRET']
    )
    res = client.tools.execute_tool(
        tool_name="githubmcp_create_repository",
        identifier="zealt-user01",
        connection_name="github-test",
        params={
            "name": "agentkit-repo-test-999",
            "private": False,
            "autoInit": True
        }
    )
    print(dir(res[0]))
    print(res[0].data)

if __name__ == "__main__":
    main()
