import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_node_sdk_installed():
    result = subprocess.run(
        ["npm", "ls", "@scalekit-sdk/node", "--depth=0"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    combined = (result.stdout or "") + (result.stderr or "")
    assert "@scalekit-sdk/node@" in combined, (
        "Expected @scalekit-sdk/node to be installed in the project. "
        f"npm ls output:\n{combined}"
    )


def test_required_env_vars_present():
    for var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(var), f"Required environment variable {var} is not set."


def test_run_id_env_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID environment variable is not set."


def test_slack_token_env_present_for_verifier():
    assert os.environ.get("SLACK_TOKEN"), (
        "SLACK_TOKEN environment variable is required for verifying the Slack channel."
    )
