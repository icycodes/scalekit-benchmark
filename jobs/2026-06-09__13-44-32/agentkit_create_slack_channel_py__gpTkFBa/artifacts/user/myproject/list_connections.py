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
    print("Listing connections...")
    try:
        # In Node.js or general API, list_connections is available.
        # Let's see if we can call it on sc.actions or sc.actions.connections
        print("sc dir:", dir(sc))
        print("actions dir:", dir(actions))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
