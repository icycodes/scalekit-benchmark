import os
import re

from scalekit import ScalekitClient

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
CONNECTION_NAME = "github-test"
FIXTURE_IDENTIFIER = "zealt-user01"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id


def _get_identifier() -> str:
    return f"zealt-cleanup-{_get_run_id()}"


def _get_scalekit_client() -> ScalekitClient:
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    assert env_url and client_id and client_secret, (
        "SCALEKIT_ENV_URL / SCALEKIT_CLIENT_ID / SCALEKIT_CLIENT_SECRET must all be set."
    )
    return ScalekitClient(env_url, client_id, client_secret)


def _read_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} not found."


def test_log_contains_created_line():
    identifier = _get_identifier()
    content = _read_log()
    pattern = re.compile(
        rf"^Created account: connection=github-test identifier={re.escape(identifier)} status=\S+",
        re.MULTILINE,
    )
    assert pattern.search(content) is not None, (
        f"Expected a 'Created account' log line for identifier {identifier!r} in {LOG_FILE}. "
        f"Log content was:\n{content}"
    )


def test_log_contains_listed_before_delete_line():
    identifier = _get_identifier()
    content = _read_log()
    expected = f"Listed before delete: present=true identifier={identifier}"
    assert expected in content, (
        f"Expected exact line {expected!r} in {LOG_FILE}. Log content was:\n{content}"
    )


def test_log_contains_deleted_line():
    identifier = _get_identifier()
    content = _read_log()
    expected = f"Deleted account: connection=github-test identifier={identifier}"
    assert expected in content, (
        f"Expected exact line {expected!r} in {LOG_FILE}. Log content was:\n{content}"
    )


def test_log_contains_listed_after_delete_line():
    identifier = _get_identifier()
    content = _read_log()
    expected = f"Listed after delete: present=false identifier={identifier}"
    assert expected in content, (
        f"Expected exact line {expected!r} in {LOG_FILE}. Log content was:\n{content}"
    )


def test_log_lines_are_in_expected_order():
    identifier = _get_identifier()
    content = _read_log()
    marker_created = f"Created account: connection=github-test identifier={identifier}"
    marker_listed_before = f"Listed before delete: present=true identifier={identifier}"
    marker_deleted = f"Deleted account: connection=github-test identifier={identifier}"
    marker_listed_after = f"Listed after delete: present=false identifier={identifier}"

    idx_created = content.find(marker_created)
    idx_listed_before = content.find(marker_listed_before)
    idx_deleted = content.find(marker_deleted)
    idx_listed_after = content.find(marker_listed_after)

    assert -1 not in (idx_created, idx_listed_before, idx_deleted, idx_listed_after), (
        "One or more required log markers were not found in the log file."
    )
    assert idx_created < idx_listed_before < idx_deleted < idx_listed_after, (
        "Log markers are not in the required order: "
        "Created -> Listed before delete -> Deleted -> Listed after delete. "
        f"Indices were: created={idx_created}, listed_before={idx_listed_before}, "
        f"deleted={idx_deleted}, listed_after={idx_listed_after}."
    )


def test_dynamic_connected_account_was_deleted():
    """Use the Scalekit Python SDK to confirm the dynamic account no longer exists."""
    identifier = _get_identifier()
    scalekit = _get_scalekit_client()

    deleted = False
    fetched_status = None
    try:
        resp = scalekit.actions.get_connected_account(
            connection_name=CONNECTION_NAME,
            identifier=identifier,
        )
        # If we got a response, inspect it: the account must NOT be present as an
        # active record. Treat empty / missing connected_account as deleted.
        connected_account = getattr(resp, "connected_account", None)
        if connected_account is None:
            deleted = True
        else:
            fetched_status = getattr(connected_account, "status", None)
            # Some SDK versions return a tombstone with status DELETED instead of raising.
            if fetched_status in (None, "", "DELETED"):
                deleted = True
    except Exception:
        # Most SDK versions raise a NotFound-style error when the record is gone.
        deleted = True

    assert deleted, (
        f"Expected connected account for identifier {identifier!r} on connection "
        f"{CONNECTION_NAME!r} to be deleted, but the SDK returned status "
        f"{fetched_status!r}."
    )


def test_fixture_connected_account_is_untouched():
    """The pre-existing zealt-user01 connected account must remain ACTIVE."""
    scalekit = _get_scalekit_client()
    resp = scalekit.actions.get_connected_account(
        connection_name=CONNECTION_NAME,
        identifier=FIXTURE_IDENTIFIER,
    )
    connected_account = getattr(resp, "connected_account", None)
    assert connected_account is not None, (
        f"Fixture connected account for {FIXTURE_IDENTIFIER!r} on "
        f"{CONNECTION_NAME!r} is missing after the task ran."
    )
    status = getattr(connected_account, "status", None)
    status_str = str(status) if status is not None else ""
    assert "ACTIVE" in status_str, (
        f"Expected fixture account {FIXTURE_IDENTIFIER!r} to remain ACTIVE, "
        f"got status={status_str!r}."
    )
