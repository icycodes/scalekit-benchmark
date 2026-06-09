import os
from scalekit import ScalekitClient

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
    print("Listing channels via execute_tool...")
    try:
        response = actions.execute_tool(
            tool_name="slack_list_channels",
            identifier="zealt-user01",
            connection_name="slack-test",
            tool_input={}
        )
        print("Response:", response)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
