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
    
    actions = sc.actions
    print("Listing all connected accounts...")
    try:
        page_token = ""
        all_accounts = []
        while True:
            res_all, _ = actions.connected_accounts.list_connected_accounts(page_size=10, page_token=page_token)
            all_accounts.extend(res_all.connected_accounts)
            page_token = res_all.next_page_token
            if not page_token:
                break
                
        print(f"Total accounts found: {len(all_accounts)}")
        for ca in all_accounts:
            print(f"ID: {ca.id}, Identifier: {ca.identifier}, Status: {ca.status}, Connector: {ca.connector}, Provider: {ca.provider}")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
