import os
from scalekit import ScalekitClient
from scalekit.v1.connected_accounts.connected_accounts_pb2 import UpdateConnectedAccount, AuthorizationDetails, OauthToken, UpdateConnectedAccountRequest

def main():
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")

    sc = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )
    
    # Let's first get the existing details
    res_tuple = sc.connected_accounts.get_connected_account_by_identifier(
        connector="slack-test",
        identifier="zealt-user01"
    )
    res = res_tuple[0]
    ca = res.connected_account
    print("Existing status:", ca.status)
    print("Existing access_token:", ca.authorization_details.oauth_token.access_token[:30] + "...")
    print("Existing refresh_token:", ca.authorization_details.oauth_token.refresh_token[:30] + "...")
    
    # Let's try to call update_connected_account with the same details to see if it refreshes or validates
    print("Calling update_connected_account...")
    try:
        oauth_token = OauthToken(
            access_token=ca.authorization_details.oauth_token.access_token,
            refresh_token=ca.authorization_details.oauth_token.refresh_token,
            scopes=ca.authorization_details.oauth_token.scopes,
            domain=ca.authorization_details.oauth_token.domain
        )
        auth_details = AuthorizationDetails(oauth_token=oauth_token)
        update_ca = UpdateConnectedAccount(authorization_details=auth_details)
        
        update_res = sc.connected_accounts.update_connected_account(
            connector="slack-test",
            identifier="zealt-user01",
            connected_account=update_ca
        )
        print("Update response:", update_res)
    except Exception as e:
        print("Error updating connected account:", e)

if __name__ == "__main__":
    main()
