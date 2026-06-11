import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
USERNAME = "zealt-user01"
REPO_BASENAME = "agentkit-issue-target"
ISSUE_TITLE_BASE = "AgentKit Test Issue"


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID is not set in the verifier environment."
    return run_id


def _repo_name() -> str:
    return f"{REPO_BASENAME}-{_run_id()}"


def _repo_slug() -> str:
    return f"{USERNAME}/{_repo_name()}"


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Expected log file at {LOG_FILE} but it was not found."


def test_target_repository_exists():
    result = subprocess.run(
        ["gh", "repo", "list", USERNAME, "--limit", "100", "--json", "name"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"'gh repo list' failed: {result.stderr}"
    repos = json.loads(result.stdout)
    names = [r["name"] for r in repos]
    expected = _repo_name()
    assert expected in names, (
        f"Expected repository '{expected}' under {USERNAME} but did not find it. "
        f"Found: {names}"
    )


def test_target_repository_is_public():
    result = subprocess.run(
        ["gh", "repo", "view", _repo_slug(), "--json", "visibility"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"'gh repo view' failed: {result.stderr}"
    info = json.loads(result.stdout)
    visibility = info.get("visibility", "")
    assert visibility == "PUBLIC", (
        f"Expected repository {_repo_slug()} to be PUBLIC, got visibility={visibility!r}."
    )


def test_issue_created_with_expected_title():
    expected_title = f"{ISSUE_TITLE_BASE} {_run_id()}"
    result = subprocess.run(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            _repo_slug(),
            "--state",
            "all",
            "--json",
            "title,url,number",
            "--limit",
            "50",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"'gh issue list' failed: {result.stderr}"
    issues = json.loads(result.stdout)
    matching = [i for i in issues if i.get("title") == expected_title]
    assert matching, (
        f"Expected at least one issue titled {expected_title!r} on {_repo_slug()}; "
        f"found titles: {[i.get('title') for i in issues]}"
    )


def test_log_file_contains_expected_issue_url():
    # Read the actual issue URL from GitHub and confirm the log file references it.
    expected_title = f"{ISSUE_TITLE_BASE} {_run_id()}"
    result = subprocess.run(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            _repo_slug(),
            "--state",
            "all",
            "--json",
            "title,url,number",
            "--limit",
            "50",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"'gh issue list' failed: {result.stderr}"
    issues = json.loads(result.stdout)
    matching = [i for i in issues if i.get("title") == expected_title]
    assert matching, (
        f"No issue with title {expected_title!r} found on {_repo_slug()}; "
        f"cannot verify URL in log."
    )
    expected_url = matching[0]["url"]

    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        log_text = fh.read()

    url_prefix = f"https://github.com/{_repo_slug()}/issues/"
    assert expected_url.startswith(url_prefix), (
        f"GitHub returned issue URL {expected_url!r} which does not match the expected "
        f"prefix {url_prefix!r}."
    )

    pattern = re.compile(
        rf"^Issue URL:\s+{re.escape(expected_url)}\s*$",
        re.MULTILINE,
    )
    assert pattern.search(log_text), (
        f"Expected the log file {LOG_FILE} to contain a line "
        f"'Issue URL: {expected_url}', but it was not found. Log contents:\n{log_text}"
    )
