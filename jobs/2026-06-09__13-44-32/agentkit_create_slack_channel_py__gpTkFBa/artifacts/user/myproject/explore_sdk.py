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
    
    print("sc.connected_accounts:", dir(sc.connected_accounts))
    print("sc.actions.connected_accounts:", dir(sc.actions.connected_accounts))
    print("sc.tools:", dir(sc.tools))

if __name__ == "__main__":
    main()
