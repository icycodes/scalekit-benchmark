import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")


def _read_log() -> str:
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content.strip(), f"Log file {LOG_FILE} is empty."
    return content


def _parse_agent_repos(content: str) -> set[str]:
    return set(re.findall(r"(?m)^\s*Repo:\s*(\S+)\s*$", content))


def _parse_total(content: str) -> int | None:
    m = re.search(r"(?m)^\s*Total:\s*(\d+)\s*$", content)
    if not m:
        return None
    return int(m.group(1))


def _fetch_expected_repos() -> set[str]:
    result = subprocess.run(
        ["gh", "repo", "list", "zealt-user01", "--limit", "100", "--json", "name"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"`gh repo list` failed: {result.stderr}"
    data = json.loads(result.stdout)
    return {repo["name"] for repo in data}


def test_log_file_exists_and_non_empty():
    _read_log()


def test_log_contains_repo_lines():
    content = _read_log()
    repos = _parse_agent_repos(content)
    assert len(repos) > 0, (
        "Expected at least one line in the format 'Repo: <repo_name>' in the log file, "
        f"got content:\n{content}"
    )


def test_log_total_matches_repo_lines():
    content = _read_log()
    total = _parse_total(content)
    assert total is not None, (
        "Expected a line in the format 'Total: <N>' in the log file, got content:\n"
        f"{content}"
    )
    repos = _parse_agent_repos(content)
    assert total == len(repos), (
        f"'Total: {total}' does not match the number of 'Repo:' lines ({len(repos)}) in the log."
    )


def test_agent_repos_are_subset_of_expected():
    content = _read_log()
    agent_repos = _parse_agent_repos(content)
    expected_repos = _fetch_expected_repos()
    assert agent_repos, "No repositories were extracted from the log file."
    missing = agent_repos - expected_repos
    assert not missing, (
        "The following repositories reported by the agent are not owned by zealt-user01 "
        f"(verified via `gh repo list`): {sorted(missing)}. "
        "The agent must call the Scalekit tool against the live github-test connection."
    )


def test_project_uses_scalekit_sdk():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    found_in_pkg = False
    if os.path.isfile(package_json):
        with open(package_json, "r", encoding="utf-8") as f:
            try:
                pkg = json.load(f)
            except json.JSONDecodeError:
                pkg = {}
        deps = {}
        for key in ("dependencies", "devDependencies"):
            d = pkg.get(key)
            if isinstance(d, dict):
                deps.update(d)
        found_in_pkg = "@scalekit-sdk/node" in deps

    found_in_source = False
    src_pattern = re.compile(r"@scalekit-sdk/node")
    for root, _dirs, files in os.walk(PROJECT_DIR):
        # Skip dependency directories to keep the scan fast
        parts = set(root.split(os.sep))
        if "node_modules" in parts or ".git" in parts:
            continue
        for name in files:
            if not name.endswith((".ts", ".js", ".mjs", ".cjs", ".tsx", ".jsx", ".json")):
                continue
            if name == "package-lock.json":
                continue
            path = os.path.join(root, name)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    if src_pattern.search(f.read()):
                        found_in_source = True
                        break
            except OSError:
                continue
        if found_in_source:
            break

    assert found_in_pkg or found_in_source, (
        "The project does not reference `@scalekit-sdk/node` in package.json or any source file. "
        "The task requires using the Scalekit Node SDK."
    )
