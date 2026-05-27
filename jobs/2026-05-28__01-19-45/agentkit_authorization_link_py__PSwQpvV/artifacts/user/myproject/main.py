import os
from scalekit import ScalekitClient

def main():
    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    run_id = os.environ["ZEALT_RUN_ID"]

    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    scalekit = ScalekitClient(env_url, client_id, client_secret)

    # Create or get the connected account
    account = scalekit.actions.get_or_create_connected_account(
        connection_name=connection_name,
        identifier=identifier,
    )

    status = account.connected_account.status

    # Generate the authorization link
    auth_link_response = scalekit.actions.get_authorization_link(
        connection_name=connection_name,
        identifier=identifier,
    )

    auth_url = auth_link_response.link

    log_lines = (
        f"Identifier: {identifier}\n"
        f"Status: {status}\n"
        f"Authorization URL: {auth_url}\n"
    )

    log_path = os.path.join(os.path.dirname(__file__), "output.log")
    with open(log_path, "w") as f:
        f.write(log_lines)

    print(log_lines, end="")

if __name__ == "__main__":
    main()
