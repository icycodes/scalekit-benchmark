import os
import sys
from scalekit import ScalekitClient

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    if not all([client_id, client_secret, env_url]):
        print("Missing required environment variables")
        sys.exit(1)

    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    connection_name = "github-test"
    identifier = "zealt-user01"

    try:
        res = client.actions.get_or_create_connected_account(connection_name, identifier)
    except Exception as e:
        print(f"Error fetching connected account: {e}")
        sys.exit(1)

    ca = res.connected_account
    if not ca:
        print("Connected account not found in response")
        sys.exit(1)

    if ca.status != "ACTIVE":
        print(f"Connected account is not ACTIVE. Current status: {ca.status}")
        sys.exit(1)

    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(f"Connection: {connection_name}\n")
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Status: {ca.status}\n")
        f.write(f"Connected Account ID: {ca.id}\n")

    print(f"Successfully verified connected account. Log written to {log_path}")

if __name__ == "__main__":
    main()
