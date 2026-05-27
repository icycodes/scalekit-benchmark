import os
from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import Filter
from google.protobuf.json_format import MessageToDict
from google.protobuf.wrappers_pb2 import BoolValue

def list_tools():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    client = ScalekitClient(env_url, client_id, client_secret)
    
    tools_response, _ = client.tools.list_tools(
        filter=Filter(
            identifier="zealt-user01",
            connector="github-test",
            summary=BoolValue(value=True)
        ),
        page_size=100
    )
    
    print(f"Tool Names: {tools_response.tool_names}")
    print(f"Next page token: {tools_response.next_page_token}")

if __name__ == "__main__":
    list_tools()
