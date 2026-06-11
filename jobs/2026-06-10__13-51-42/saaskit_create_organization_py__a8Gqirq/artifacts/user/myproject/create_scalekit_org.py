#!/usr/bin/env python3
"""Create a Scalekit organization for the current ZEALT run.

The script uses the official scalekit-sdk-python package, creates (or reuses on
retry) an organization keyed by a run-scoped external_id, fetches it back by id,
and writes the verifier-readable outcome to output.log.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from scalekit import ScalekitClient
from scalekit.organization import CreateOrganization

PROJECT_DIR = Path(__file__).resolve().parent
OUTPUT_LOG = PROJECT_DIR / "output.log"


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def unwrap_response(response: Any) -> Any:
    """The SDK's gRPC methods return (protobuf_response, call)."""
    if isinstance(response, tuple):
        return response[0]
    return response


def organization_from_response(response: Any) -> Any:
    response = unwrap_response(response)
    organization = getattr(response, "organization", None)
    if organization is None:
        raise RuntimeError(f"Scalekit response did not include an organization: {response!r}")
    return organization


def fetch_by_external_id(scalekit: ScalekitClient, external_id: str) -> Any | None:
    try:
        return organization_from_response(
            scalekit.organization.get_organization_by_external_id(external_id)
        )
    except Exception:
        return None


def main() -> None:
    env_url = required_env("SCALEKIT_ENV_URL")
    client_id = required_env("SCALEKIT_CLIENT_ID")
    client_secret = required_env("SCALEKIT_CLIENT_SECRET")
    run_id = required_env("ZEALT_RUN_ID")

    organization_name = f"harbor-org-{run_id}"
    metadata = {
        "created_by": "zealt-scalekit-python-sdk-task",
        "run_id": run_id,
    }

    scalekit = ScalekitClient(env_url, client_id, client_secret)

    # Make retries idempotent: if the run-scoped external_id already exists,
    # reuse it instead of creating a duplicate logical workspace.
    organization = fetch_by_external_id(scalekit, organization_name)
    if organization is None:
        create_request = CreateOrganization(
            display_name=organization_name,
            external_id=organization_name,
            metadata=metadata,
        )
        try:
            organization = organization_from_response(
                scalekit.organization.create_organization(create_request)
            )
        except Exception:
            # If a prior attempt created the org but failed before writing the log,
            # re-resolve it by external_id. Re-raise the original failure if it is
            # still not present.
            organization = fetch_by_external_id(scalekit, organization_name)
            if organization is None:
                raise

    persisted = organization_from_response(
        scalekit.organization.get_organization(organization.id)
    )

    if persisted.display_name != organization_name:
        raise RuntimeError(
            f"Fetched organization name mismatch: {persisted.display_name!r} != {organization_name!r}"
        )
    if persisted.external_id != organization_name:
        raise RuntimeError(
            f"Fetched organization external_id mismatch: {persisted.external_id!r} != {organization_name!r}"
        )
    if not persisted.id.startswith("org_"):
        raise RuntimeError(f"Unexpected Scalekit organization id: {persisted.id!r}")

    log_lines = [
        f"Organization ID: {persisted.id}",
        f"Organization Name: {persisted.display_name}",
        f"External ID: {persisted.external_id}",
        f"Metadata: {json.dumps(dict(persisted.metadata), sort_keys=True)}",
    ]
    OUTPUT_LOG.write_text("\n".join(log_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
