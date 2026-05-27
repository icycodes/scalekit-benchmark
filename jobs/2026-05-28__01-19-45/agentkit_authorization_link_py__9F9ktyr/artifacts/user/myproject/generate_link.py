import os
from scalekit import ScalekitClient

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not all([client_id, client_secret, env_url, run_id]):
        print("Missing environment variables")
        return

    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    scalekit = ScalekitClient(env_url, client_id, client_secret)

    # bootstrap the account record
    response = scalekit.actions.get_or_create_connected_account(
        connection_name=connection_name,
        identifier=identifier
    )
    connected_account = response.connected_account

    # obtain the hosted OAuth link
    auth_link_response = scalekit.actions.get_authorization_link(
        connection_name=connection_name,
        identifier=identifier
    )

    output_log = "/home/user/myproject/output.log"
    with open(output_log, "w") as f:
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Status: {connected_account.status}\n")
        f.write(f"Authorization URL: {auth_link_response.link}\n")

    print(f"Identifier: {identifier}")
    print(f"Status: {connected_account.status}")
    print(f"Authorization URL: {auth_link_response.link}")

if __name__ == "__main__":
    main()
