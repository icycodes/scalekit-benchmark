import json
import os
import re
import subprocess


PROJECT_DIR = "/home/user/scalekit-task"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
CHANNEL_BASENAME = "harbor-msg"
MESSAGE_PREFIX = "Hello from Harbor evaluation run"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set; cannot verify."
    return run_id


def _read_log_file() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} not found."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _parse_log_value(log_content: str, key: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}:\s*(\S+)\s*$", re.MULTILINE)
    match = pattern.search(log_content)
    assert match, (
        f"Could not find a line of the form '{key}: <value>' in {LOG_FILE}."
    )
    value = match.group(1).strip()
    assert value, f"Found '{key}:' line but the value is empty in {LOG_FILE}."
    return value


def _slack_api_call(path: str) -> dict:
    slack_token = os.environ["SLACK_TOKEN"]
    url = f"https://slack.com/api/{path}"
    result = subprocess.run(
        [
            "curl",
            "-sS",
            "-H",
            f"Authorization: Bearer {slack_token}",
            url,
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"curl call to {url} failed: {result.stderr}"
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Slack API response from {url} is not valid JSON: {result.stdout!r} ({exc})"
        )


def test_log_file_contains_channel_and_message_lines():
    log_content = _read_log_file()

    channel_id = _parse_log_value(log_content, "Channel ID")
    message_ts = _parse_log_value(log_content, "Message TS")

    assert re.match(r"^[A-Z][A-Z0-9]+$", channel_id), (
        f"'Channel ID' value '{channel_id}' does not look like a Slack channel id."
    )
    assert re.match(r"^\d+\.\d+$", message_ts) or re.match(r"^\d+$", message_ts), (
        f"'Message TS' value '{message_ts}' does not look like a Slack message timestamp."
    )


def test_slack_channel_was_created():
    run_id = _get_run_id()
    expected_channel_name = f"{CHANNEL_BASENAME}-{run_id}"

    data = _slack_api_call(
        "conversations.list?limit=200&types=public_channel,private_channel"
    )
    assert data.get("ok"), f"Slack conversations.list error: {data}"

    channels = data.get("channels", [])
    matching = [c for c in channels if c.get("name") == expected_channel_name]
    assert matching, (
        f"Expected Slack channel '{expected_channel_name}' to exist. "
        f"Found channel names: {[c.get('name') for c in channels]}"
    )

    actual_channel_id = matching[0].get("id")
    assert actual_channel_id, (
        f"Slack returned a channel for '{expected_channel_name}' without an id field."
    )

    log_channel_id = _parse_log_value(_read_log_file(), "Channel ID")
    assert log_channel_id == actual_channel_id, (
        f"Channel ID in log ('{log_channel_id}') does not match the id Slack reports "
        f"for channel '{expected_channel_name}' ('{actual_channel_id}')."
    )


def test_slack_message_was_posted():
    run_id = _get_run_id()
    expected_channel_name = f"{CHANNEL_BASENAME}-{run_id}"
    expected_substring = f"{MESSAGE_PREFIX} {run_id}"

    list_data = _slack_api_call(
        "conversations.list?limit=200&types=public_channel,private_channel"
    )
    assert list_data.get("ok"), f"Slack conversations.list error: {list_data}"
    matching = [
        c for c in list_data.get("channels", [])
        if c.get("name") == expected_channel_name
    ]
    assert matching, (
        f"Channel '{expected_channel_name}' was not found while verifying the message."
    )
    channel_id = matching[0]["id"]

    history = _slack_api_call(
        f"conversations.history?channel={channel_id}&limit=50"
    )
    assert history.get("ok"), f"Slack conversations.history error: {history}"

    messages = history.get("messages", [])
    matched_message = next(
        (m for m in messages if expected_substring in (m.get("text") or "")),
        None,
    )
    assert matched_message is not None, (
        f"Expected to find a message containing '{expected_substring}' in channel "
        f"'{expected_channel_name}'. Got messages: "
        f"{[m.get('text') for m in messages]}"
    )
