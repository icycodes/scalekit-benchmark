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
    
    print("Getting environment connection details...")
    try:
        conn = sc.connection.get_environment_connection("conn_127046687444174341")
        print("Connection details:", conn)
    except Exception as e:
        print("Error getting connection:", e)

if __name__ == "__main__":
    main()
