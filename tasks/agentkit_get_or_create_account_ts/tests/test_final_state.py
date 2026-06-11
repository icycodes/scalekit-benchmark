import os
import re
import subprocess
import time

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _run_npm_start():
    # Remove a stale log if present.
    if os.path.isfile(LOG_FILE):
        os.remove(LOG_FILE)
    result = subprocess.run(
        ["npm", "run", "start"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=240,
        env=os.environ.copy(),
    )
    return result


@pytest.fixture(scope="module")
def npm_start_result():
    result = _run_npm_start()
    # Give the filesystem a moment to flush.
    time.sleep(0.5)
    return result


def test_npm_start_succeeds(npm_start_result):
    assert npm_start_result.returncode == 0, (
        "`npm run start` exited with non-zero status.\n"
        f"stdout:\n{npm_start_result.stdout}\nstderr:\n{npm_start_result.stderr}"
    )


def test_log_file_exists(npm_start_result):
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file at {LOG_FILE} after running `npm run start`, but it was not found."
    )


def _log_contents() -> str:
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_contains_status_active(npm_start_result):
    content = _log_contents()
    assert re.search(r"^Status:\s*ACTIVE\s*$", content, re.MULTILINE), (
        f"Expected a line matching 'Status: ACTIVE' in {LOG_FILE}. Got:\n{content}"
    )


def test_log_contains_connection_name(npm_start_result):
    content = _log_contents()
    assert re.search(r"^Connection:\s*github-test\s*$", content, re.MULTILINE), (
        f"Expected a line matching 'Connection: github-test' in {LOG_FILE}. Got:\n{content}"
    )


def test_log_contains_identifier(npm_start_result):
    content = _log_contents()
    assert re.search(r"^Identifier:\s*zealt-user01\s*$", content, re.MULTILINE), (
        f"Expected a line matching 'Identifier: zealt-user01' in {LOG_FILE}. Got:\n{content}"
    )


def test_log_contains_connected_account_id(npm_start_result):
    content = _log_contents()
    match = re.search(r"^Connected Account ID:\s*(\S+)\s*$", content, re.MULTILINE)
    assert match, (
        f"Expected a line matching 'Connected Account ID: <id>' in {LOG_FILE}. Got:\n{content}"
    )
    assert match.group(1), "Connected Account ID value must be non-empty."


def test_account_active_via_sdk(npm_start_result):
    """Independently verify against Scalekit using the Python SDK."""
    from scalekit import ScalekitClient
    from scalekit.v1.actions.actions_pb2 import GetOrCreateConnectedAccountRequest

    client = ScalekitClient(
        os.environ["SCALEKIT_ENV_URL"],
        os.environ["SCALEKIT_CLIENT_ID"],
        os.environ["SCALEKIT_CLIENT_SECRET"],
    )

    # Try the high-level helper first, fall back to the lower-level call
    # to remain compatible with SDK variants.
    try:
        resp = client.actions.get_or_create_connected_account(
            connection_name="github-test",
            identifier="zealt-user01",
        )
    except TypeError:
        req = GetOrCreateConnectedAccountRequest(
            connection_name="github-test",
            identifier="zealt-user01",
        )
        resp = client.actions.get_or_create_connected_account(req)

    account = getattr(resp, "connected_account", None) or getattr(resp, "connectedAccount", None)
    assert account is not None, f"Unexpected SDK response shape: {resp!r}"

    status = getattr(account, "status", None)
    # Status can be an enum-like object; coerce to string.
    status_str = str(status)
    assert "ACTIVE" in status_str.upper(), (
        f"Expected connected account status ACTIVE, got: {status_str}"
    )

    connection_name = getattr(account, "connection_name", None) or getattr(account, "connectionName", None)
    assert connection_name == "github-test", (
        f"Expected connection_name 'github-test', got: {connection_name}"
    )

    identifier = getattr(account, "identifier", None)
    assert identifier == "zealt-user01", (
        f"Expected identifier 'zealt-user01', got: {identifier}"
    )
