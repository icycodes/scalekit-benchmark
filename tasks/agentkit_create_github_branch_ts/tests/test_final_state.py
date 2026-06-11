import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable must be set."
    return run_id


def _repo_name() -> str:
    return f"agentkit-branch-test-{_run_id()}"


def _feature_branch() -> str:
    return f"feature-{_run_id()}"


def test_log_file_records_branch():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} was not created."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    pattern = re.compile(
        r"^Branch created:.*feature-" + re.escape(_run_id()) + r".*$",
        re.MULTILINE,
    )
    assert pattern.search(content), (
        f"Expected a line matching 'Branch created: .*feature-{_run_id()}.*' "
        f"in {LOG_FILE}, got:\n{content}"
    )


def test_repository_exists_on_github():
    repo = _repo_name()
    result = subprocess.run(
        ["gh", "api", f"repos/zealt-user01/{repo}"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Expected repository zealt-user01/{repo} to exist on GitHub. "
        f"gh stderr: {result.stderr}"
    )
    data = json.loads(result.stdout)
    assert data.get("name") == repo, (
        f"Unexpected repo metadata: got name={data.get('name')!r}, expected {repo!r}."
    )


def test_branches_exist_on_github():
    repo = _repo_name()
    feature_branch = _feature_branch()
    result = subprocess.run(
        [
            "gh",
            "api",
            f"repos/zealt-user01/{repo}/branches",
            "--paginate",
            "--jq",
            ".[].name",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`gh api repos/zealt-user01/{repo}/branches` failed: {result.stderr}"
    )
    branches = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    assert "main" in branches, (
        f"Expected 'main' branch in zealt-user01/{repo}, got: {branches}"
    )
    assert feature_branch in branches, (
        f"Expected branch '{feature_branch}' in zealt-user01/{repo}, "
        f"got branches: {branches}"
    )


def test_new_branch_points_at_main_head():
    repo = _repo_name()
    feature_branch = _feature_branch()

    main_result = subprocess.run(
        ["gh", "api", f"repos/zealt-user01/{repo}/branches/main", "--jq", ".commit.sha"],
        capture_output=True,
        text=True,
    )
    assert main_result.returncode == 0, (
        f"Failed to fetch main branch metadata: {main_result.stderr}"
    )
    main_sha = main_result.stdout.strip()
    assert main_sha, "main branch SHA is empty."

    new_result = subprocess.run(
        [
            "gh",
            "api",
            f"repos/zealt-user01/{repo}/branches/{feature_branch}",
            "--jq",
            ".commit.sha",
        ],
        capture_output=True,
        text=True,
    )
    assert new_result.returncode == 0, (
        f"Failed to fetch feature branch metadata: {new_result.stderr}"
    )
    new_sha = new_result.stdout.strip()
    assert new_sha, f"Feature branch '{feature_branch}' SHA is empty."

    assert new_sha == main_sha, (
        f"Expected '{feature_branch}' to point at main HEAD ({main_sha}), "
        f"but it points at {new_sha}. The branch should not have any extra commits."
    )


def test_implementation_uses_scalekit_sdk():
    """The branch must be created via the Scalekit Node SDK, not gh/git/REST directly."""
    matches: list[str] = []
    for root, _dirs, files in os.walk(PROJECT_DIR):
        # Skip node_modules so dependency manifests don't trivially match.
        if "node_modules" in root.split(os.sep):
            continue
        for name in files:
            if not name.endswith((".ts", ".tsx", ".js", ".mjs", ".cjs")):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except OSError:
                continue
            if "@scalekit-sdk/node" in text:
                matches.append(path)
    assert matches, (
        "Expected at least one TypeScript/JavaScript source file under "
        "/home/user/myproject (excluding node_modules) to import "
        "'@scalekit-sdk/node'; the task must use the Scalekit Node SDK."
    )
