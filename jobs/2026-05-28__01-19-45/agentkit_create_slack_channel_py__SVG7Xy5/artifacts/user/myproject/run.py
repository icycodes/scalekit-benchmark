import os
import sys
from scalekit import ScalekitClient
from google.protobuf.json_format import MessageToDict

def main():
    client = ScalekitClient(
        os.environ.get("SCALEKIT_ENV_URL"),
        os.environ.get("SCALEKIT_CLIENT_ID"),
        os.environ.get("SCALEKIT_CLIENT_SECRET")
    )
    
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID not set")
        sys.exit(1)
        
    channel_name = f"agentkit-task-{run_id}"
    
    res = client.tools.execute_tool(
        tool_name="slack_create_channel",
        identifier="zealt-user01",
        connection_name="slack-test",
        params={
            "name": channel_name,
            "is_private": False
        }
    )
    
    data = MessageToDict(res[0].data)
    
    if data.get("ok"):
        channel = data.get("channel", {})
        c_id = channel.get("id")
        c_name = channel.get("name")
        
        with open("/home/user/myproject/output.log", "w") as f:
            f.write(f"Channel: {c_name} ({c_id})\n")
        print(f"Success: Channel: {c_name} ({c_id})")
    else:
        error_msg = data.get("error", "Unknown error")
        print(f"Failed to create channel: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
