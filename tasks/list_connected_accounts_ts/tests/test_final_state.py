import json
import os
import re

PROJECT_DIR = "/home/user/myproject"
ACCOUNTS_FILE = os.path.join(PROJECT_DIR, "accounts.json")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _load_accounts():
    assert os.path.isfile(ACCOUNTS_FILE), f"Catalog file {ACCOUNTS_FILE} does not exist."
    with open(ACCOUNTS_FILE) as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as exc:
            raise AssertionError(
                f"Catalog file {ACCOUNTS_FILE} is not valid JSON: {exc}"
            )


def test_accounts_file_exists_and_is_json():
    data = _load_accounts()
    assert isinstance(data, dict), (
        f"Expected the top-level value in {ACCOUNTS_FILE} to be a JSON object, "
        f"got {type(data).__name__}."
    )


def test_accounts_connection_name_is_github_test():
    data = _load_accounts()
    assert "connection_name" in data, (
        f"Catalog {ACCOUNTS_FILE} is missing the required key 'connection_name'."
    )
    assert data["connection_name"] == "github-test", (
        f"Expected connection_name to be 'github-test', got: {data['connection_name']!r}"
    )


def test_accounts_identifiers_is_list_of_strings():
    data = _load_accounts()
    assert "identifiers" in data, (
        f"Catalog {ACCOUNTS_FILE} is missing the required key 'identifiers'."
    )
    identifiers = data["identifiers"]
    assert isinstance(identifiers, list), (
        f"Expected 'identifiers' to be a JSON array, got {type(identifiers).__name__}."
    )
    assert len(identifiers) >= 1, (
        f"Expected at least one identifier in 'identifiers', got an empty array."
    )
    for item in identifiers:
        assert isinstance(item, str), (
            f"Every entry of 'identifiers' must be a string, found {type(item).__name__}: {item!r}"
        )


def test_accounts_includes_zealt_user01():
    data = _load_accounts()
    identifiers = data.get("identifiers", [])
    assert "zealt-user01" in identifiers, (
        f"Expected 'zealt-user01' to appear in identifiers, got: {identifiers}"
    )


def test_output_log_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."


def test_output_log_contains_expected_summary_line():
    data = _load_accounts()
    expected_count = len(data.get("identifiers", []))
    expected_line = f"GitHub connected accounts: {expected_count}"

    with open(LOG_FILE) as f:
        lines = [line.rstrip("\n") for line in f]

    pattern = re.compile(r"^GitHub connected accounts: (\d+)\s*$")
    matching_counts = [int(m.group(1)) for line in lines for m in [pattern.match(line)] if m]
    assert matching_counts, (
        f"Expected a line matching 'GitHub connected accounts: <N>' in {LOG_FILE}, "
        f"got lines: {lines}"
    )
    assert expected_count in matching_counts, (
        f"Expected log file to report '{expected_line}', "
        f"but found counts {matching_counts} in {LOG_FILE}."
    )
