import json
import os
import re
import subprocess


PROJECT_DIR = "/home/user/scalekit-task"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
RESOURCE_BASENAME = "harbor-notify"
GITHUB_USERNAME = "zealt-user01"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set; cannot verify."
    return run_id


def _expected_resource_name(run_id: str) -> str:
    return f"{RESOURCE_BASENAME}-{run_id}"


def _expected_repo_url(run_id: str) -> str:
    return f"https://github.com/{GITHUB_USERNAME}/{_expected_resource_name(run_id)}"


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


def test_log_file_contains_expected_lines():
    run_id = _get_run_id()
    expected_repo_url = _expected_repo_url(run_id)

    log_content = _read_log_file()

    repo_url = _parse_log_value(log_content, "Repository URL")
    channel_id = _parse_log_value(log_content, "Channel ID")
    message_ts = _parse_log_value(log_content, "Message TS")

    assert repo_url.rstrip("/").lower() == expected_repo_url.lower(), (
        f"'Repository URL' value '{repo_url}' does not match expected "
        f"'{expected_repo_url}'."
    )
    assert re.match(r"^[A-Z][A-Z0-9]+$", channel_id), (
        f"'Channel ID' value '{channel_id}' does not look like a Slack channel id."
    )
    assert re.match(r"^\d+\.\d+$", message_ts) or re.match(r"^\d+$", message_ts), (
        f"'Message TS' value '{message_ts}' does not look like a Slack message timestamp."
    )


def test_github_repo_was_created():
    run_id = _get_run_id()
    expected_repo_name = _expected_resource_name(run_id)
    expected_repo_url = _expected_repo_url(run_id)

    list_result = subprocess.run(
        [
            "gh",
            "repo",
            "list",
            GITHUB_USERNAME,
            "--limit",
            "100",
            "--json",
            "name,url",
        ],
        capture_output=True,
        text=True,
    )
    assert list_result.returncode == 0, (
        f"`gh repo list` failed: stdout={list_result.stdout!r} stderr={list_result.stderr!r}"
    )
    try:
        repos = json.loads(list_result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"`gh repo list` output was not valid JSON: {list_result.stdout!r} ({exc})"
        )
    matching_repos = [r for r in repos if r.get("name") == expected_repo_name]
    assert matching_repos, (
        f"Expected GitHub repository '{expected_repo_name}' to exist under "
        f"'{GITHUB_USERNAME}'. Found names: {[r.get('name') for r in repos]}"
    )

    actual_repo_url = (matching_repos[0].get("url") or "").rstrip("/")
    assert actual_repo_url.lower() == expected_repo_url.lower(), (
        f"GitHub returned URL '{actual_repo_url}' for repo "
        f"'{expected_repo_name}', expected '{expected_repo_url}'."
    )

    log_repo_url = _parse_log_value(_read_log_file(), "Repository URL").rstrip("/")
    assert log_repo_url.lower() == actual_repo_url.lower(), (
        f"Repository URL in log ('{log_repo_url}') does not match the URL "
        f"reported by GitHub ('{actual_repo_url}')."
    )


def test_github_repo_is_public_with_default_branch():
    run_id = _get_run_id()
    expected_repo_name = _expected_resource_name(run_id)

    view_result = subprocess.run(
        [
            "gh",
            "repo",
            "view",
            f"{GITHUB_USERNAME}/{expected_repo_name}",
            "--json",
            "visibility,defaultBranchRef",
        ],
        capture_output=True,
        text=True,
    )
    assert view_result.returncode == 0, (
        f"`gh repo view` failed for '{GITHUB_USERNAME}/{expected_repo_name}': "
        f"stdout={view_result.stdout!r} stderr={view_result.stderr!r}"
    )
    try:
        view_data = json.loads(view_result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"`gh repo view` output was not valid JSON: {view_result.stdout!r} ({exc})"
        )
    visibility = (view_data.get("visibility") or "").upper()
    assert visibility == "PUBLIC", (
        f"Expected repository '{expected_repo_name}' visibility to be 'PUBLIC', "
        f"got '{visibility}'."
    )
    default_branch_ref = view_data.get("defaultBranchRef")
    assert default_branch_ref, (
        f"Expected repository '{expected_repo_name}' to be initialized with a "
        f"README (and therefore have a default branch), but defaultBranchRef is "
        f"missing or null: {default_branch_ref!r}."
    )


def test_slack_channel_was_created():
    run_id = _get_run_id()
    expected_channel_name = _expected_resource_name(run_id)

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
        f"Channel ID in log ('{log_channel_id}') does not match the id Slack "
        f"reports for channel '{expected_channel_name}' ('{actual_channel_id}')."
    )


def test_slack_notification_message_was_posted():
    run_id = _get_run_id()
    expected_channel_name = _expected_resource_name(run_id)
    expected_repo_url = _expected_repo_url(run_id)

    list_data = _slack_api_call(
        "conversations.list?limit=200&types=public_channel,private_channel"
    )
    assert list_data.get("ok"), f"Slack conversations.list error: {list_data}"
    matching = [
        c for c in list_data.get("channels", [])
        if c.get("name") == expected_channel_name
    ]
    assert matching, (
        f"Channel '{expected_channel_name}' was not found while verifying the "
        f"notification message."
    )
    channel_id = matching[0]["id"]

    history = _slack_api_call(
        f"conversations.history?channel={channel_id}&limit=50"
    )
    assert history.get("ok"), f"Slack conversations.history error: {history}"

    messages = history.get("messages", [])
    matched_message = next(
        (m for m in messages if expected_repo_url.lower() in (m.get("text") or "").lower()),
        None,
    )
    assert matched_message is not None, (
        f"Expected to find a message containing the repository URL "
        f"'{expected_repo_url}' in Slack channel '{expected_channel_name}'. "
        f"Got messages: {[m.get('text') for m in messages]}"
    )
