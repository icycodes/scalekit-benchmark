import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
TOOLS_PATH = os.path.join(PROJECT_DIR, "tools.json")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")
CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"


def _load_tools_json():
    assert os.path.isfile(TOOLS_PATH), (
        f"Expected output file {TOOLS_PATH} does not exist."
    )
    with open(TOOLS_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data


def test_tools_json_is_list_of_strings():
    data = _load_tools_json()
    assert isinstance(data, list), (
        f"tools.json must contain a JSON array, got {type(data).__name__}."
    )
    assert all(isinstance(item, str) for item in data), (
        "Every entry in tools.json must be a string tool name."
    )
    assert len(data) > 0, "tools.json must contain at least one tool name."


def test_tools_json_contains_at_least_20_entries():
    data = _load_tools_json()
    assert len(data) >= 20, (
        f"Expected at least 20 tool names in tools.json (the GitHub connector "
        f"exposes far more than the default page size), got {len(data)}."
    )


def test_tools_json_contains_github_tool():
    data = _load_tools_json()
    github_tools = [name for name in data if name.startswith("github_")]
    assert len(github_tools) > 0, (
        "Expected at least one tool name beginning with 'github_' in tools.json, "
        f"got: {data[:10]}..."
    )


def test_output_log_contains_count_line():
    assert os.path.isfile(LOG_PATH), f"Log file {LOG_PATH} does not exist."
    with open(LOG_PATH, "r", encoding="utf-8") as fh:
        log_text = fh.read()
    match = re.search(r"Tools discovered:\s*(\d+)", log_text)
    assert match is not None, (
        "Expected a line matching 'Tools discovered: <count>' in output.log, "
        f"got: {log_text!r}"
    )
    count_in_log = int(match.group(1))
    data = _load_tools_json()
    assert count_in_log == len(data), (
        f"Count reported in output.log ({count_in_log}) does not match "
        f"len(tools.json) ({len(data)})."
    )


def test_tool_names_match_scalekit_api():
    try:
        from scalekit import ScalekitClient
    except Exception as exc:  # pragma: no cover - environment failure
        pytest.fail(f"scalekit Python SDK is not importable in the verifier: {exc!r}")

    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    assert env_url and client_id and client_secret, (
        "Verifier requires SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, and "
        "SCALEKIT_CLIENT_SECRET to be set in the environment."
    )

    client = ScalekitClient(env_url, client_id, client_secret)

    # The SDK returns a tuple (response, metadata).
    response, _ = client.actions.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter={"connection_names": [CONNECTION_NAME]},
        page_size=100,
    )

    try:
        from google.protobuf.json_format import MessageToDict
    except Exception as exc:  # pragma: no cover - environment failure
        pytest.fail(
            f"google.protobuf is required by the verifier but is not importable: {exc!r}"
        )

    api_tool_names = set()
    for scoped_tool in response.tools:
        as_dict = MessageToDict(scoped_tool.tool)
        definition = as_dict.get("definition", {})
        name = definition.get("name")
        if isinstance(name, str) and name:
            api_tool_names.add(name)

    assert len(api_tool_names) > 0, (
        "Scalekit API returned no tools for the verifier; cannot validate output."
    )

    data = _load_tools_json()
    written = set(data)
    missing = written - api_tool_names
    assert not missing, (
        "tools.json contains tool names that are not returned by Scalekit's "
        f"list_scoped_tools API: {sorted(missing)[:5]} (and possibly more)."
    )
