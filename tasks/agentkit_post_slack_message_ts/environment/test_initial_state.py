import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_scalekit_node_sdk_installed():
    # Verify the @scalekit-sdk/node package is preinstalled and resolvable from PROJECT_DIR.
    result = subprocess.run(
        ["node", "-e", "require.resolve('@scalekit-sdk/node')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"@scalekit-sdk/node is not resolvable from {PROJECT_DIR}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_curl_available():
    # curl is needed because the final-state verification uses it to talk to Slack's Web API.
    assert shutil.which("curl") is not None, "curl binary not found in PATH."
