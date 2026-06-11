import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
CHANNEL_BASENAME = "agentkit-demo"
MARKER_PREFIX = "scalekit-agentkit-ts"


def get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id


def get_slack_token() -> str:
    token = os.environ.get("SLACK_TOKEN", "").strip()
    assert token, "SLACK_TOKEN environment variable is not set."
    return token


def read_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content.strip(), f"Log file {LOG_FILE} is empty."
    return content


def slack_api_get(path: str) -> dict:
    token = get_slack_token()
    url = f"https://slack.com/api/{path}"
    result = subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {token}", url],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"curl to {url} failed: stderr={result.stderr!r} stdout={result.stdout!r}"
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Slack API response from {url} is not valid JSON: {exc}; "
            f"raw response: {result.stdout!r}"
        )
    assert data.get("ok") is True, f"Slack API error from {url}: {data}"
    return data


@pytest.fixture(scope="module")
def run_id() -> str:
    return get_run_id()


@pytest.fixture(scope="module")
def channel_name(run_id: str) -> str:
    return f"{CHANNEL_BASENAME}-{run_id}"


@pytest.fixture(scope="module")
def marker(run_id: str) -> str:
    return f"{MARKER_PREFIX} {run_id}"


@pytest.fixture(scope="module")
def log_content() -> str:
    return read_log()


@pytest.fixture(scope="module")
def message_ts_from_log(log_content: str) -> str:
    match = re.search(r"^Message TS:\s*(\S+)\s*$", log_content, re.MULTILINE)
    assert match, (
        "Expected a line of the form 'Message TS: <ts>' in the log file. "
        f"Log content was:\n{log_content}"
    )
    return match.group(1)


@pytest.fixture(scope="module")
def channel_from_log(log_content: str) -> str:
    match = re.search(r"^Channel:\s*(\S+)\s*$", log_content, re.MULTILINE)
    assert match, (
        "Expected a line of the form 'Channel: <channel_name>' in the log file. "
        f"Log content was:\n{log_content}"
    )
    return match.group(1)


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."


def test_log_records_expected_channel_name(channel_from_log: str, channel_name: str):
    assert channel_from_log == channel_name, (
        f"Expected log to record channel name '{channel_name}', got '{channel_from_log}'."
    )


def test_slack_channel_was_created(channel_name: str) -> None:
    data = slack_api_get(
        "conversations.list?limit=1000&types=public_channel,private_channel"
    )
    channels = data.get("channels", [])
    names = [c.get("name") for c in channels]
    assert channel_name in names, (
        f"Expected Slack channel '{channel_name}' to exist; got channels: {names}"
    )


def test_slack_message_was_posted(
    channel_name: str, marker: str, message_ts_from_log: str
) -> None:
    list_data = slack_api_get(
        "conversations.list?limit=1000&types=public_channel,private_channel"
    )
    channel_id = None
    for c in list_data.get("channels", []):
        if c.get("name") == channel_name:
            channel_id = c.get("id")
            break
    assert channel_id, (
        f"Could not locate Slack channel id for channel name '{channel_name}'."
    )

    history = slack_api_get(
        f"conversations.history?channel={channel_id}&limit=200"
    )
    messages = history.get("messages", [])
    matching = [m for m in messages if m.get("ts") == message_ts_from_log]
    assert matching, (
        f"No Slack message with ts '{message_ts_from_log}' found in channel "
        f"'{channel_name}'. Recent messages: "
        f"{[{'ts': m.get('ts'), 'text': m.get('text')} for m in messages[:10]]}"
    )
    message = matching[0]
    text = message.get("text", "")
    assert marker in text, (
        f"Slack message {message_ts_from_log} does not contain marker '{marker}'. "
        f"Got text: {text!r}"
    )
