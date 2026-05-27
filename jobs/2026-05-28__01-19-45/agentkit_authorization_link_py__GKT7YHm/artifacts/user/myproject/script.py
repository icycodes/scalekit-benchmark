import os
from scalekit import ScalekitClient

def main():
    client_id = os.environ.get('SCALEKIT_CLIENT_ID')
    client_secret = os.environ.get('SCALEKIT_CLIENT_SECRET')
    env_url = os.environ.get('SCALEKIT_ENV_URL')
    run_id = os.environ.get('ZEALT_RUN_ID', 'test')

    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    client = ScalekitClient(env_url=env_url, client_id=client_id, client_secret=client_secret)
    
    # Bootstrap the account record
    res = client.actions.get_or_create_connected_account(
        connection_name=connection_name,
        identifier=identifier
    )
    
    account_status = res.connected_account.status

    # Get the authorization link
    link_res = client.actions.get_authorization_link(
        connection_name=connection_name,
        identifier=identifier
    )

    auth_url = link_res.link

    # Write to log file
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w") as f:
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Status: {account_status}\n")
        f.write(f"Authorization URL: {auth_url}\n")
        
    print(f"Log written to {log_path}")

if __name__ == "__main__":
    main()
