import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id


def _expected_identifier() -> str:
    return f"agentkit-link-user-{_run_id()}"


def _read_log() -> str:
    assert os.path.isfile(LOG_FILE), (
        f"Log file {LOG_FILE} not found; the executor must run the script "
        f"and persist output to this file."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), (
        f"Log file {LOG_FILE} not found."
    )


def test_log_contains_expected_identifier():
    content = _read_log()
    expected = _expected_identifier()
    pattern = rf"^Identifier:\s*{re.escape(expected)}\s*$"
    assert re.search(pattern, content, flags=re.MULTILINE), (
        f"Expected a line `Identifier: {expected}` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )


def test_log_contains_pending_status():
    content = _read_log()
    pattern = r"^Status:\s*PENDING\s*$"
    assert re.search(pattern, content, flags=re.MULTILINE), (
        f"Expected a line `Status: PENDING` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )


def test_log_contains_scalekit_authorization_url():
    content = _read_log()
    match = re.search(
        r"^Authorization URL:\s*(\S+)\s*$",
        content,
        flags=re.MULTILINE,
    )
    assert match, (
        f"Expected a line `Authorization URL: <url>` in {LOG_FILE}; "
        f"got log contents:\n{content}"
    )
    url = match.group(1)
    assert url.startswith("https://"), (
        f"Authorization URL must use https://, got: {url}"
    )
    assert "scalekit" in url.lower(), (
        f"Authorization URL must be hosted by Scalekit (host should contain "
        f"'scalekit'), got: {url}"
    )


def test_connected_account_is_pending_via_sdk():
    """Use the Scalekit Python SDK to confirm the connected account exists
    and is in PENDING state. We re-use the idempotent
    `get_or_create_connected_account` call to look it up."""
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

    # Try the most common constructor signatures used by the SDK.
    try:
        client = ScalekitClient(
            env_url=env_url,
            client_id=client_id,
            client_secret=client_secret,
        )
    except TypeError:
        client = ScalekitClient(env_url, client_id, client_secret)

    identifier = _expected_identifier()
    resp = client.actions.get_or_create_connected_account(
        connection_name="github-test",
        identifier=identifier,
    )

    # The connected account may be on either `resp.connected_account` or
    # `resp.connectedAccount` depending on SDK version.
    account = getattr(resp, "connected_account", None) or getattr(
        resp, "connectedAccount", None
    )
    assert account is not None, (
        f"Scalekit SDK response missing connected_account field; got: {resp!r}"
    )

    status = getattr(account, "status", None)
    # Normalize enum / string representations.
    status_str = getattr(status, "name", None) or str(status)
    assert "PENDING" in status_str.upper(), (
        f"Expected connected_account.status to be PENDING for new identifier "
        f"{identifier!r}, got: {status_str!r}"
    )
