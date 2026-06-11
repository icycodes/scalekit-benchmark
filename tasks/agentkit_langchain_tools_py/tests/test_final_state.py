import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
SCRIPT_FILE = os.path.join(PROJECT_DIR, "run.py")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
TOOLS_FILE = os.path.join(PROJECT_DIR, "tools.json")

EXPECTED_CONNECTION = "github-test"
EXPECTED_IDENTIFIER = "zealt-user01"


def _read_text(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def test_script_file_exists():
    assert os.path.isfile(SCRIPT_FILE), f"Script file {SCRIPT_FILE} does not exist."


def test_script_uses_scalekit_langchain_adapter():
    content = _read_text(SCRIPT_FILE)
    assert "scalekit" in content, (
        "run.py must reference the scalekit package (e.g., `import scalekit` "
        "or `from scalekit`)."
    )
    assert "actions.langchain.get_tools" in content, (
        "run.py must call the LangChain framework adapter "
        "via `actions.langchain.get_tools(...)`."
    )


def test_script_does_not_bypass_sdk():
    content = _read_text(SCRIPT_FILE)
    forbidden = [
        "requests.",
        "httpx",
        "urllib.request",
        "from urllib",
        "import urllib",
        "subprocess",
        "os.system(",
        "curl ",
    ]
    for needle in forbidden:
        assert needle not in content, (
            f"run.py must not bypass the Scalekit SDK; found forbidden token: {needle!r}"
        )


def test_tools_json_exists_and_has_expected_shape():
    assert os.path.isfile(TOOLS_FILE), f"Catalog file {TOOLS_FILE} does not exist."
    with open(TOOLS_FILE, "r", encoding="utf-8") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as exc:
            raise AssertionError(f"{TOOLS_FILE} is not valid JSON: {exc!r}")
    for key in ("connection", "identifier", "count", "tools"):
        assert key in data, f"{TOOLS_FILE} is missing required top-level key {key!r}."
    assert data["connection"] == EXPECTED_CONNECTION, (
        f"Expected connection {EXPECTED_CONNECTION!r} in {TOOLS_FILE}, "
        f"got {data['connection']!r}."
    )
    assert data["identifier"] == EXPECTED_IDENTIFIER, (
        f"Expected identifier {EXPECTED_IDENTIFIER!r} in {TOOLS_FILE}, "
        f"got {data['identifier']!r}."
    )
    assert isinstance(data["tools"], list), (
        f"`tools` in {TOOLS_FILE} must be a JSON array, got {type(data['tools']).__name__}."
    )
    assert isinstance(data["count"], int), (
        f"`count` in {TOOLS_FILE} must be an integer, got {type(data['count']).__name__}."
    )
    assert data["count"] == len(data["tools"]), (
        f"`count` ({data['count']}) does not equal len(tools) ({len(data['tools'])}) "
        f"in {TOOLS_FILE}."
    )
    assert data["count"] > 5, (
        f"Expected more than 5 tools in {TOOLS_FILE}, got {data['count']}."
    )


def test_tools_entries_are_well_formed_and_github_prefixed():
    with open(TOOLS_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    names = []
    for entry in data["tools"]:
        assert isinstance(entry, dict), (
            f"Each entry in `tools` must be a JSON object, got {type(entry).__name__}."
        )
        assert "name" in entry and isinstance(entry["name"], str) and entry["name"], (
            f"Tool entry missing non-empty `name`: {entry!r}"
        )
        assert "description" in entry and isinstance(entry["description"], str), (
            f"Tool entry missing `description` string: {entry!r}"
        )
        assert entry["name"].startswith("github_"), (
            f"Tool name {entry['name']!r} does not start with 'github_'."
        )
        names.append(entry["name"])
    assert names == sorted(names), (
        "`tools` array in tools.json must be sorted in ascending order by `name`; "
        f"got {names!r}."
    )


def test_output_log_contains_summary_lines():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    content = _read_text(LOG_FILE)
    for required in (
        "Adapter: langchain",
        f"Connection: {EXPECTED_CONNECTION}",
        f"Identifier: {EXPECTED_IDENTIFIER}",
    ):
        assert required in content, (
            f"Expected line {required!r} in {LOG_FILE}; got:\n{content}"
        )

    match = re.search(r"^Tool count:\s*(\d+)\s*$", content, flags=re.MULTILINE)
    assert match is not None, (
        f"Expected a line matching `Tool count: <N>` in {LOG_FILE}; got:\n{content}"
    )
    logged_count = int(match.group(1))

    with open(TOOLS_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    assert logged_count == data["count"], (
        f"`Tool count: {logged_count}` in {LOG_FILE} does not match "
        f"`count` ({data['count']}) in {TOOLS_FILE}."
    )


def test_langchain_adapter_live_returns_basetool_objects_matching_catalog():
    from scalekit import ScalekitClient  # type: ignore
    from langchain_core.tools import BaseTool  # type: ignore

    client = ScalekitClient(
        os.environ["SCALEKIT_ENV_URL"],
        os.environ["SCALEKIT_CLIENT_ID"],
        os.environ["SCALEKIT_CLIENT_SECRET"],
    )
    tools = client.actions.langchain.get_tools(
        identifier=EXPECTED_IDENTIFIER,
        connection_names=[EXPECTED_CONNECTION],
        page_size=100,
    )
    assert isinstance(tools, list) and tools, (
        "Expected a non-empty list of LangChain tools from "
        "actions.langchain.get_tools(...)."
    )
    for tool in tools:
        assert isinstance(tool, BaseTool), (
            "Every object returned by actions.langchain.get_tools must be a "
            f"langchain_core.tools.BaseTool instance; got {type(tool).__name__}."
        )

    live_names = {tool.name for tool in tools}
    with open(TOOLS_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    catalog_names = {entry["name"] for entry in data["tools"]}
    missing = catalog_names - live_names
    assert not missing, (
        "Names recorded in tools.json must be a subset of the live LangChain "
        f"adapter output; missing on live side: {sorted(missing)!r}"
    )
