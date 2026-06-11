import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def get_run_id() -> str:
    return os.environ.get("ZEALT_RUN_ID", "").strip()


def get_expected_name() -> str:
    run_id = get_run_id()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return f"harbor-org-{run_id}"


def read_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Expected log file at {LOG_FILE} but it was not found."
    with open(LOG_FILE, "r") as f:
        return f.read()


def extract_org_id(log_content: str) -> str:
    match = re.search(r"Organization\s*ID:\s*(org_[A-Za-z0-9_-]+)", log_content)
    assert match, (
        "Expected a line of the form 'Organization ID: org_<id>' in the log file, "
        f"got:\n{log_content}"
    )
    return match.group(1)


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} was not created by the task."


def test_log_contains_organization_id():
    log_content = read_log()
    org_id = extract_org_id(log_content)
    assert org_id.startswith("org_"), (
        f"Organization ID '{org_id}' does not have the expected 'org_' prefix."
    )


def test_log_contains_expected_name():
    log_content = read_log()
    expected_name = get_expected_name()
    pattern = rf"Organization\s*Name:\s*{re.escape(expected_name)}\b"
    assert re.search(pattern, log_content), (
        f"Log file does not contain expected 'Organization Name: {expected_name}'.\n"
        f"Log content:\n{log_content}"
    )


def test_log_contains_expected_external_id():
    log_content = read_log()
    expected_name = get_expected_name()
    pattern = rf"External\s*ID:\s*{re.escape(expected_name)}\b"
    assert re.search(pattern, log_content), (
        f"Log file does not contain expected 'External ID: {expected_name}'.\n"
        f"Log content:\n{log_content}"
    )


def _get_scalekit_client():
    from scalekit import ScalekitClient  # type: ignore[import-not-found]

    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    return ScalekitClient(env_url, client_id, client_secret)


def _extract_org_payload(response):
    """Best-effort extraction of an organization object from any reasonable SDK shape."""
    org = response
    for attr in ("organization", "data", "result"):
        if hasattr(org, attr):
            inner = getattr(org, attr)
            if inner is not None:
                org = inner
                break
    return org


def _get_attr(obj, *names):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None and value != "":
                return value
        if isinstance(obj, dict) and name in obj and obj[name] not in (None, ""):
            return obj[name]
    return None


def test_organization_exists_in_scalekit():
    log_content = read_log()
    created_org_id = extract_org_id(log_content)
    expected_name = get_expected_name()

    client = _get_scalekit_client()
    try:
        response = client.organization.get_organization(created_org_id)
    except Exception as e:  # noqa: BLE001
        pytest.fail(
            f"Scalekit get_organization({created_org_id}) raised an exception: {e}"
        )

    org = _extract_org_payload(response)

    actual_id = _get_attr(org, "id")
    assert actual_id == created_org_id, (
        f"Expected organization id '{created_org_id}', got '{actual_id}'."
    )

    actual_name = _get_attr(org, "display_name", "name")
    assert actual_name == expected_name, (
        f"Expected organization display_name/name '{expected_name}', got '{actual_name}'."
    )

    actual_external = _get_attr(org, "external_id", "externalId")
    assert actual_external == expected_name, (
        f"Expected organization external_id '{expected_name}', got '{actual_external}'."
    )


def test_organization_lookup_by_external_id():
    log_content = read_log()
    created_org_id = extract_org_id(log_content)
    expected_name = get_expected_name()

    client = _get_scalekit_client()
    lookup = getattr(client.organization, "get_organization_by_external_id", None)
    if lookup is None:
        pytest.skip("SDK does not expose get_organization_by_external_id; skipping.")

    try:
        response = lookup(expected_name)
    except Exception as e:  # noqa: BLE001
        pytest.fail(
            f"Scalekit get_organization_by_external_id('{expected_name}') raised: {e}"
        )

    org = _extract_org_payload(response)
    actual_id = _get_attr(org, "id")
    assert actual_id == created_org_id, (
        f"Lookup by external_id '{expected_name}' returned id '{actual_id}', "
        f"expected '{created_org_id}'."
    )


@pytest.fixture(scope="session", autouse=True)
def _cleanup_created_organization():
    yield
    if not os.path.isfile(LOG_FILE):
        return
    try:
        with open(LOG_FILE, "r") as f:
            content = f.read()
        match = re.search(r"Organization\s*ID:\s*(org_[A-Za-z0-9_-]+)", content)
        if not match:
            return
        org_id = match.group(1)
        client = _get_scalekit_client()
        delete = getattr(client.organization, "delete_organization", None)
        if delete is not None:
            try:
                delete(org_id)
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass
