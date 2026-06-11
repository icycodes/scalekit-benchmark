import os
import sys
from scalekit import ScalekitClient

def main():
    # Read environment variables
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

    if not all([env_url, client_id, client_secret]):
        print("Error: Missing required Scalekit environment variables.", file=sys.stderr)
        sys.exit(1)

    # Initialize ScalekitClient
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    connection_name = "github-test"
    identifier = "zealt-user01"

    try:
        # Fetch the connected account idempotently
        response = client.actions.get_or_create_connected_account(
            connection_name=connection_name,
            identifier=identifier
        )
    except Exception as e:
        print(f"Error calling get_or_create_connected_account: {e}", file=sys.stderr)
        sys.exit(1)

    connected_account = response.connected_account
    if not connected_account:
        print("Error: No connected account returned in response.", file=sys.stderr)
        sys.exit(1)

    status = connected_account.status
    connected_account_id = connected_account.id

    # Print for debugging/logging
    print(f"Connection: {connection_name}")
    print(f"Identifier: {identifier}")
    print(f"Status: {status}")
    print(f"Connected Account ID: {connected_account_id}")

    # Write to output log file
    log_path = "/home/user/myproject/output.log"
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"Connection: {connection_name}\n")
            f.write(f"Identifier: {identifier}\n")
            f.write(f"Status: {status}\n")
            f.write(f"Connected Account ID: {connected_account_id}\n")
    except Exception as e:
        print(f"Error writing to log file: {e}", file=sys.stderr)
        sys.exit(1)

    # Assert the status is ACTIVE
    if status != "ACTIVE":
        print(f"Error: Expected status to be 'ACTIVE', but got '{status}'", file=sys.stderr)
        sys.exit(1)

    print("Success: Connected account is ACTIVE.")
    sys.exit(0)

if __name__ == "__main__":
    main()
