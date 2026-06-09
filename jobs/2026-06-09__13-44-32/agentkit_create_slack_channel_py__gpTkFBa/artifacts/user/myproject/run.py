import os
import sys
import json
from scalekit import ScalekitClient

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    
    channel_name = f"agentkit-task-{run_id}"
    print(f"Target Slack channel name: {channel_name}")
    
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    
    if not all([client_id, client_secret, env_url]):
        print("Error: Missing Scalekit environment variables.", file=sys.stderr)
        sys.exit(1)
        
    sc = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )
    
    actions = sc.actions
    
    print("Calling execute_tool to create Slack channel...")
    try:
        response = actions.execute_tool(
            tool_name="slack_create_channel",
            identifier="zealt-user01",
            connection_name="slack-test",
            tool_input={
                "name": channel_name,
                "is_private": False
            }
        )
        
        print("Raw response:", response)
        print("Response data:", response.data)
        
        # Let's parse the response to extract channel ID and name
        # We'll check multiple possible paths in response.data to be extremely robust.
        data = response.data
        
        channel_id = None
        resp_channel_name = None
        
        # Scenario 1: Slack response typically wraps everything under a "channel" key
        if isinstance(data, dict):
            if "channel" in data and isinstance(data["channel"], dict):
                channel_info = data["channel"]
                channel_id = channel_info.get("id")
                resp_channel_name = channel_info.get("name")
            else:
                # Scenario 2: Direct keys in data
                channel_id = data.get("id") or data.get("channel_id")
                resp_channel_name = data.get("name") or data.get("channel_name")
        
        if not channel_id:
            print("Error: Could not extract channel ID from response data.", file=sys.stderr)
            sys.exit(1)
            
        if not resp_channel_name:
            resp_channel_name = channel_name
            
        print(f"Extracted Channel ID: {channel_id}")
        print(f"Extracted Channel Name: {resp_channel_name}")
        
        # Write to log file
        log_path = "/home/user/myproject/output.log"
        log_line = f"Channel: {resp_channel_name} ({channel_id})\n"
        
        with open(log_path, "w") as f:
            f.write(log_line)
            
        print(f"Successfully wrote log to {log_path}: {log_line.strip()}")
        
    except Exception as e:
        print(f"Error executing slack_create_channel: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
