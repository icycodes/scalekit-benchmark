import os
import json
from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    filter = ScopedToolFilter(connection_names=["github-test"])
    response = client.tools.list_scoped_tools(
        identifier="zealt-user01",
        filter=filter,
        page_size=100
    )
    
    resp_obj = response[0]
    for t in resp_obj.tools:
        definition = MessageToDict(t.tool.definition)
        name = definition.get("name", "")
        if name.startswith("github_") and "issue" in name.lower() and "create" in name.lower():
            print("Found tool:", name)

if __name__ == "__main__":
    main()
