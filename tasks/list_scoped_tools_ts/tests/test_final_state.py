import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
TOOLS_JSON_PATH = os.path.join(PROJECT_DIR, "tools.json")
LOG_FILE_PATH = os.path.join(PROJECT_DIR, "output.log")


@pytest.fixture(scope="module")
def tools_catalog():
    assert os.path.isfile(TOOLS_JSON_PATH), (
        f"Expected catalog file {TOOLS_JSON_PATH} to exist."
    )
    with open(TOOLS_JSON_PATH, "r", encoding="utf-8") as f:
        raw = f.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        pytest.fail(f"{TOOLS_JSON_PATH} is not valid JSON: {exc}")
    return data


@pytest.fixture(scope="module")
def log_text():
    assert os.path.isfile(LOG_FILE_PATH), (
        f"Expected log file {LOG_FILE_PATH} to exist."
    )
    with open(LOG_FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_tools_json_top_level_shape(tools_catalog):
    assert isinstance(tools_catalog, dict), (
        f"tools.json must be a JSON object, got {type(tools_catalog).__name__}."
    )
    assert set(tools_catalog.keys()) == {"github-test", "slack-test"}, (
        "tools.json must contain exactly the top-level keys 'github-test' and "
        f"'slack-test'. Found: {sorted(tools_catalog.keys())}."
    )


def test_github_tools_listed_correctly(tools_catalog):
    github_tools = tools_catalog["github-test"]
    assert isinstance(github_tools, list), (
        "tools.json['github-test'] must be a list of tool name strings."
    )
    assert all(isinstance(t, str) for t in github_tools), (
        "All entries under 'github-test' must be strings."
    )
    assert len(github_tools) == len(set(github_tools)), (
        "Duplicate tool names found under 'github-test'."
    )
    assert len(github_tools) > 5, (
        "Expected more than 5 tools under 'github-test'; "
        f"got {len(github_tools)}. Did you pass a large enough pageSize?"
    )
    bad = [t for t in github_tools if not t.startswith("github_")]
    assert not bad, (
        "Every tool under 'github-test' must start with 'github_'. "
        f"Offending entries: {bad[:5]}"
    )


def test_slack_tools_listed_correctly(tools_catalog):
    slack_tools = tools_catalog["slack-test"]
    assert isinstance(slack_tools, list), (
        "tools.json['slack-test'] must be a list of tool name strings."
    )
    assert all(isinstance(t, str) for t in slack_tools), (
        "All entries under 'slack-test' must be strings."
    )
    assert len(slack_tools) == len(set(slack_tools)), (
        "Duplicate tool names found under 'slack-test'."
    )
    assert len(slack_tools) > 5, (
        "Expected more than 5 tools under 'slack-test'; "
        f"got {len(slack_tools)}. Did you pass a large enough pageSize?"
    )
    bad = [t for t in slack_tools if not t.startswith("slack_")]
    assert not bad, (
        "Every tool under 'slack-test' must start with 'slack_'. "
        f"Offending entries: {bad[:5]}"
    )


def test_log_summary_lines(log_text, tools_catalog):
    github_count = len(tools_catalog["github-test"])
    slack_count = len(tools_catalog["slack-test"])

    github_pattern = re.compile(
        rf"^GitHub tools:\s*{github_count}\s*$", re.MULTILINE
    )
    slack_pattern = re.compile(
        rf"^Slack tools:\s*{slack_count}\s*$", re.MULTILINE
    )

    assert github_pattern.search(log_text), (
        f"output.log must contain a line 'GitHub tools: {github_count}' "
        f"matching the number of tools in tools.json['github-test']."
    )
    assert slack_pattern.search(log_text), (
        f"output.log must contain a line 'Slack tools: {slack_count}' "
        f"matching the number of tools in tools.json['slack-test']."
    )
