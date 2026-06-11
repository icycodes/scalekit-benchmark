import os
import sys
from scalekit import ScalekitClient
from scalekit.organization import CreateOrganization
from scalekit.common.exceptions import ScalekitNotFoundException

def main():
    # Read environment variables
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not all([env_url, client_id, client_secret, run_id]):
        print("Error: Missing one or more required environment variables (SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, ZEALT_RUN_ID)", file=sys.stderr)
        sys.exit(1)

    org_name = f"harbor-org-{run_id}"
    external_id = f"harbor-org-{run_id}"

    # Initialize Scalekit Client
    print(f"Initializing ScalekitClient with URL: {env_url} and Client ID: {client_id}...")
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    org_id = None
    # Try to check if organization already exists by external_id
    print(f"Checking if organization with external_id '{external_id}' already exists...")
    try:
        get_response, _ = client.organization.get_organization_by_external_id(external_id)
        if get_response and get_response.organization:
            org_id = get_response.organization.id
            print(f"Organization already exists with ID: {org_id}")
    except ScalekitNotFoundException:
        print(f"Organization with external_id '{external_id}' does not exist. Creating a new one...")
    except Exception as e:
        print(f"Error checking organization by external ID: {e}. Proceeding with creation...")

    # If not found, create it
    if not org_id:
        create_org_data = CreateOrganization(
            display_name=org_name,
            external_id=external_id
        )
        try:
            create_response, _ = client.organization.create_organization(create_org_data)
            org_id = create_response.organization.id
            print(f"Successfully created organization. ID: {org_id}")
        except Exception as e:
            print(f"Error creating organization: {e}", file=sys.stderr)
            sys.exit(1)

    # Fetch the freshly created organization back by id using the SDK to confirm it is persisted.
    print(f"Fetching organization back by ID '{org_id}' to confirm persistence...")
    try:
        fetch_response, _ = client.organization.get_organization(org_id)
        fetched_org = fetch_response.organization
        print(f"Confirmed persistence. Fetched Org ID: {fetched_org.id}, Name: {fetched_org.display_name}, External ID: {fetched_org.external_id}")
    except Exception as e:
        print(f"Error fetching organization by ID: {e}", file=sys.stderr)
        sys.exit(1)

    # Write the structured outcome to the log file
    log_file_path = "/home/user/myproject/output.log"
    print(f"Writing outcome to log file: {log_file_path}")
    
    # Ensure the parent directory exists
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    
    with open(log_file_path, "w") as f:
        f.write(f"Organization ID: {fetched_org.id}\n")
        f.write(f"Organization Name: {fetched_org.display_name}\n")
        f.write(f"External ID: {fetched_org.external_id}\n")

    print("Done!")

if __name__ == "__main__":
    main()
