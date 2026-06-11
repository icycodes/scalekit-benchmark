import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
SRC_FILE = os.path.join(PROJECT_DIR, "src", "index.ts")
CHANNEL_BASENAME = "harbor-slack"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id


def _read_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} not found."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _list_slack_channels() -> list[dict]:
    slack_token = os.environ.get("SLACK_TOKEN")
    assert slack_token, "SLACK_TOKEN environment variable is required to verify Slack channels."
    result = subprocess.run(
        [
            "curl",
            "-sS",
            "-H",
            f"Authorization: Bearer {slack_token}",
            "https://slack.com/api/conversations.list?limit=1000&types=public_channel,private_channel",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Slack conversations.list curl failed: {result.stderr}"
    data = json.loads(result.stdout)
    assert data.get("ok"), f"Slack API error: {data}"
    return data.get("channels", [])


def test_log_file_records_channel_name():
    run_id = _get_run_id()
    expected_name = f"{CHANNEL_BASENAME}-{run_id}"
    log = _read_log()
    assert re.search(rf"^Channel Name:\s*{re.escape(expected_name)}\s*$", log, re.MULTILINE), (
        f"Expected 'Channel Name: {expected_name}' line in {LOG_FILE}, got:\n{log}"
    )


def test_log_file_records_channel_id():
    log = _read_log()
    match = re.search(r"^Channel ID:\s*(C[A-Z0-9]+)\s*$", log, re.MULTILINE)
    assert match, (
        f"Expected 'Channel ID: C...' line (Slack channel id starting with 'C') in {LOG_FILE}, got:\n{log}"
    )


def test_channel_exists_on_slack_and_is_public():
    run_id = _get_run_id()
    expected_name = f"{CHANNEL_BASENAME}-{run_id}"
    channels = _list_slack_channels()
    matching = [c for c in channels if c.get("name") == expected_name]
    assert matching, (
        f"Expected Slack channel named '{expected_name}' to exist. "
        f"Available channel names: {[c.get('name') for c in channels]}"
    )
    channel = matching[0]
    assert channel.get("is_private") is False, (
        f"Expected channel '{expected_name}' to be public, but is_private={channel.get('is_private')}."
    )


def test_log_channel_id_matches_slack_api_channel_id():
    run_id = _get_run_id()
    expected_name = f"{CHANNEL_BASENAME}-{run_id}"
    log = _read_log()
    match = re.search(r"^Channel ID:\s*(C[A-Z0-9]+)\s*$", log, re.MULTILINE)
    assert match, f"No 'Channel ID:' line found in {LOG_FILE}."
    logged_id = match.group(1)

    channels = _list_slack_channels()
    matching = [c for c in channels if c.get("name") == expected_name]
    assert matching, f"Channel '{expected_name}' not found on Slack."
    api_id = matching[0].get("id")
    assert api_id == logged_id, (
        f"Logged channel id '{logged_id}' does not match Slack API channel id '{api_id}'."
    )


def test_source_uses_scalekit_node_sdk_and_correct_fixtures():
    assert os.path.isfile(SRC_FILE), f"Expected TypeScript source at {SRC_FILE}."
    with open(SRC_FILE, "r", encoding="utf-8") as f:
        source = f.read()
    assert "@scalekit-sdk/node" in source, (
        f"Expected source {SRC_FILE} to import from '@scalekit-sdk/node'."
    )
    assert "slack_create_channel" in source, (
        f"Expected source {SRC_FILE} to reference the Scalekit Slack tool 'slack_create_channel'."
    )
    assert "slack-test" in source, (
        f"Expected source {SRC_FILE} to use the 'slack-test' Scalekit connection."
    )
    assert "zealt-user01" in source, (
        f"Expected source {SRC_FILE} to use 'zealt-user01' as the identifier."
    )
