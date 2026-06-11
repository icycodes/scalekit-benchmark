import os
import re

import pytest
import requests

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

ORG_ID_PATTERN = re.compile(r"^Organization ID:\s+(\S+)\s*$", re.MULTILINE)


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is empty; cannot verify run-scoped resources."
    return run_id


def _expected_display_name() -> str:
    return f"harbor-saaskit-org-{_get_run_id()}"


def _read_log_file() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _extract_org_id_from_log() -> str:
    content = _read_log_file()
    match = ORG_ID_PATTERN.search(content)
    assert match is not None, (
        f"Log file {LOG_FILE} does not contain a line matching "
        f"'Organization ID: <organization_id>'. Got:\n{content}"
    )
    org_id = match.group(1).strip()
    assert org_id, "Organization ID captured from the log is empty."
    return org_id


@pytest.fixture(scope="module")
def scalekit_env() -> dict:
    env_url = os.environ.get("SCALEKIT_ENV_URL", "").rstrip("/")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID", "")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET", "")
    assert env_url, "SCALEKIT_ENV_URL must be set in the verifier environment."
    assert client_id, "SCALEKIT_CLIENT_ID must be set in the verifier environment."
    assert client_secret, "SCALEKIT_CLIENT_SECRET must be set in the verifier environment."
    return {
        "env_url": env_url,
        "client_id": client_id,
        "client_secret": client_secret,
    }


@pytest.fixture(scope="module")
def scalekit_access_token(scalekit_env: dict) -> str:
    token_url = f"{scalekit_env['env_url']}/oauth/token"
    response = requests.post(
        token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": scalekit_env["client_id"],
            "client_secret": scalekit_env["client_secret"],
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    assert response.status_code == 200, (
        f"Failed to fetch Scalekit management token from {token_url}: "
        f"status={response.status_code}, body={response.text}"
    )
    payload = response.json()
    access_token = payload.get("access_token")
    assert access_token, f"No access_token in Scalekit token response: {payload}"
    return access_token


def _get_display_name(org: dict) -> str | None:
    for key in ("display_name", "displayName", "name"):
        value = org.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def test_log_file_exists_and_has_org_id_line():
    org_id = _extract_org_id_from_log()
    assert org_id.startswith("org_"), (
        f"Expected the captured organization ID to start with 'org_' (Scalekit format); "
        f"got {org_id!r}."
    )


def test_organization_fetchable_by_id(scalekit_env: dict, scalekit_access_token: str):
    org_id = _extract_org_id_from_log()
    expected_name = _expected_display_name()
    url = f"{scalekit_env['env_url']}/api/v1/organizations/{org_id}"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {scalekit_access_token}"},
        timeout=30,
    )
    assert response.status_code == 200, (
        f"GET {url} returned status {response.status_code}; body={response.text}"
    )
    body = response.json()
    organization = body.get("organization") if isinstance(body, dict) else None
    if organization is None and isinstance(body, dict) and "id" in body:
        organization = body
    assert isinstance(organization, dict), (
        f"Unexpected response shape for organization fetch: {body}"
    )
    actual_name = _get_display_name(organization)
    assert actual_name == expected_name, (
        f"Organization {org_id} display_name mismatch: "
        f"expected {expected_name!r}, got {actual_name!r}; full response={body}"
    )


def test_organization_appears_in_list(scalekit_env: dict, scalekit_access_token: str):
    expected_name = _expected_display_name()
    expected_org_id = _extract_org_id_from_log()
    url = f"{scalekit_env['env_url']}/api/v1/organizations"
    found = False
    page_token: str | None = None
    for _ in range(20):  # safety cap on pagination
        params = {"page_size": 100}
        if page_token:
            params["page_token"] = page_token
        response = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {scalekit_access_token}"},
            timeout=30,
        )
        assert response.status_code == 200, (
            f"GET {url} returned status {response.status_code}; body={response.text}"
        )
        payload = response.json()
        organizations = payload.get("organizations", []) if isinstance(payload, dict) else []
        for org in organizations:
            if not isinstance(org, dict):
                continue
            if org.get("id") == expected_org_id or _get_display_name(org) == expected_name:
                found = True
                break
        if found:
            break
        page_token = payload.get("next_page_token") if isinstance(payload, dict) else None
        if not page_token:
            break
    assert found, (
        f"Expected an organization with id={expected_org_id} and display_name={expected_name!r} "
        f"in {url}, but it was not found."
    )
