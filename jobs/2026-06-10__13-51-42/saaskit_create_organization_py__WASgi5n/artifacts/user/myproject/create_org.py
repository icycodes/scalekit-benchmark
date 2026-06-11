#!/usr/bin/env python3
"""Create a Scalekit organization and log the result."""

import os
import sys

from scalekit import ScalekitClient
from scalekit.v1.organizations.organizations_pb2 import CreateOrganization


def main():
    # Read configuration from environment
    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    run_id = os.environ["ZEALT_RUN_ID"]

    org_name = f"harbor-org-{run_id}"

    # Initialize the Scalekit client
    client = ScalekitClient(env_url, client_id, client_secret)

    # Create the organization
    org = CreateOrganization()
    org.display_name = org_name
    org.external_id = org_name

    create_response = client.organization.create_organization(org)
    organization = create_response[0].organization
    org_id = organization.id

    print(f"Created organization: id={org_id}, name={organization.display_name}")

    # Fetch the organization back by id to confirm persistence
    get_response = client.organization.get_organization(org_id)
    fetched_org = get_response[0].organization

    print(f"Fetched organization: id={fetched_org.id}, name={fetched_org.display_name}, external_id={fetched_org.external_id}")

    # Write structured outcome to log file
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")
    with open(log_path, "w") as f:
        f.write(f"Organization ID: {fetched_org.id}\n")
        f.write(f"Organization Name: {fetched_org.display_name}\n")
        f.write(f"External ID: {fetched_org.external_id}\n")

    print(f"Log written to {log_path}")


if __name__ == "__main__":
    main()
