import os
import inspect
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
    
    print("get_or_create_connected_account signature:")
    try:
        print(inspect.signature(sc.actions.get_or_create_connected_account))
    except Exception as e:
        print("Error inspect.signature:", e)
        
    print("get_or_create_connected_account docstring:")
    print(sc.actions.get_or_create_connected_account.__doc__)

if __name__ == "__main__":
    main()
