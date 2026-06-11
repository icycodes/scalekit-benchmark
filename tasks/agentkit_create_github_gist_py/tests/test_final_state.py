import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
GIST_URL_RE = re.compile(r"^Gist URL:\s*(https://gist\.github\.com/\S+)\s*$", re.MULTILINE)


def _get_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is missing or empty."
    return run_id


def _read_log_text():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} not found."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return f.read()


def _extract_gist_url(log_text):
    match = GIST_URL_RE.search(log_text)
    assert match is not None, (
        "Log file does not contain a line matching 'Gist URL: <https://gist.github.com/...>'. "
        f"Log contents: {log_text!r}"
    )
    return match.group(1).strip()


def _list_user_gists():
    result = subprocess.run(
        ["gh", "api", "-X", "GET", "/users/zealt-user01/gists?per_page=100"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'gh api /users/zealt-user01/gists' failed: stderr={result.stderr!r}"
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"Failed to parse 'gh api /users/zealt-user01/gists' output as JSON: {exc}; "
            f"stdout={result.stdout!r}"
        )
    assert isinstance(data, list), (
        f"Expected gists list to be a JSON array; got: {type(data).__name__}"
    )
    return data


def _find_gist_by_url(gists, gist_url):
    matches = [g for g in gists if g.get("html_url") == gist_url]
    assert matches, (
        f"No gist found with html_url == {gist_url!r} among zealt-user01's gists. "
        f"Available html_urls: {[g.get('html_url') for g in gists]}"
    )
    assert len(matches) == 1, (
        f"Expected exactly one gist with html_url == {gist_url!r}, found {len(matches)}."
    )
    return matches[0]


def _fetch_gist_details(gist_id):
    result = subprocess.run(
        ["gh", "api", f"/gists/{gist_id}"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'gh api /gists/{gist_id}' failed: stderr={result.stderr!r}"
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"Failed to parse 'gh api /gists/{gist_id}' output as JSON: {exc}; "
            f"stdout={result.stdout!r}"
        )


def test_log_file_contains_gist_url():
    log_text = _read_log_text()
    gist_url = _extract_gist_url(log_text)
    assert gist_url.startswith("https://gist.github.com/"), (
        f"Extracted gist URL has an unexpected prefix: {gist_url!r}"
    )


def test_gist_exists_for_zealt_user01_and_is_public():
    log_text = _read_log_text()
    gist_url = _extract_gist_url(log_text)
    gists = _list_user_gists()
    gist = _find_gist_by_url(gists, gist_url)
    assert gist.get("public") is True, (
        f"Gist at {gist_url} is not public; public={gist.get('public')!r}"
    )


def test_gist_description_contains_run_id_marker():
    run_id = _get_run_id()
    log_text = _read_log_text()
    gist_url = _extract_gist_url(log_text)
    gists = _list_user_gists()
    gist = _find_gist_by_url(gists, gist_url)
    description = gist.get("description") or ""
    expected_marker = f"scalekit-agentkit-{run_id}"
    assert expected_marker in description, (
        f"Gist description does not contain expected marker {expected_marker!r}; "
        f"got description={description!r}"
    )


def test_gist_has_single_expected_file():
    run_id = _get_run_id()
    log_text = _read_log_text()
    gist_url = _extract_gist_url(log_text)
    gists = _list_user_gists()
    gist = _find_gist_by_url(gists, gist_url)
    files = gist.get("files") or {}
    expected_filename = f"scalekit-{run_id}.md"
    assert list(files.keys()) == [expected_filename], (
        f"Expected gist to contain exactly one file named {expected_filename!r}; "
        f"got file names: {list(files.keys())}"
    )


def test_gist_details_match_via_direct_api():
    run_id = _get_run_id()
    log_text = _read_log_text()
    gist_url = _extract_gist_url(log_text)
    gists = _list_user_gists()
    gist = _find_gist_by_url(gists, gist_url)
    gist_id = gist.get("id")
    assert gist_id, f"Gist record is missing an 'id' field: {gist!r}"

    details = _fetch_gist_details(gist_id)
    assert details.get("public") is True, (
        f"Direct gist API call shows gist {gist_id} is not public; public={details.get('public')!r}"
    )
    description = details.get("description") or ""
    expected_marker = f"scalekit-agentkit-{run_id}"
    assert expected_marker in description, (
        f"Direct gist API call: description does not contain {expected_marker!r}; "
        f"got: {description!r}"
    )
    files = details.get("files") or {}
    expected_filename = f"scalekit-{run_id}.md"
    assert list(files.keys()) == [expected_filename], (
        f"Direct gist API call: expected single file named {expected_filename!r}; "
        f"got files: {list(files.keys())}"
    )
