import json
import os
import re
import subprocess


PROJECT_DIR = "/home/user/myproject"
SCRIPT_FILE = os.path.join(PROJECT_DIR, "run.py")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
REPO_OWNER = "zealt-user01"
REPO_BASENAME = "agentkit-repo"


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID is not set in the verification environment."
    return run_id


def _expected_repo_name():
    return f"{REPO_BASENAME}-{_run_id()}"


def _expected_full_name():
    return f"{REPO_OWNER}/{_expected_repo_name()}"


def _expected_html_url():
    return f"https://github.com/{REPO_OWNER}/{_expected_repo_name()}"


def _gh_env():
    env = os.environ.copy()
    # gh CLI accepts GH_TOKEN; ensure it is set from GH_TOKEN_01 if needed.
    token = env.get("GH_TOKEN", "").strip() or env.get("GH_TOKEN_01", "").strip()
    assert token, "Neither GH_TOKEN nor GH_TOKEN_01 is set in the verification environment."
    env["GH_TOKEN"] = token
    return env


def test_script_file_exists_and_uses_scalekit_sdk():
    assert os.path.isfile(SCRIPT_FILE), (
        f"Expected the executor's script at {SCRIPT_FILE}, but it was not found."
    )
    with open(SCRIPT_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    assert re.search(r"\bscalekit\b", contents, re.IGNORECASE), (
        f"Expected {SCRIPT_FILE} to import or reference the Scalekit Python SDK "
        "(module name 'scalekit') so the action is performed against the real "
        "Scalekit AgentKit API rather than mocked."
    )
    assert re.search(r"execute[_]?tool", contents, re.IGNORECASE), (
        f"Expected {SCRIPT_FILE} to call Scalekit's execute_tool (the AgentKit tool-execution "
        f"entry point), but no such call was found."
    )


def test_script_does_not_bypass_scalekit():
    """The repo MUST be created via Scalekit AgentKit, not via gh CLI or direct GitHub REST."""
    with open(SCRIPT_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    forbidden_patterns = [
        (r"^\s*import\s+github\b", "import of the PyGithub package"),
        (r"^\s*from\s+github\b", "import from the PyGithub package"),
        (r"api\.github\.com", "direct call to api.github.com"),
        (r"['\"]gh['\"]", "shell invocation of the gh CLI"),
    ]
    for pattern, description in forbidden_patterns:
        assert not re.search(pattern, contents, re.MULTILINE), (
            f"Found forbidden {description} in {SCRIPT_FILE}; the repository must be created "
            f"through Scalekit AgentKit's execute_tool, not by bypassing Scalekit."
        )


def test_log_file_exists_with_expected_format():
    assert os.path.isfile(LOG_FILE), (
        f"Expected the log file {LOG_FILE} to exist after the task ran."
    )
    expected_full = _expected_full_name()
    expected_url = _expected_html_url()
    pattern = re.compile(
        rf"^Repository:\s+{re.escape(expected_full)}\s+{re.escape(expected_url)}\s*$",
        re.MULTILINE,
    )
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    assert pattern.search(contents), (
        f"Expected {LOG_FILE} to contain a line in the format "
        f"'Repository: {expected_full} {expected_url}', but log contents were: {contents!r}"
    )


def test_github_repo_created_under_zealt_user01():
    expected_name = _expected_repo_name()
    result = subprocess.run(
        [
            "gh",
            "repo",
            "list",
            REPO_OWNER,
            "--limit",
            "200",
            "--json",
            "name,visibility,isPrivate",
        ],
        capture_output=True,
        text=True,
        env=_gh_env(),
    )
    assert result.returncode == 0, (
        f"'gh repo list {REPO_OWNER}' failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    try:
        repos = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Could not parse JSON from 'gh repo list': {exc}; output was: {result.stdout!r}"
        )
    matching = [r for r in repos if r.get("name") == expected_name]
    assert matching, (
        f"Expected to find a repository named '{expected_name}' under '{REPO_OWNER}', "
        f"but got: {[r.get('name') for r in repos]}"
    )
    repo = matching[0]
    visibility = (repo.get("visibility") or "").upper()
    assert visibility == "PUBLIC", (
        f"Expected repository '{expected_name}' to be PUBLIC, got visibility={repo.get('visibility')!r}"
    )
    assert repo.get("isPrivate") is False, (
        f"Expected repository '{expected_name}' to have isPrivate=false, "
        f"got isPrivate={repo.get('isPrivate')!r}"
    )


def test_github_repo_initialized_with_readme():
    expected_name = _expected_repo_name()
    result = subprocess.run(
        [
            "gh",
            "api",
            f"repos/{REPO_OWNER}/{expected_name}/readme",
            "-H",
            "Accept: application/vnd.github+json",
        ],
        capture_output=True,
        text=True,
        env=_gh_env(),
    )
    assert result.returncode == 0, (
        f"Expected GitHub repository '{REPO_OWNER}/{expected_name}' to have a README, "
        f"but 'gh api repos/.../readme' failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Could not parse JSON from 'gh api readme': {exc}; output was: {result.stdout!r}"
        )
    name = payload.get("name", "")
    assert name, (
        f"Expected the README endpoint for '{REPO_OWNER}/{expected_name}' to return a file with a 'name', "
        f"got payload: {payload!r}"
    )
    assert name.lower().startswith("readme"), (
        f"Expected the README file name to start with 'README', got '{name}'."
    )
