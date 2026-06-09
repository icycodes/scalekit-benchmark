import os
from scalekit import ScalekitClient
from google.protobuf.json_format import MessageToDict

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    sc = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )
    
    actions = sc.actions
    print("Listing scoped tools...")
    res = actions.tools.list_scoped_tools(
        identifier="zealt-user01",
        filter={"connection_names": ["slack-test"]},
        page_size=100,
    )
    
    if isinstance(res, tuple):
        scoped_response, _ = res
    else:
        scoped_response = res
        
    for tool in scoped_response.tools:
        tool_dict = MessageToDict(tool)
        definition = tool_dict.get("tool", {}).get("definition", {})
        name = definition.get("name", "")
        if name == "slack_create_channel":
            import json
            print(json.dumps(definition, indent=2))

if __name__ == "__main__":
    main()
