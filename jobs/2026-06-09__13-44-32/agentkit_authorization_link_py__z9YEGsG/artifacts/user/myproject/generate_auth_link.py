import os
import sys
from scalekit import ScalekitClient

def main():
    # Read environment variables
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not all([env_url, client_id, client_secret, run_id]):
        print("Error: Missing required environment variables.", file=sys.stderr)
        print(f"SCALEKIT_ENV_URL present: {bool(env_url)}", file=sys.stderr)
        print(f"SCALEKIT_CLIENT_ID present: {bool(client_id)}", file=sys.stderr)
        print(f"SCALEKIT_CLIENT_SECRET present: {bool(client_secret)}", file=sys.stderr)
        print(f"ZEALT_RUN_ID present: {bool(run_id)}", file=sys.stderr)
        sys.exit(1)

    # Construct the identifier
    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    try:
        # Initialize ScalekitClient
        client = ScalekitClient(
            env_url=env_url,
            client_id=client_id,
            client_secret=client_secret
        )

        # Create or fetch connected account
        response = client.actions.get_or_create_connected_account(
            connection_name=connection_name,
            identifier=identifier
        )
        connected_account = response.connected_account
        status = connected_account.status

        # Get authorization link
        link_response = client.actions.get_authorization_link(
            connection_name=connection_name,
            identifier=identifier
        )
        auth_url = link_response.link

        # Output format
        output_lines = [
            f"Identifier: {identifier}",
            f"Status: {status}",
            f"Authorization URL: {auth_url}"
        ]

        # Write to log file
        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w", encoding="utf-8") as f:
            for line in output_lines:
                f.write(line + "\n")

        print("Script executed successfully. Output written to log file.")
        for line in output_lines:
            print(line)

    except Exception as e:
        print(f"An error occurred during execution: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
