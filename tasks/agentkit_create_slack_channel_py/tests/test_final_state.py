import json
import os
import re
import subprocess


PROJECT_DIR = "/home/user/myproject"
SCRIPT_FILE = os.path.join(PROJECT_DIR, "run.py")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID is not set in the verification environment."
    return run_id


def _expected_channel_name():
    return f"agentkit-task-{_run_id()}"


def _slack_token():
    token = os.environ.get("SLACK_TOKEN", "").strip()
    assert token, "SLACK_TOKEN is not set in the verification environment."
    return token


def _list_slack_channels():
    token = _slack_token()
    result = subprocess.run(
        [
            "curl",
            "-sS",
            "-H",
            f"Authorization: Bearer {token}",
            "https://slack.com/api/conversations.list?limit=1000"
            "&types=public_channel,private_channel"
            "&exclude_archived=false",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Failed to call Slack conversations.list: {result.stderr}"
    )
    payload = json.loads(result.stdout)
    assert payload.get("ok") is True, (
        f"Slack API returned an error response: {payload}"
    )
    return payload.get("channels", [])


def test_script_file_exists_and_uses_scalekit_sdk():
    assert os.path.isfile(SCRIPT_FILE), (
        f"Expected the executor's script at {SCRIPT_FILE}, but it was not found."
    )
    with open(SCRIPT_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    assert re.search(r"\bscalekit\b", contents), (
        f"Expected {SCRIPT_FILE} to import or reference the Scalekit Python SDK "
        "(module name 'scalekit') so the action is performed against the real "
        "Scalekit AgentKit API rather than mocked."
    )


def test_log_file_exists_with_expected_format():
    assert os.path.isfile(LOG_FILE), (
        f"Expected the log file {LOG_FILE} to exist after the task ran."
    )
    expected_name = _expected_channel_name()
    pattern = re.compile(
        rf"^Channel:\s+{re.escape(expected_name)}\s+\((C[A-Z0-9]+)\)\s*$",
        re.MULTILINE,
    )
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    match = pattern.search(contents)
    assert match, (
        f"Expected {LOG_FILE} to contain a line in the format "
        f"'Channel: {expected_name} (C<id>)', but log contents were: {contents!r}"
    )


def test_slack_channel_created_with_expected_name():
    expected_name = _expected_channel_name()
    channels = _list_slack_channels()
    names = [c.get("name") for c in channels]
    assert expected_name in names, (
        f"Expected to find a Slack channel named '{expected_name}' in the workspace, "
        f"but conversations.list returned: {names}"
    )


def test_slack_channel_is_public_and_active():
    expected_name = _expected_channel_name()
    channels = _list_slack_channels()
    matching = [c for c in channels if c.get("name") == expected_name]
    assert matching, (
        f"Expected to find the Slack channel '{expected_name}' via conversations.list."
    )
    channel = matching[0]
    assert channel.get("is_private") is False, (
        f"Expected Slack channel '{expected_name}' to be public (is_private == false), "
        f"got channel object: {channel}"
    )
    assert channel.get("is_archived") is False, (
        f"Expected Slack channel '{expected_name}' to not be archived, "
        f"got channel object: {channel}"
    )
    assert channel.get("is_channel") is True, (
        f"Expected Slack channel '{expected_name}' to be a regular channel "
        f"(is_channel == true), got channel object: {channel}"
    )


def test_log_channel_id_matches_slack_api():
    expected_name = _expected_channel_name()
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    log_match = re.search(
        rf"Channel:\s+{re.escape(expected_name)}\s+\((C[A-Z0-9]+)\)",
        contents,
    )
    assert log_match, (
        f"Could not extract a channel id from {LOG_FILE}; contents: {contents!r}"
    )
    log_channel_id = log_match.group(1)

    channels = _list_slack_channels()
    matching = [c for c in channels if c.get("name") == expected_name]
    assert matching, (
        f"Expected to find Slack channel '{expected_name}' via the Slack API."
    )
    api_channel_id = matching[0].get("id")
    assert log_channel_id == api_channel_id, (
        f"Channel id in {LOG_FILE} ({log_channel_id}) does not match the id "
        f"reported by Slack API ({api_channel_id}) for channel '{expected_name}'."
    )
