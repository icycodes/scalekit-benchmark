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
    print("Checking connected account...")
    try:
        response = actions.get_connected_account(
            connection_name="slack-test",
            identifier="zealt-user01"
        )
        print("Response type:", type(response))
        print("Response dir:", dir(response))
        print("Response:", response)
        
        # Check connected account status
        # Let's see if there is an attribute like connected_account
        if hasattr(response, "connected_account"):
            ca = response.connected_account
            print("Connected account status:", ca.status)
            print("Connected account details:", ca)
        else:
            print("No connected_account attribute found on response")
    except Exception as e:
        print("Error getting connected account:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
