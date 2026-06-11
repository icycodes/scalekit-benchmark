import os
import re

import pytest


PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _read_log() -> str:
    assert os.path.isfile(LOG_FILE), (
        f"Log file {LOG_FILE} not found; the executor must run the script "
        f"and persist output to this file."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} not found."


def test_log_contains_connection_line():
    content = _read_log()
    pattern = r"^Connection:\s*github-test\s*$"
    assert re.search(pattern, content, flags=re.MULTILINE), (
        f"Expected a line `Connection: github-test` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )


def test_log_contains_identifier_line():
    content = _read_log()
    pattern = r"^Identifier:\s*zealt-user01\s*$"
    assert re.search(pattern, content, flags=re.MULTILINE), (
        f"Expected a line `Identifier: zealt-user01` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )


def test_log_contains_active_status_line():
    content = _read_log()
    pattern = r"^Status:\s*ACTIVE\s*$"
    assert re.search(pattern, content, flags=re.MULTILINE), (
        f"Expected a line `Status: ACTIVE` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )


def test_log_contains_connected_account_id_line():
    content = _read_log()
    match = re.search(
        r"^Connected Account ID:\s*(\S+)\s*$",
        content,
        flags=re.MULTILINE,
    )
    assert match, (
        f"Expected a line `Connected Account ID: <id>` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )
    account_id = match.group(1).strip()
    assert account_id, (
        "Connected Account ID value must be a non-empty, non-whitespace string; "
        f"got: {account_id!r}"
    )


def test_connected_account_is_active_via_sdk():
    """Use the Scalekit Python SDK to confirm the fixture connected account
    for (`github-test`, `zealt-user01`) is in ACTIVE state. We re-use the
    idempotent `get_or_create_connected_account` call to look it up without
    mutating its state."""
    try:
        from scalekit import ScalekitClient
    except ImportError:
        try:
            from scalekit.client import ScalekitClient
        except ImportError as e:
            pytest.fail(f"Scalekit Python SDK not importable: {e}")

    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    assert client_id and client_secret and env_url, (
        "SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_ENV_URL "
        "must be set in the verifier environment."
    )

    try:
        client = ScalekitClient(
            env_url=env_url,
            client_id=client_id,
            client_secret=client_secret,
        )
    except TypeError:
        client = ScalekitClient(env_url, client_id, client_secret)

    resp = client.actions.get_or_create_connected_account(
        connection_name="github-test",
        identifier="zealt-user01",
    )

    account = getattr(resp, "connected_account", None) or getattr(
        resp, "connectedAccount", None
    )
    assert account is not None, (
        f"Scalekit SDK response missing connected_account field; got: {resp!r}"
    )

    status = getattr(account, "status", None)
    status_str = getattr(status, "name", None) or str(status)
    assert "ACTIVE" in status_str.upper(), (
        f"Expected connected_account.status to be ACTIVE for the fixture "
        f"identifier 'zealt-user01' on connection 'github-test', "
        f"got: {status_str!r}"
    )

    account_id = getattr(account, "id", None)
    assert isinstance(account_id, str) and account_id.strip(), (
        f"Expected connected_account.id to be a non-empty string, "
        f"got: {account_id!r}"
    )
