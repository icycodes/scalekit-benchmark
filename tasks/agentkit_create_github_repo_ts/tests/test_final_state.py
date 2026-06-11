import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
REPO_BASENAME = "scalekit-repo"
GH_USERNAME = "zealt-user01"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is required."
    return run_id


def _get_repo_name() -> str:
    return f"{REPO_BASENAME}-{_get_run_id()}"


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} to exist after the task completes."
    )


def test_log_file_contains_repository_url():
    repo_name = _get_repo_name()
    expected_pattern = re.compile(
        r"Repository URL:\s*https://github\.com/"
        + re.escape(GH_USERNAME)
        + r"/"
        + re.escape(repo_name)
        + r"/?\s*$",
        re.MULTILINE,
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert expected_pattern.search(content), (
        "Expected the log file to contain a line matching "
        f"'Repository URL: https://github.com/{GH_USERNAME}/{repo_name}', "
        f"but got:\n{content!r}"
    )


def test_repository_was_created_on_github():
    repo_name = _get_repo_name()
    result = subprocess.run(
        ["gh", "repo", "list", GH_USERNAME, "--limit", "100", "--json", "name"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'gh repo list {GH_USERNAME}' failed: stdout={result.stdout!r} "
        f"stderr={result.stderr!r}"
    )
    repos = json.loads(result.stdout)
    repo_names = [repo["name"] for repo in repos]
    assert repo_name in repo_names, (
        f"Expected repository '{repo_name}' to be present under '{GH_USERNAME}', "
        f"but got: {repo_names}"
    )


def test_repository_visibility_is_public():
    repo_name = _get_repo_name()
    result = subprocess.run(
        [
            "gh",
            "repo",
            "view",
            f"{GH_USERNAME}/{repo_name}",
            "--json",
            "visibility",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"'gh repo view {GH_USERNAME}/{repo_name}' failed: stdout={result.stdout!r} "
        f"stderr={result.stderr!r}"
    )
    data = json.loads(result.stdout)
    visibility = data.get("visibility", "")
    assert visibility.upper() == "PUBLIC", (
        f"Expected visibility 'PUBLIC' for repository "
        f"'{GH_USERNAME}/{repo_name}', but got: {visibility!r}"
    )
